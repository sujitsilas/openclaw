import crypto from "node:crypto";

/**
 * Data package with encryption and digital signature
 */
export type DataPackage = {
  packageId: string;
  requestId: string;
  recipient: string;
  category: string;
  fields: string[];
  encryptedData: string;
  iv: string;
  authTag: string;
  signature: string;
  metadata: {
    createdAt: number;
    expiresAt: number;
    oneTimeUse: boolean;
    watermarked: boolean;
  };
};

/**
 * Package creation options
 */
export type PackageOptions = {
  expirationMinutes?: number;
  oneTimeUse?: boolean;
  watermark?: boolean;
  encryptionKey?: Buffer;
};

/**
 * Packager result types
 */
export type PackagerResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Secure data packager
 * Creates encrypted, signed, and tamper-evident data packages
 */
export class DataPackager {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(privateKey: string, publicKey: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Create secure data package
   */
  async createPackage(
    requestId: string,
    recipient: string,
    category: string,
    fields: string[],
    data: Record<string, unknown>,
    options: PackageOptions = {},
  ): Promise<PackagerResult<DataPackage>> {
    try {
      const packageId = crypto.randomBytes(16).toString("hex");

      // Filter data to only include requested fields
      const filteredData = this.filterFields(data, fields);

      // Add watermark if requested
      const dataToPackage = options.watermark
        ? this.addWatermark(filteredData, packageId, recipient)
        : filteredData;

      // Generate or use provided encryption key
      const encryptionKey = options.encryptionKey || crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      // Encrypt data
      const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
      const dataJson = JSON.stringify(dataToPackage);
      const encryptedData = Buffer.concat([
        cipher.update(dataJson, "utf-8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      // Calculate expiration
      const expirationMinutes = options.expirationMinutes || 60;
      const expiresAt = Date.now() + expirationMinutes * 60 * 1000;

      // Create package metadata
      const metadata = {
        createdAt: Date.now(),
        expiresAt,
        oneTimeUse: options.oneTimeUse || false,
        watermarked: options.watermark || false,
      };

      // Sign package
      const signature = this.signPackage({
        packageId,
        requestId,
        recipient,
        category,
        fields,
        encryptedData: encryptedData.toString("base64"),
        metadata,
      });

      const pkg: DataPackage = {
        packageId,
        requestId,
        recipient,
        category,
        fields,
        encryptedData: encryptedData.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        signature,
        metadata,
      };

      return { ok: true, value: pkg };
    } catch (error) {
      return { ok: false, error: `Failed to create package: ${error}` };
    }
  }

  /**
   * Verify package integrity
   */
  verifyPackage(pkg: DataPackage): boolean {
    try {
      const verify = crypto.createVerify("SHA256");
      const canonical = JSON.stringify({
        packageId: pkg.packageId,
        requestId: pkg.requestId,
        recipient: pkg.recipient,
        category: pkg.category,
        fields: pkg.fields,
        encryptedData: pkg.encryptedData,
        metadata: pkg.metadata,
      });

      verify.update(canonical);
      return verify.verify(this.publicKey, pkg.signature, "hex");
    } catch {
      return false;
    }
  }

  /**
   * Check if package is still valid
   */
  isPackageValid(pkg: DataPackage): { valid: boolean; reason?: string } {
    // Check expiration
    if (Date.now() > pkg.metadata.expiresAt) {
      return { valid: false, reason: "Package has expired" };
    }

    // Verify signature
    if (!this.verifyPackage(pkg)) {
      return { valid: false, reason: "Package signature is invalid" };
    }

    return { valid: true };
  }

  /**
   * Decrypt package data
   */
  async decryptPackage(
    pkg: DataPackage,
    encryptionKey: Buffer,
  ): Promise<PackagerResult<Record<string, unknown>>> {
    try {
      // Verify package first
      const validation = this.isPackageValid(pkg);
      if (!validation.valid) {
        return { ok: false, error: validation.reason || "Package is invalid" };
      }

      const iv = Buffer.from(pkg.iv, "base64");
      const authTag = Buffer.from(pkg.authTag, "base64");
      const encryptedData = Buffer.from(pkg.encryptedData, "base64");

      const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);

      const data = JSON.parse(decrypted.toString("utf-8"));
      return { ok: true, value: data };
    } catch (error) {
      return { ok: false, error: `Failed to decrypt package: ${error}` };
    }
  }

  /**
   * Filter data to only include requested fields
   */
  private filterFields(
    data: Record<string, unknown>,
    fields: string[],
  ): Record<string, unknown> {
    if (fields.includes("*")) {
      return data;
    }

    const filtered: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in data) {
        filtered[field] = data[field];
      }
    }

    return filtered;
  }

  /**
   * Add digital watermark to data
   */
  private addWatermark(
    data: Record<string, unknown>,
    packageId: string,
    recipient: string,
  ): Record<string, unknown> {
    return {
      ...data,
      __watermark: {
        packageId,
        recipient,
        timestamp: Date.now(),
        hash: crypto
          .createHash("sha256")
          .update(`${packageId}:${recipient}:${Date.now()}`)
          .digest("hex"),
      },
    };
  }

  /**
   * Sign package with private key
   */
  private signPackage(pkg: Partial<DataPackage>): string {
    const sign = crypto.createSign("SHA256");
    const canonical = JSON.stringify({
      packageId: pkg.packageId,
      requestId: pkg.requestId,
      recipient: pkg.recipient,
      category: pkg.category,
      fields: pkg.fields,
      encryptedData: pkg.encryptedData,
      metadata: pkg.metadata,
    });

    sign.update(canonical);
    return sign.sign(this.privateKey, "hex");
  }

  /**
   * Generate key pair for signing
   */
  static generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    return { privateKey, publicKey };
  }
}
