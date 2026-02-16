import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Encryption configuration for the vault
 */
export type EncryptionConfig = {
  algorithm: "aes-256-gcm";
  keyDerivation: "argon2id" | "scrypt";
  saltLength: number;
  ivLength: number;
  authTagLength: number;
};

/**
 * Encrypted document metadata
 */
export type EncryptedDocument = {
  id: string;
  category: string;
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
  metadata: {
    created: number;
    modified: number;
    size: number;
    version: number;
  };
};

/**
 * Storage result types
 */
export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Vault storage configuration
 */
export type VaultStorageConfig = {
  vaultDir: string;
  encryption: EncryptionConfig;
};

/**
 * Encrypted storage layer using AES-256-GCM
 * Provides document-level encryption with unique IVs and authentication tags
 */
export class EncryptedVaultStorage {
  private readonly config: VaultStorageConfig;
  private masterKey: Buffer | null = null;

  constructor(config: VaultStorageConfig) {
    this.config = config;
    this.ensureVaultDirectory();
  }

  /**
   * Initialize storage with master key derived from passphrase
   */
  async initialize(passphrase: string): Promise<StorageResult<void>> {
    try {
      const salt = await this.getOrCreateSalt();
      this.masterKey = await this.deriveKey(passphrase, salt);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: `Failed to initialize vault: ${error}` };
    }
  }

  /**
   * Store encrypted document
   */
  async storeDocument(
    category: string,
    id: string,
    data: Buffer | string,
  ): Promise<StorageResult<EncryptedDocument>> {
    if (!this.masterKey) {
      return { ok: false, error: "Vault not initialized" };
    }

    try {
      const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

      // Generate unique IV and salt for this document
      const iv = crypto.randomBytes(this.config.encryption.ivLength);
      const salt = crypto.randomBytes(this.config.encryption.saltLength);

      // Derive document-specific key
      const docKey = await this.deriveDocumentKey(this.masterKey, salt);

      // Encrypt data with AES-256-GCM
      const cipher = crypto.createCipheriv(this.config.encryption.algorithm, docKey, iv, {
        authTagLength: this.config.encryption.authTagLength,
      });

      const encryptedData = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const doc: EncryptedDocument = {
        id,
        category,
        encryptedData,
        iv,
        authTag,
        salt,
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: dataBuffer.length,
          version: 1,
        },
      };

      // Persist to disk
      await this.persistDocument(doc);

      return { ok: true, value: doc };
    } catch (error) {
      return { ok: false, error: `Failed to store document: ${error}` };
    }
  }

  /**
   * Retrieve and decrypt document
   */
  async retrieveDocument(
    category: string,
    id: string,
  ): Promise<StorageResult<Buffer>> {
    if (!this.masterKey) {
      return { ok: false, error: "Vault not initialized" };
    }

    try {
      const doc = await this.loadDocument(category, id);
      if (!doc) {
        return { ok: false, error: "Document not found" };
      }

      // Derive document-specific key
      const docKey = await this.deriveDocumentKey(this.masterKey, doc.salt);

      // Decrypt data
      const decipher = crypto.createDecipheriv(
        this.config.encryption.algorithm,
        docKey,
        doc.iv,
        {
          authTagLength: this.config.encryption.authTagLength,
        },
      );

      decipher.setAuthTag(doc.authTag);

      const decryptedData = Buffer.concat([
        decipher.update(doc.encryptedData),
        decipher.final(),
      ]);

      return { ok: true, value: decryptedData };
    } catch (error) {
      return { ok: false, error: `Failed to retrieve document: ${error}` };
    }
  }

  /**
   * List documents in category (metadata only, no decryption)
   */
  async listDocuments(category: string): Promise<StorageResult<Array<{
    id: string;
    created: number;
    modified: number;
    size: number;
  }>>> {
    try {
      const categoryDir = this.getCategoryPath(category);
      if (!fs.existsSync(categoryDir)) {
        return { ok: true, value: [] };
      }

      const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith(".enc"));
      const docs = [];

      for (const file of files) {
        const doc = await this.loadDocument(category, path.basename(file, ".enc"));
        if (doc) {
          docs.push({
            id: doc.id,
            created: doc.metadata.created,
            modified: doc.metadata.modified,
            size: doc.metadata.size,
          });
        }
      }

      return { ok: true, value: docs };
    } catch (error) {
      return { ok: false, error: `Failed to list documents: ${error}` };
    }
  }

  /**
   * Delete document securely
   */
  async deleteDocument(category: string, id: string): Promise<StorageResult<void>> {
    try {
      const docPath = this.getDocumentPath(category, id);
      if (!fs.existsSync(docPath)) {
        return { ok: false, error: "Document not found" };
      }

      // Secure deletion: overwrite with random data before deletion
      const stats = fs.statSync(docPath);
      const randomData = crypto.randomBytes(stats.size);
      fs.writeFileSync(docPath, randomData);
      fs.unlinkSync(docPath);

      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: `Failed to delete document: ${error}` };
    }
  }

  /**
   * Derive key from passphrase using scrypt
   * In production, use argon2id for better security
   */
  private async deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(
        passphrase,
        salt,
        32, // 256 bits for AES-256
        {
          N: 16384, // CPU/memory cost
          r: 8,     // Block size
          p: 1,     // Parallelization
        },
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        },
      );
    });
  }

  /**
   * Derive document-specific key from master key
   */
  private async deriveDocumentKey(masterKey: Buffer, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(masterKey, salt, 10000, 32, "sha256", (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  /**
   * Get or create vault salt
   */
  private async getOrCreateSalt(): Promise<Buffer> {
    const saltPath = path.join(this.config.vaultDir, ".salt");
    if (fs.existsSync(saltPath)) {
      return fs.readFileSync(saltPath);
    }

    const salt = crypto.randomBytes(this.config.encryption.saltLength);
    fs.writeFileSync(saltPath, salt, { mode: 0o600 });
    return salt;
  }

  /**
   * Ensure vault directory structure exists
   */
  private ensureVaultDirectory(): void {
    fs.mkdirSync(this.config.vaultDir, { recursive: true, mode: 0o700 });
  }

  /**
   * Get category directory path
   */
  private getCategoryPath(category: string): string {
    return path.join(this.config.vaultDir, category);
  }

  /**
   * Get document file path
   */
  private getDocumentPath(category: string, id: string): string {
    return path.join(this.getCategoryPath(category), `${id}.enc`);
  }

  /**
   * Persist encrypted document to disk
   */
  private async persistDocument(doc: EncryptedDocument): Promise<void> {
    const categoryDir = this.getCategoryPath(doc.category);
    fs.mkdirSync(categoryDir, { recursive: true, mode: 0o700 });

    const docPath = this.getDocumentPath(doc.category, doc.id);
    const serialized = JSON.stringify({
      id: doc.id,
      category: doc.category,
      encryptedData: doc.encryptedData.toString("base64"),
      iv: doc.iv.toString("base64"),
      authTag: doc.authTag.toString("base64"),
      salt: doc.salt.toString("base64"),
      metadata: doc.metadata,
    });

    fs.writeFileSync(docPath, serialized, { mode: 0o600 });
  }

  /**
   * Load encrypted document from disk
   */
  private async loadDocument(
    category: string,
    id: string,
  ): Promise<EncryptedDocument | null> {
    const docPath = this.getDocumentPath(category, id);
    if (!fs.existsSync(docPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(docPath, "utf-8");
      const parsed = JSON.parse(raw);

      return {
        id: parsed.id,
        category: parsed.category,
        encryptedData: Buffer.from(parsed.encryptedData, "base64"),
        iv: Buffer.from(parsed.iv, "base64"),
        authTag: Buffer.from(parsed.authTag, "base64"),
        salt: Buffer.from(parsed.salt, "base64"),
        metadata: parsed.metadata,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Create default vault storage configuration
 */
export function createDefaultVaultConfig(vaultDir: string): VaultStorageConfig {
  return {
    vaultDir,
    encryption: {
      algorithm: "aes-256-gcm",
      keyDerivation: "scrypt",
      saltLength: 32,
      ivLength: 16,
      authTagLength: 16,
    },
  };
}
