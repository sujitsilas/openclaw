import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";

/**
 * VaultRequest tool for submitting data access requests
 */
export function createVaultRequestTool(): AnyAgentTool {
  return {
    name: "VaultRequest",
    description:
      "Submit a request for accessing personal data. Requires approval before data can be accessed.",
    inputSchema: Type.Object({
      requester: Type.Object({
        id: Type.String(),
        name: Type.String(),
        email: Type.Optional(Type.String({ format: "email" })),
        organization: Type.Optional(Type.String()),
      }),
      category: Type.String({
        description: "Category of data requested",
        enum: ["medical", "employment", "identity", "financial"],
      }),
      fields: Type.Array(Type.String(), {
        description: "Specific fields requested (use '*' for all)",
      }),
      purpose: Type.String({ description: "Reason for data request" }),
      expirationHours: Type.Optional(
        Type.Number({ description: "Request expiration in hours", default: 24 }),
      ),
    }),
    execute: async (args: {
      requester: {
        id: string;
        name: string;
        email?: string;
        organization?: string;
      };
      category: string;
      fields: string[];
      purpose: string;
      expirationHours?: number;
    }) => {
      // Implementation would integrate with ApprovalWorkflow
      const requestId = `req-${Date.now()}`;
      const expiresAt = Date.now() + (args.expirationHours || 24) * 60 * 60 * 1000;

      return {
        result: "success",
        requestId,
        status: "pending",
        expiresAt,
        message:
          "Request submitted for approval. You will be notified when it is processed.",
      };
    },
  };
}
