import fs from "node:fs";
import path from "node:path";
import type { DataRequest } from "./request-validator.js";

/**
 * Approval status
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

/**
 * Data access approval
 */
export type DataApproval = {
  requestId: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  reason?: string;
  restrictions?: {
    maxUses?: number;
    usesRemaining?: number;
    validUntil?: number;
    allowedRecipients?: string[];
  };
};

/**
 * Approval decision
 */
export type ApprovalDecision = {
  approved: boolean;
  reason?: string;
  restrictions?: DataApproval["restrictions"];
};

/**
 * Approval workflow result
 */
export type ApprovalResult =
  | { ok: true; approval: DataApproval }
  | { ok: false; error: string };

/**
 * Approval workflow manager
 * Handles request approval, rejection, and access control
 */
export class ApprovalWorkflow {
  private readonly vaultDir: string;
  private readonly pendingRequests: Map<string, DataRequest> = new Map();
  private readonly approvals: Map<string, DataApproval> = new Map();

  constructor(vaultDir: string) {
    this.vaultDir = vaultDir;
    this.ensureWorkflowDirectory();
    this.loadState();
  }

  /**
   * Submit request for approval
   */
  async submitRequest(request: DataRequest): Promise<ApprovalResult> {
    if (this.pendingRequests.has(request.requestId)) {
      return { ok: false, error: "Request already exists" };
    }

    if (this.approvals.has(request.requestId)) {
      return { ok: false, error: "Request already processed" };
    }

    // Check if expired
    if (Date.now() > request.expiresAt) {
      return { ok: false, error: "Request has expired" };
    }

    this.pendingRequests.set(request.requestId, request);

    const approval: DataApproval = {
      requestId: request.requestId,
      status: "pending",
    };

    this.approvals.set(request.requestId, approval);
    await this.saveState();

    return { ok: true, approval };
  }

  /**
   * Approve data request
   */
  async approveRequest(
    requestId: string,
    approvedBy: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalResult> {
    const request = this.pendingRequests.get(requestId);
    const approval = this.approvals.get(requestId);

    if (!request || !approval) {
      return { ok: false, error: "Request not found" };
    }

    if (approval.status !== "pending") {
      return { ok: false, error: "Request already processed" };
    }

    // Check if expired
    if (Date.now() > request.expiresAt) {
      approval.status = "expired";
      await this.saveState();
      return { ok: false, error: "Request has expired" };
    }

    if (decision.approved) {
      approval.status = "approved";
      approval.approvedBy = approvedBy;
      approval.approvedAt = Date.now();
      approval.restrictions = decision.restrictions;
    } else {
      approval.status = "rejected";
      approval.rejectedBy = approvedBy;
      approval.rejectedAt = Date.now();
      approval.reason = decision.reason;
    }

    this.pendingRequests.delete(requestId);
    await this.saveState();

    return { ok: true, approval };
  }

  /**
   * Reject data request
   */
  async rejectRequest(
    requestId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<ApprovalResult> {
    return this.approveRequest(requestId, rejectedBy, {
      approved: false,
      reason,
    });
  }

  /**
   * Get approval status
   */
  getApproval(requestId: string): DataApproval | null {
    return this.approvals.get(requestId) || null;
  }

  /**
   * Get pending request
   */
  getPendingRequest(requestId: string): DataRequest | null {
    return this.pendingRequests.get(requestId) || null;
  }

  /**
   * List all pending requests
   */
  listPendingRequests(): DataRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * List all approvals with optional status filter
   */
  listApprovals(status?: ApprovalStatus): DataApproval[] {
    const approvals = Array.from(this.approvals.values());
    if (status) {
      return approvals.filter((a) => a.status === status);
    }
    return approvals;
  }

  /**
   * Check if request can be fulfilled
   */
  canFulfillRequest(requestId: string): boolean {
    const approval = this.approvals.get(requestId);
    if (!approval || approval.status !== "approved") {
      return false;
    }

    // Check restrictions
    if (approval.restrictions) {
      if (approval.restrictions.validUntil && Date.now() > approval.restrictions.validUntil) {
        return false;
      }

      if (approval.restrictions.usesRemaining !== undefined && approval.restrictions.usesRemaining <= 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record request fulfillment
   */
  async recordFulfillment(requestId: string): Promise<boolean> {
    const approval = this.approvals.get(requestId);
    if (!approval) {
      return false;
    }

    if (approval.restrictions?.usesRemaining !== undefined) {
      approval.restrictions.usesRemaining -= 1;
      await this.saveState();
    }

    return true;
  }

  /**
   * Revoke approval
   */
  async revokeApproval(requestId: string, reason: string): Promise<boolean> {
    const approval = this.approvals.get(requestId);
    if (!approval) {
      return false;
    }

    approval.status = "rejected";
    approval.reason = reason;
    this.pendingRequests.delete(requestId);
    await this.saveState();

    return true;
  }

  /**
   * Clean up expired requests
   */
  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    // Expire pending requests
    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (now > request.expiresAt) {
        const approval = this.approvals.get(requestId);
        if (approval) {
          approval.status = "expired";
        }
        this.pendingRequests.delete(requestId);
        cleaned++;
      }
    }

    // Expire approvals with time restrictions
    for (const approval of this.approvals.values()) {
      if (
        approval.status === "approved" &&
        approval.restrictions?.validUntil &&
        now > approval.restrictions.validUntil
      ) {
        approval.status = "expired";
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveState();
    }

    return cleaned;
  }

  /**
   * Ensure workflow directory exists
   */
  private ensureWorkflowDirectory(): void {
    const workflowDir = path.join(this.vaultDir, ".workflow");
    fs.mkdirSync(workflowDir, { recursive: true, mode: 0o700 });
  }

  /**
   * Load workflow state from disk
   */
  private loadState(): void {
    const stateFile = path.join(this.vaultDir, ".workflow", "state.json");
    if (!fs.existsSync(stateFile)) {
      return;
    }

    try {
      const raw = fs.readFileSync(stateFile, "utf-8");
      const state = JSON.parse(raw);

      this.pendingRequests.clear();
      this.approvals.clear();

      for (const request of state.pendingRequests || []) {
        this.pendingRequests.set(request.requestId, request);
      }

      for (const approval of state.approvals || []) {
        this.approvals.set(approval.requestId, approval);
      }
    } catch {
      // Ignore errors, start fresh
    }
  }

  /**
   * Save workflow state to disk
   */
  private async saveState(): Promise<void> {
    const stateFile = path.join(this.vaultDir, ".workflow", "state.json");
    const state = {
      pendingRequests: Array.from(this.pendingRequests.values()),
      approvals: Array.from(this.approvals.values()),
    };

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
}
