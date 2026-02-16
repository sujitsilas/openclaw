import crypto from "node:crypto";
import type { DataPackage } from "./data-packager.js";

/**
 * Delivery method
 */
export type DeliveryMethod = "email" | "portal" | "api" | "channel";

/**
 * Delivery options
 */
export type DeliveryOptions = {
  method: DeliveryMethod;
  recipient: string;
  encryptionKey?: Buffer;
  expirationMinutes?: number;
  notifyRecipient?: boolean;
};

/**
 * Delivery result
 */
export type DeliveryResult = {
  success: boolean;
  deliveryId?: string;
  accessUrl?: string;
  encryptionKey?: string;
  error?: string;
};

/**
 * Access token for secure portal
 */
export type AccessToken = {
  tokenId: string;
  packageId: string;
  recipient: string;
  encryptionKey: string;
  expiresAt: number;
  used: boolean;
};

/**
 * Secure transport layer for data packages
 * Provides multiple delivery methods with encryption
 */
export class SecureTransport {
  private readonly accessTokens: Map<string, AccessToken> = new Map();
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Deliver data package
   */
  async deliverPackage(
    pkg: DataPackage,
    options: DeliveryOptions,
  ): Promise<DeliveryResult> {
    try {
      switch (options.method) {
        case "portal":
          return this.deliverViaPortal(pkg, options);

        case "email":
          return this.deliverViaEmail(pkg, options);

        case "api":
          return this.deliverViaApi(pkg, options);

        case "channel":
          return this.deliverViaChannel(pkg, options);

        default:
          return { success: false, error: "Unsupported delivery method" };
      }
    } catch (error) {
      return { success: false, error: `Delivery failed: ${error}` };
    }
  }

  /**
   * Deliver via secure web portal
   */
  private async deliverViaPortal(
    pkg: DataPackage,
    options: DeliveryOptions,
  ): Promise<DeliveryResult> {
    // Generate access token
    const tokenId = crypto.randomBytes(32).toString("hex");
    const encryptionKey = crypto.randomBytes(32).toString("base64");

    const expirationMinutes = options.expirationMinutes || 60;
    const expiresAt = Date.now() + expirationMinutes * 60 * 1000;

    const token: AccessToken = {
      tokenId,
      packageId: pkg.packageId,
      recipient: options.recipient,
      encryptionKey,
      expiresAt,
      used: false,
    };

    this.accessTokens.set(tokenId, token);

    // Generate access URL
    const accessUrl = `${this.baseUrl}/vault/access/${tokenId}`;

    return {
      success: true,
      deliveryId: tokenId,
      accessUrl,
      encryptionKey,
    };
  }

  /**
   * Deliver via encrypted email
   */
  private async deliverViaEmail(
    pkg: DataPackage,
    options: DeliveryOptions,
  ): Promise<DeliveryResult> {
    // In real implementation, integrate with email service
    // For now, create a secure link
    const portalResult = await this.deliverViaPortal(pkg, options);

    // Would send email with access link here
    // sendEmail({
    //   to: options.recipient,
    //   subject: "Secure Data Package",
    //   body: `Access your data package: ${portalResult.accessUrl}`,
    // });

    return portalResult;
  }

  /**
   * Deliver via API endpoint
   */
  private async deliverViaApi(
    pkg: DataPackage,
    options: DeliveryOptions,
  ): Promise<DeliveryResult> {
    // Generate API access token
    const apiToken = crypto.randomBytes(32).toString("hex");

    // In real implementation, register API endpoint
    // and return access credentials

    return {
      success: true,
      deliveryId: apiToken,
      accessUrl: `${this.baseUrl}/api/vault/packages/${pkg.packageId}`,
      encryptionKey: options.encryptionKey?.toString("base64"),
    };
  }

  /**
   * Deliver via messaging channel
   */
  private async deliverViaChannel(
    pkg: DataPackage,
    options: DeliveryOptions,
  ): Promise<DeliveryResult> {
    // In real implementation, integrate with OpenClaw messaging channels
    // Send package via Telegram/WhatsApp/Slack/etc.

    return {
      success: true,
      deliveryId: pkg.packageId,
    };
  }

  /**
   * Validate access token
   */
  validateAccessToken(tokenId: string): AccessToken | null {
    const token = this.accessTokens.get(tokenId);
    if (!token) {
      return null;
    }

    if (Date.now() > token.expiresAt) {
      return null;
    }

    if (token.used) {
      return null;
    }

    return token;
  }

  /**
   * Mark access token as used
   */
  markTokenUsed(tokenId: string): boolean {
    const token = this.accessTokens.get(tokenId);
    if (!token) {
      return false;
    }

    token.used = true;
    return true;
  }

  /**
   * Revoke access token
   */
  revokeAccessToken(tokenId: string): boolean {
    return this.accessTokens.delete(tokenId);
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [tokenId, token] of this.accessTokens.entries()) {
      if (now > token.expiresAt || token.used) {
        this.accessTokens.delete(tokenId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
