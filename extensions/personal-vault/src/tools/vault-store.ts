import { Type } from "@sinclaw/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";

/**
 * VaultStore tool for storing personal data
 */
export function createVaultStoreTool(): AnyAgentTool {
  return {
    name: "VaultStore",
    description:
      "Store personal data securely in the encrypted vault. Supports medical records, employment history, identity documents, and financial information.",
    inputSchema: Type.Object({
      category: Type.String({
        description: "Data category (medical, employment, identity, financial)",
        enum: ["medical", "employment", "identity", "financial"],
      }),
      recordType: Type.String({
        description: "Specific type of record within the category",
      }),
      data: Type.Object({}, { additionalProperties: true }),
      attachments: Type.Optional(
        Type.Array(
          Type.Object({
            filename: Type.String(),
            contentType: Type.String(),
            data: Type.String({ description: "Base64-encoded file data" }),
          }),
        ),
      ),
      privacy: Type.Optional(
        Type.Object({
          shareable: Type.Boolean({ default: false }),
          restrictedFields: Type.Optional(Type.Array(Type.String())),
        }),
      ),
    }),
    execute: async (args: {
      category: string;
      recordType: string;
      data: Record<string, unknown>;
      attachments?: Array<{
        filename: string;
        contentType: string;
        data: string;
      }>;
      privacy?: {
        shareable: boolean;
        restrictedFields?: string[];
      };
    }) => {
      // Implementation would integrate with EncryptedVaultStorage
      return {
        result: "success",
        message: `Stored ${args.recordType} in ${args.category} category`,
        documentId: `${args.category}-${Date.now()}`,
      };
    },
  };
}
