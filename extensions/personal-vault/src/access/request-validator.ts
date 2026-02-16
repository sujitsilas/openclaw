import crypto from "node:crypto";

/**
 * Data access request
 */
export type DataRequest = {
  requestId: string;
  requester: {
    id: string;
    name: string;
    email?: string;
    organization?: string;
  };
  category: string;
  fields: string[];
  purpose: string;
  createdAt: number;
  expiresAt: number;
  signature?: string;
  publicKey?: string;
};

/**
 * Request validation result
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Request validator for data access requests
 * Validates digital signatures, expiration, and request integrity
 */
export class RequestValidator {
  /**
   * Validate data access request
   */
  validateRequest(request: DataRequest): ValidationResult {
    const errors: string[] = [];

    // Validate required fields
    if (!request.requestId || request.requestId.length === 0) {
      errors.push("Request ID is required");
    }

    if (!request.requester?.id || request.requester.id.length === 0) {
      errors.push("Requester ID is required");
    }

    if (!request.category || request.category.length === 0) {
      errors.push("Category is required");
    }

    if (!request.fields || request.fields.length === 0) {
      errors.push("At least one field must be requested");
    }

    if (!request.purpose || request.purpose.length === 0) {
      errors.push("Purpose is required");
    }

    // Validate timestamps
    if (request.createdAt <= 0) {
      errors.push("Created timestamp must be positive");
    }

    if (request.expiresAt <= request.createdAt) {
      errors.push("Expiration must be after creation time");
    }

    if (Date.now() > request.expiresAt) {
      errors.push("Request has expired");
    }

    // Validate signature if provided
    if (request.signature && request.publicKey) {
      const signatureValid = this.validateSignature(request);
      if (!signatureValid) {
        errors.push("Invalid signature");
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Validate digital signature
   */
  private validateSignature(request: DataRequest): boolean {
    if (!request.signature || !request.publicKey) {
      return false;
    }

    try {
      // Create canonical representation for signing
      const canonical = this.canonicalizeRequest(request);

      const verify = crypto.createVerify("SHA256");
      verify.update(canonical);
      return verify.verify(request.publicKey, request.signature, "hex");
    } catch {
      return false;
    }
  }

  /**
   * Create canonical representation of request for signing
   */
  private canonicalizeRequest(request: DataRequest): string {
    return JSON.stringify({
      requestId: request.requestId,
      requester: request.requester,
      category: request.category,
      fields: request.fields.sort(),
      purpose: request.purpose,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    });
  }

  /**
   * Generate request ID
   */
  generateRequestId(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}
