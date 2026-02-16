/**
 * Basic usage example for Personal Vault extension
 */

import { PersonalVault } from "../src/index.js";

async function main() {
  // Initialize vault
  console.log("Initializing Personal Vault...");
  const vault = new PersonalVault(
    "~/.openclaw/vault",
    "https://your-domain.com",
  );

  await vault.initialize("your-secure-passphrase");
  console.log("✓ Vault initialized");

  // 1. Store medical record
  console.log("\n1. Storing medical record...");
  const storage = vault.getStorage();
  const medicalData = {
    recordType: "vaccination",
    date: new Date().toISOString(),
    patient: {
      name: "John Doe",
      dateOfBirth: "1990-01-01",
    },
    vaccination: {
      vaccine: "COVID-19",
      manufacturer: "Pfizer",
      dose: 1,
      administeredDate: "2024-01-15",
    },
  };

  const storeResult = await storage.storeDocument(
    "medical",
    "vax-covid-1",
    JSON.stringify(medicalData),
  );
  console.log("✓ Medical record stored:", storeResult);

  // 2. Create user authentication
  console.log("\n2. Creating user authentication...");
  const authManager = vault.getAuthManager();
  const authResult = await authManager.createUser(
    "user-123",
    "user-passphrase",
    true, // MFA enabled
  );
  console.log("✓ User created:", authResult);

  // 3. Submit data access request
  console.log("\n3. Submitting data access request...");
  const workflow = vault.getApprovalWorkflow();
  const request = {
    requestId: "req-" + Date.now(),
    requester: {
      id: "employer-abc",
      name: "ABC Company",
      email: "hr@abc.com",
      organization: "ABC Corp",
    },
    category: "medical",
    fields: ["vaccination"],
    purpose: "Employment verification - pre-hire screening",
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const submitResult = await workflow.submitRequest(request);
  console.log("✓ Request submitted:", submitResult);

  // 4. Approve request with restrictions
  console.log("\n4. Approving request...");
  if (submitResult.ok) {
    const approvalResult = await workflow.approveRequest(
      request.requestId,
      "owner",
      {
        approved: true,
        restrictions: {
          maxUses: 1,
          usesRemaining: 1,
          validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          allowedRecipients: ["hr@abc.com"],
        },
      },
    );
    console.log("✓ Request approved:", approvalResult);

    // 5. Create secure data package
    console.log("\n5. Creating secure data package...");
    const packager = vault.getDataPackager();
    const packageResult = await packager.createPackage(
      request.requestId,
      "hr@abc.com",
      "medical",
      ["vaccination"],
      medicalData,
      {
        expirationMinutes: 60,
        oneTimeUse: true,
        watermark: true,
      },
    );
    console.log("✓ Package created:", packageResult);

    // 6. Deliver package via secure portal
    console.log("\n6. Delivering package...");
    if (packageResult.ok) {
      const transport = vault.getSecureTransport();
      const deliveryResult = await transport.deliverPackage(packageResult.value, {
        method: "portal",
        recipient: "hr@abc.com",
        expirationMinutes: 60,
      });
      console.log("✓ Package delivered:", deliveryResult);

      if (deliveryResult.success) {
        console.log("\n📦 Delivery Details:");
        console.log(`   Access URL: ${deliveryResult.accessUrl}`);
        console.log(`   Encryption Key: ${deliveryResult.encryptionKey}`);
        console.log(`   Delivery ID: ${deliveryResult.deliveryId}`);
      }
    }
  }

  // 7. List pending requests
  console.log("\n7. Listing pending requests...");
  const pending = workflow.listPendingRequests();
  console.log("✓ Pending requests:", pending.length);

  // 8. Query stored documents
  console.log("\n8. Querying stored documents...");
  const documents = await storage.listDocuments("medical");
  console.log("✓ Medical documents:", documents);

  console.log("\n✅ All operations completed successfully!");
}

// Run example
main().catch(console.error);
