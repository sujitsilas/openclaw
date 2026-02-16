import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EncryptedVaultStorage, createDefaultVaultConfig } from "./encrypted-store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("EncryptedVaultStorage", () => {
  let tempDir: string;
  let storage: EncryptedVaultStorage;
  const passphrase = "test-passphrase-secure-123";

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-"));
    const config = createDefaultVaultConfig(tempDir);
    storage = new EncryptedVaultStorage(config);
    await storage.initialize(passphrase);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("initialization", () => {
    it("should initialize vault with passphrase", async () => {
      const result = await storage.initialize(passphrase);
      expect(result.ok).toBe(true);
    });

    it("should create vault directory", () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it("should create salt file", () => {
      const saltPath = path.join(tempDir, ".salt");
      expect(fs.existsSync(saltPath)).toBe(true);
    });
  });

  describe("document storage", () => {
    it("should store and retrieve document", async () => {
      const testData = { name: "John Doe", age: 30 };

      const storeResult = await storage.storeDocument(
        "test",
        "doc1",
        JSON.stringify(testData),
      );
      expect(storeResult.ok).toBe(true);

      const retrieveResult = await storage.retrieveDocument("test", "doc1");
      expect(retrieveResult.ok).toBe(true);
      if (retrieveResult.ok) {
        const decrypted = JSON.parse(retrieveResult.value.toString("utf-8"));
        expect(decrypted).toEqual(testData);
      }
    });

    it("should store document with unique encryption", async () => {
      const data = "sensitive data";

      const result1 = await storage.storeDocument("test", "doc1", data);
      const result2 = await storage.storeDocument("test", "doc2", data);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        // Different documents should have different IVs
        expect(result1.value.iv).not.toEqual(result2.value.iv);
        expect(result1.value.salt).not.toEqual(result2.value.salt);
      }
    });

    it("should fail to retrieve non-existent document", async () => {
      const result = await storage.retrieveDocument("test", "nonexistent");
      expect(result.ok).toBe(false);
    });
  });

  describe("document listing", () => {
    it("should list documents in category", async () => {
      await storage.storeDocument("test", "doc1", "data1");
      await storage.storeDocument("test", "doc2", "data2");

      const result = await storage.listDocuments("test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
        expect(result.value.map((d) => d.id).sort()).toEqual(["doc1", "doc2"]);
      }
    });

    it("should return empty list for non-existent category", async () => {
      const result = await storage.listDocuments("nonexistent");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });
  });

  describe("document deletion", () => {
    it("should delete document securely", async () => {
      await storage.storeDocument("test", "doc1", "sensitive");

      const deleteResult = await storage.deleteDocument("test", "doc1");
      expect(deleteResult.ok).toBe(true);

      const retrieveResult = await storage.retrieveDocument("test", "doc1");
      expect(retrieveResult.ok).toBe(false);
    });

    it("should fail to delete non-existent document", async () => {
      const result = await storage.deleteDocument("test", "nonexistent");
      expect(result.ok).toBe(false);
    });
  });

  describe("encryption security", () => {
    it("should use authentication tag", async () => {
      const result = await storage.storeDocument("test", "doc1", "data");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.authTag.length).toBe(16); // 16 bytes = 128 bits
      }
    });

    it("should detect tampering", async () => {
      await storage.storeDocument("test", "doc1", "data");

      // Tamper with encrypted file
      const docPath = path.join(tempDir, "test", "doc1.enc");
      const raw = fs.readFileSync(docPath, "utf-8");
      const parsed = JSON.parse(raw);
      parsed.encryptedData = "tampered";
      fs.writeFileSync(docPath, JSON.stringify(parsed));

      // Should fail to decrypt
      const result = await storage.retrieveDocument("test", "doc1");
      expect(result.ok).toBe(false);
    });
  });
});
