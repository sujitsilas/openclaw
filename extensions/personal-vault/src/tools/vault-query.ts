import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";

/**
 * VaultQuery tool for searching vault contents
 */
export function createVaultQueryTool(): AnyAgentTool {
  return {
    name: "VaultQuery",
    description:
      "Query and search personal data in the vault. Returns metadata only (no sensitive data) without explicit approval.",
    inputSchema: Type.Object({
      category: Type.Optional(
        Type.String({
          description: "Filter by category",
          enum: ["medical", "employment", "identity", "financial"],
        }),
      ),
      recordType: Type.Optional(
        Type.String({ description: "Filter by record type" }),
      ),
      dateRange: Type.Optional(
        Type.Object({
          from: Type.Number({ description: "Start timestamp" }),
          to: Type.Number({ description: "End timestamp" }),
        }),
      ),
      searchQuery: Type.Optional(
        Type.String({ description: "Natural language search query" }),
      ),
    }),
    execute: async (args: {
      category?: string;
      recordType?: string;
      dateRange?: { from: number; to: number };
      searchQuery?: string;
    }) => {
      // Implementation would integrate with EncryptedVaultStorage
      // and return only metadata (not decrypted content)
      return {
        result: "success",
        matches: [
          {
            documentId: "medical-1234567890",
            category: "medical",
            recordType: "vaccination",
            created: Date.now() - 86400000,
            modified: Date.now() - 86400000,
          },
        ],
        count: 1,
      };
    },
  };
}
