import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Authentication factor types
 */
export type AuthFactor =
  | { type: "passphrase"; value: string }
  | { type: "device"; deviceId: string; signature: string }
  | { type: "biometric"; token: string }
  | { type: "hardware-key"; challenge: string; response: string };

/**
 * Authentication session
 */
export type AuthSession = {
  sessionId: string;
  userId: string;
  factors: AuthFactor["type"][];
  expiresAt: number;
  createdAt: number;
  deviceId?: string;
};

/**
 * Authentication result
 */
export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string; requiresMfa?: boolean };

/**
 * Stored authentication data
 */
type StoredAuth = {
  userId: string;
  passphraseHash: string;
  salt: string;
  mfaEnabled: boolean;
  authorizedDevices: Array<{
    deviceId: string;
    publicKey: string;
    name: string;
    addedAt: number;
  }>;
  sessions: AuthSession[];
};

/**
 * Authentication manager with multi-factor support
 * Handles passphrase, device pairing, biometric, and hardware key authentication
 */
export class VaultAuthManager {
  private readonly authDir: string;
  private authData: Map<string, StoredAuth> = new Map();

  constructor(vaultDir: string) {
    this.authDir = path.join(vaultDir, ".auth");
    this.ensureAuthDirectory();
    this.loadAuthData();
  }

  /**
   * Create new user authentication
   */
  async createUser(
    userId: string,
    passphrase: string,
    mfaEnabled = true,
  ): Promise<AuthResult> {
    if (this.authData.has(userId)) {
      return { ok: false, error: "User already exists" };
    }

    try {
      const salt = crypto.randomBytes(32).toString("hex");
      const passphraseHash = await this.hashPassphrase(passphrase, salt);

      const authData: StoredAuth = {
        userId,
        passphraseHash,
        salt,
        mfaEnabled,
        authorizedDevices: [],
        sessions: [],
      };

      this.authData.set(userId, authData);
      await this.saveAuthData();

      // Create initial session
      const session = this.createSession(userId, ["passphrase"]);
      authData.sessions.push(session);
      await this.saveAuthData();

      return { ok: true, session };
    } catch (error) {
      return { ok: false, error: `Failed to create user: ${error}` };
    }
  }

  /**
   * Authenticate with single factor
   */
  async authenticate(
    userId: string,
    factor: AuthFactor,
  ): Promise<AuthResult> {
    const authData = this.authData.get(userId);
    if (!authData) {
      return { ok: false, error: "User not found" };
    }

    try {
      const factorValid = await this.validateFactor(authData, factor);
      if (!factorValid) {
        return { ok: false, error: "Authentication failed" };
      }

      // Check if MFA is required
      if (authData.mfaEnabled && factor.type === "passphrase") {
        return {
          ok: false,
          error: "Multi-factor authentication required",
          requiresMfa: true,
        };
      }

      // Create session
      const session = this.createSession(userId, [factor.type]);
      authData.sessions.push(session);
      await this.saveAuthData();

      return { ok: true, session };
    } catch (error) {
      return { ok: false, error: `Authentication failed: ${error}` };
    }
  }

  /**
   * Authenticate with multiple factors (MFA)
   */
  async authenticateMfa(
    userId: string,
    factors: AuthFactor[],
  ): Promise<AuthResult> {
    const authData = this.authData.get(userId);
    if (!authData) {
      return { ok: false, error: "User not found" };
    }

    try {
      // Validate all factors
      for (const factor of factors) {
        const valid = await this.validateFactor(authData, factor);
        if (!valid) {
          return { ok: false, error: `Invalid ${factor.type} factor` };
        }
      }

      // Create session with all factors
      const session = this.createSession(
        userId,
        factors.map((f) => f.type),
        factors.find((f) => f.type === "device")?.deviceId,
      );
      authData.sessions.push(session);
      await this.saveAuthData();

      return { ok: true, session };
    } catch (error) {
      return { ok: false, error: `MFA authentication failed: ${error}` };
    }
  }

  /**
   * Validate authentication session
   */
  validateSession(sessionId: string): AuthSession | null {
    for (const authData of this.authData.values()) {
      const session = authData.sessions.find((s) => s.sessionId === sessionId);
      if (session) {
        if (Date.now() > session.expiresAt) {
          return null; // Expired
        }
        return session;
      }
    }
    return null;
  }

  /**
   * Revoke authentication session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    for (const authData of this.authData.values()) {
      const index = authData.sessions.findIndex((s) => s.sessionId === sessionId);
      if (index !== -1) {
        authData.sessions.splice(index, 1);
        await this.saveAuthData();
        return true;
      }
    }
    return false;
  }

  /**
   * Add authorized device for device-based authentication
   */
  async addAuthorizedDevice(
    userId: string,
    deviceId: string,
    publicKey: string,
    name: string,
  ): Promise<boolean> {
    const authData = this.authData.get(userId);
    if (!authData) {
      return false;
    }

    authData.authorizedDevices.push({
      deviceId,
      publicKey,
      name,
      addedAt: Date.now(),
    });

    await this.saveAuthData();
    return true;
  }

  /**
   * Remove authorized device
   */
  async removeAuthorizedDevice(userId: string, deviceId: string): Promise<boolean> {
    const authData = this.authData.get(userId);
    if (!authData) {
      return false;
    }

    const index = authData.authorizedDevices.findIndex((d) => d.deviceId === deviceId);
    if (index !== -1) {
      authData.authorizedDevices.splice(index, 1);
      await this.saveAuthData();
      return true;
    }

    return false;
  }

  /**
   * List authorized devices
   */
  listAuthorizedDevices(userId: string): Array<{
    deviceId: string;
    name: string;
    addedAt: number;
  }> {
    const authData = this.authData.get(userId);
    if (!authData) {
      return [];
    }

    return authData.authorizedDevices.map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      addedAt: d.addedAt,
    }));
  }

  /**
   * Validate individual authentication factor
   */
  private async validateFactor(
    authData: StoredAuth,
    factor: AuthFactor,
  ): Promise<boolean> {
    switch (factor.type) {
      case "passphrase": {
        const hash = await this.hashPassphrase(factor.value, authData.salt);
        return crypto.timingSafeEqual(
          Buffer.from(hash),
          Buffer.from(authData.passphraseHash),
        );
      }

      case "device": {
        const device = authData.authorizedDevices.find(
          (d) => d.deviceId === factor.deviceId,
        );
        if (!device) {
          return false;
        }

        // Verify signature
        try {
          const verify = crypto.createVerify("SHA256");
          verify.update(factor.deviceId);
          return verify.verify(device.publicKey, factor.signature, "hex");
        } catch {
          return false;
        }
      }

      case "biometric":
        // In a real implementation, validate biometric token
        // This would integrate with platform-specific biometric APIs
        return factor.token.length > 0;

      case "hardware-key":
        // In a real implementation, validate hardware key challenge-response
        // This would integrate with FIDO2/WebAuthn APIs
        return factor.response.length > 0;

      default:
        return false;
    }
  }

  /**
   * Hash passphrase using scrypt
   */
  private async hashPassphrase(passphrase: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(passphrase, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString("hex"));
      });
    });
  }

  /**
   * Create authentication session
   */
  private createSession(
    userId: string,
    factors: AuthFactor["type"][],
    deviceId?: string,
  ): AuthSession {
    return {
      sessionId: crypto.randomBytes(32).toString("hex"),
      userId,
      factors,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      createdAt: Date.now(),
      deviceId,
    };
  }

  /**
   * Ensure authentication directory exists
   */
  private ensureAuthDirectory(): void {
    fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 });
  }

  /**
   * Load authentication data from disk
   */
  private loadAuthData(): void {
    const authFile = path.join(this.authDir, "auth.json");
    if (!fs.existsSync(authFile)) {
      return;
    }

    try {
      const raw = fs.readFileSync(authFile, "utf-8");
      const data = JSON.parse(raw);

      for (const [userId, authData] of Object.entries(data)) {
        this.authData.set(userId, authData as StoredAuth);
      }
    } catch {
      // Ignore errors, start fresh
    }
  }

  /**
   * Save authentication data to disk
   */
  private async saveAuthData(): Promise<void> {
    const authFile = path.join(this.authDir, "auth.json");
    const data = Object.fromEntries(this.authData.entries());
    fs.writeFileSync(authFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const authData of this.authData.values()) {
      const before = authData.sessions.length;
      authData.sessions = authData.sessions.filter((s) => s.expiresAt > now);
      cleaned += before - authData.sessions.length;
    }

    if (cleaned > 0) {
      await this.saveAuthData();
    }

    return cleaned;
  }
}
