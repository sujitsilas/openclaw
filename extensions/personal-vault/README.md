# Personal Vault Extension for OpenClaw

Secure encrypted personal data vault with granular access control, approval workflows, and multi-factor authentication.

## Features

### 🔐 **Enterprise-Grade Encryption**
- AES-256-GCM encryption at rest
- Per-document encryption keys
- Secure key derivation (scrypt/argon2id)
- Forward secrecy for data transmission

### 🔑 **Multi-Factor Authentication**
- Passphrase authentication
- Device pairing with digital signatures
- Biometric integration support
- Hardware key (FIDO2) support

### 📋 **Structured Data Management**
- **Medical Records**: Vaccinations, prescriptions, lab results, diagnoses
- **Employment History**: Contracts, performance reviews, certifications
- **Identity Documents**: Passports, licenses, national IDs
- **Financial Records**: Bank accounts, tax returns, investments

### ✅ **Approval Workflows**
- Request-based access control
- Time-bound permissions
- Usage limits
- Granular field-level access

### 📦 **Secure Delivery**
- Encrypted data packages
- Digital signatures for tamper-evidence
- Multiple delivery methods (portal, email, API, messaging)
- Watermarking for leak tracing

### 📊 **Audit Logging**
- Immutable audit trail
- All access attempts logged
- Compliance-ready reporting
- Breach detection

## Installation

```bash
cd extensions/personal-vault
pnpm install
pnpm build
```

## Quick Start

### Initialize Vault

```typescript
import { PersonalVault } from "@openclaw/personal-vault";

const vault = new PersonalVault("~/.openclaw/vault", "https://your-domain.com");
await vault.initialize("your-secure-passphrase");
```

### Store Medical Record

```typescript
const storage = vault.getStorage();
const result = await storage.storeDocument("medical", "vax-covid-1", {
  recordType: "vaccination",
  vaccine: "COVID-19",
  manufacturer: "Pfizer",
  dose: 1,
  administeredDate: "2024-01-15",
  patient: {
    name: "John Doe",
    dateOfBirth: "1990-01-01",
  },
});
```

### Request Data Access

```typescript
const workflow = vault.getApprovalWorkflow();
await workflow.submitRequest({
  requestId: "req-123",
  requester: {
    id: "employer-abc",
    name: "ABC Company",
    email: "hr@abc.com",
  },
  category: "medical",
  fields: ["vaccination"],
  purpose: "Employment verification",
  createdAt: Date.now(),
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
});
```

### Approve Request

```typescript
await workflow.approveRequest("req-123", "owner", {
  approved: true,
  restrictions: {
    maxUses: 1,
    validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
});
```

### Create Secure Package

```typescript
const packager = vault.getDataPackager();
const pkg = await packager.createPackage(
  "req-123",
  "hr@abc.com",
  "medical",
  ["vaccination"],
  { /* data */ },
  {
    expirationMinutes: 60,
    oneTimeUse: true,
    watermark: true,
  },
);
```

### Deliver Package

```typescript
const transport = vault.getSecureTransport();
const delivery = await transport.deliverPackage(pkg.value, {
  method: "portal",
  recipient: "hr@abc.com",
  expirationMinutes: 60,
});

console.log(`Access URL: ${delivery.accessUrl}`);
```

## Agent Tools

The vault provides OpenClaw agent tools for natural language interaction:

### VaultStore
```
Store my COVID vaccination record from 2024-01-15, manufacturer Pfizer, dose 1
```

### VaultQuery
```
What medical records do I have from the last year?
```

### VaultRequest
```
Create a data request for ABC Company to access my vaccination records for employment verification
```

### VaultApprove
```
Approve request req-123 with one-time use restriction
```

### VaultAudit
```
Show me all vault access attempts from the last month
```

## CLI Commands

```bash
# Store data
openclaw vault store --category medical --file vaccination-record.json

# Query vault
openclaw vault query --category medical --record-type vaccination

# List pending requests
openclaw vault requests --status pending

# Approve request
openclaw vault approve --request-id req-123 --max-uses 1

# View audit log
openclaw vault audit --since 2024-01-01
```

## Data Schemas

Each category has a JSON Schema defining required and optional fields:

- `medical.schema.json` - Medical and health records
- `employment.schema.json` - Employment and professional information
- `identity.schema.json` - Identity documents
- `financial.schema.json` - Financial records

## Security Architecture

### Encryption Layers

1. **At-Rest**: AES-256-GCM with per-document keys
2. **In-Transit**: TLS 1.3 with ephemeral key exchange
3. **Key Derivation**: Scrypt/Argon2id from user passphrase

### Access Control

1. **Authentication**: Multi-factor (passphrase + device/biometric)
2. **Authorization**: Role-based + permission engine
3. **Audit**: Immutable append-only logs

### Privacy Features

- **Data Minimization**: Only requested fields shared
- **Consent Management**: Explicit approval required
- **Revocable Access**: Tokens can be revoked anytime
- **Watermarking**: Track data leaks

## Compliance

Designed for compliance with:
- **GDPR**: Right to access, right to erasure, consent management
- **HIPAA**: Medical data encryption and audit logging
- **CCPA**: Personal information protection

## Development

### Run Tests

```bash
pnpm test
```

### Type Check

```bash
pnpm build
```

### Watch Mode

```bash
pnpm dev
```

## Architecture

```
personal-vault/
├── src/
│   ├── storage/          # Encrypted storage layer
│   ├── auth/             # Authentication & MFA
│   ├── access/           # Access control & workflows
│   ├── delivery/         # Secure packaging & delivery
│   ├── tools/            # OpenClaw agent tools
│   └── schemas/          # Data schemas
├── openclaw.plugin.json  # Plugin configuration
└── package.json
```

## Contributing

See the main [OpenClaw contributing guide](../../CONTRIBUTING.md).

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- Documentation: https://docs.openclaw.ai
- Discord: https://discord.gg/clawd
- Issues: https://github.com/openclaw/openclaw/issues
