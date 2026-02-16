import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";

/**
 * VaultApprove tool for approving/rejecting data requests
 */
export function createVaultApproveTool(): AnyAgentTool {
  return {
    name: "VaultApprove",
    description:
      "Approve or reject a pending data access request. Only the vault owner can perform this action.",
    inputSchema: Type.Object({
      requestId: Type.String({ description: "Request ID to process" }),
      approved: Type.Boolean({ description: "true to approve, false to reject" }),
      reason: Type.Optional(Type.String({ description: "Reason for decision" })),
      restrictions: Type.Optional(
        Type.Object({
          maxUses: Type.Optional(
            Type.Number({ description: "Maximum number of times data can be accessed" }),
          ),
          validHours: Type.Optional(
            Type.Number({ description: "Hours until access expires" }),
          ),
          allowedRecipients: Type.Optional(
            Type.Array(Type.String(), {
              description: "Specific recipients allowed to access",
            }),
          ),
        }),
      ),
    }),
    execute: async (args: {
      requestId: string;
      approved: boolean;
      reason?: string;
      restrictions?: {
        maxUses?: number;
        validHours?: number;
        allowedRecipients?: string[];
      };
    }) => {
      // Implementation would integrate with ApprovalWorkflow
      return {
        result: "success",
        requestId: args.requestId,
        status: args.approved ? "approved" : "rejected",
        approvedAt: Date.now(),
        restrictions: args.restrictions,
        message: args.approved
          ? "Request approved. Data package will be prepared for delivery."
          : `Request rejected. Reason: ${args.reason || "Not specified"}`,
      };
    },
  };
}
