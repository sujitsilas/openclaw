/**
 * Personal Vault Extension for OpenClaw
 *
 * Provides secure encrypted storage for personal data with:
 * - AES-256-GCM encryption at rest
 * - Multi-factor authentication
 * - Granular access control
 * - Approval workflows
 * - Secure delivery mechanisms
 * - Audit logging
 */

export { EncryptedVaultStorage, createDefaultVaultConfig } from "./storage/encrypted-store.js";
export type {
  EncryptedDocument,
  EncryptionConfig,
  StorageResult,
  VaultStorageConfig,
} from "./storage/encrypted-store.js";

export { VaultAuthManager } from "./auth/auth-manager.js";
export type {
  AuthFactor,
  AuthResult,
  AuthSession,
} from "./auth/auth-manager.js";

export { RequestValidator } from "./access/request-validator.js";
export type {
  DataRequest,
  ValidationResult,
} from "./access/request-validator.js";

export { ApprovalWorkflow } from "./access/approval-workflow.js";
export type {
  ApprovalDecision,
  ApprovalResult,
  ApprovalStatus,
  DataApproval,
} from "./access/approval-workflow.js";

export { PermissionEngine } from "./access/permission-engine.js";
export type {
  Permission,
  PermissionCheckResult,
  PermissionLevel,
} from "./access/permission-engine.js";

export { DataPackager } from "./delivery/data-packager.js";
export type {
  DataPackage,
  PackageOptions,
  PackagerResult,
} from "./delivery/data-packager.js";

export { SecureTransport } from "./delivery/secure-transport.js";
export type {
  AccessToken,
  DeliveryMethod,
  DeliveryOptions,
  DeliveryResult,
} from "./delivery/secure-transport.js";

export { createVaultStoreTool } from "./tools/vault-store.js";
export { createVaultQueryTool } from "./tools/vault-query.js";
export { createVaultRequestTool } from "./tools/vault-request.js";
export { createVaultApproveTool } from "./tools/vault-approve.js";
export { createVaultAuditTool } from "./tools/vault-audit.js";

/**
 * Main vault manager coordinating all components
 */
export class PersonalVault {
  private readonly storage: EncryptedVaultStorage;
  private readonly authManager: VaultAuthManager;
  private readonly approvalWorkflow: ApprovalWorkflow;
  private readonly permissionEngine: PermissionEngine;
  private readonly dataPackager: DataPackager;
  private readonly secureTransport: SecureTransport;

  constructor(vaultDir: string, baseUrl: string) {
    const storageConfig = createDefaultVaultConfig(vaultDir);
    this.storage = new EncryptedVaultStorage(storageConfig);
    this.authManager = new VaultAuthManager(vaultDir);
    this.approvalWorkflow = new ApprovalWorkflow(vaultDir);
    this.permissionEngine = new PermissionEngine();

    const { privateKey, publicKey } = DataPackager.generateKeyPair();
    this.dataPackager = new DataPackager(privateKey, publicKey);
    this.secureTransport = new SecureTransport(baseUrl);
  }

  /**
   * Initialize vault with passphrase
   */
  async initialize(passphrase: string): Promise<StorageResult<void>> {
    return this.storage.initialize(passphrase);
  }

  /**
   * Get storage instance
   */
  getStorage(): EncryptedVaultStorage {
    return this.storage;
  }

  /**
   * Get auth manager instance
   */
  getAuthManager(): VaultAuthManager {
    return this.authManager;
  }

  /**
   * Get approval workflow instance
   */
  getApprovalWorkflow(): ApprovalWorkflow {
    return this.approvalWorkflow;
  }

  /**
   * Get permission engine instance
   */
  getPermissionEngine(): PermissionEngine {
    return this.permissionEngine;
  }

  /**
   * Get data packager instance
   */
  getDataPackager(): DataPackager {
    return this.dataPackager;
  }

  /**
   * Get secure transport instance
   */
  getSecureTransport(): SecureTransport {
    return this.secureTransport;
  }
}
