/**
 * Permission levels for data access
 */
export type PermissionLevel = "read" | "write" | "delete" | "share";

/**
 * Data access permission
 */
export type Permission = {
  category: string;
  fields?: string[];
  level: PermissionLevel[];
  conditions?: {
    timeRestriction?: {
      validFrom?: number;
      validUntil?: number;
    };
    usageLimit?: {
      maxUses: number;
      currentUses: number;
    };
    recipientRestriction?: {
      allowedRecipients: string[];
    };
    purposeRestriction?: {
      allowedPurposes: string[];
    };
  };
};

/**
 * Permission check result
 */
export type PermissionCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Permission engine for granular access control
 * Implements minimal disclosure and time-bound access
 */
export class PermissionEngine {
  private readonly permissions: Map<string, Permission[]> = new Map();

  /**
   * Grant permission to access data
   */
  grantPermission(userId: string, permission: Permission): void {
    const userPerms = this.permissions.get(userId) || [];
    userPerms.push(permission);
    this.permissions.set(userId, userPerms);
  }

  /**
   * Revoke permission
   */
  revokePermission(userId: string, category: string): boolean {
    const userPerms = this.permissions.get(userId);
    if (!userPerms) {
      return false;
    }

    const filtered = userPerms.filter((p) => p.category !== category);
    if (filtered.length === userPerms.length) {
      return false;
    }

    this.permissions.set(userId, filtered);
    return true;
  }

  /**
   * Check if user has permission to access data
   */
  checkPermission(
    userId: string,
    category: string,
    fields: string[],
    level: PermissionLevel,
    context?: {
      recipient?: string;
      purpose?: string;
    },
  ): PermissionCheckResult {
    const userPerms = this.permissions.get(userId);
    if (!userPerms || userPerms.length === 0) {
      return { allowed: false, reason: "No permissions granted" };
    }

    // Find matching permission
    const matchingPerm = userPerms.find((p) => p.category === category);
    if (!matchingPerm) {
      return { allowed: false, reason: "No permission for this category" };
    }

    // Check permission level
    if (!matchingPerm.level.includes(level)) {
      return { allowed: false, reason: `Permission level '${level}' not granted` };
    }

    // Check field restrictions
    if (matchingPerm.fields && matchingPerm.fields.length > 0) {
      const restrictedFields = fields.filter((f) => !matchingPerm.fields!.includes(f));
      if (restrictedFields.length > 0) {
        return {
          allowed: false,
          reason: `Access denied to fields: ${restrictedFields.join(", ")}`,
        };
      }
    }

    // Check conditions
    if (matchingPerm.conditions) {
      const conditionCheck = this.checkConditions(matchingPerm, context);
      if (!conditionCheck.allowed) {
        return conditionCheck;
      }
    }

    return { allowed: true };
  }

  /**
   * Check permission conditions
   */
  private checkConditions(
    permission: Permission,
    context?: {
      recipient?: string;
      purpose?: string;
    },
  ): PermissionCheckResult {
    const conditions = permission.conditions;
    if (!conditions) {
      return { allowed: true };
    }

    // Time restrictions
    if (conditions.timeRestriction) {
      const now = Date.now();
      if (conditions.timeRestriction.validFrom && now < conditions.timeRestriction.validFrom) {
        return { allowed: false, reason: "Permission not yet valid" };
      }
      if (conditions.timeRestriction.validUntil && now > conditions.timeRestriction.validUntil) {
        return { allowed: false, reason: "Permission has expired" };
      }
    }

    // Usage limit
    if (conditions.usageLimit) {
      if (conditions.usageLimit.currentUses >= conditions.usageLimit.maxUses) {
        return { allowed: false, reason: "Usage limit exceeded" };
      }
    }

    // Recipient restrictions
    if (conditions.recipientRestriction && context?.recipient) {
      if (!conditions.recipientRestriction.allowedRecipients.includes(context.recipient)) {
        return { allowed: false, reason: "Recipient not authorized" };
      }
    }

    // Purpose restrictions
    if (conditions.purposeRestriction && context?.purpose) {
      if (!conditions.purposeRestriction.allowedPurposes.includes(context.purpose)) {
        return { allowed: false, reason: "Purpose not authorized" };
      }
    }

    return { allowed: true };
  }

  /**
   * Record permission usage (for usage limits)
   */
  recordUsage(userId: string, category: string): boolean {
    const userPerms = this.permissions.get(userId);
    if (!userPerms) {
      return false;
    }

    const perm = userPerms.find((p) => p.category === category);
    if (!perm || !perm.conditions?.usageLimit) {
      return false;
    }

    perm.conditions.usageLimit.currentUses += 1;
    return true;
  }

  /**
   * Get all permissions for user
   */
  getUserPermissions(userId: string): Permission[] {
    return this.permissions.get(userId) || [];
  }

  /**
   * Clean up expired permissions
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [userId, perms] of this.permissions.entries()) {
      const validPerms = perms.filter((p) => {
        const timeRestriction = p.conditions?.timeRestriction;
        if (timeRestriction?.validUntil && now > timeRestriction.validUntil) {
          cleaned++;
          return false;
        }
        return true;
      });

      this.permissions.set(userId, validPerms);
    }

    return cleaned;
  }
}
