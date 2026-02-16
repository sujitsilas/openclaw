# Personal Vault Architecture

## Overview

The Personal Vault extension provides a secure, encrypted storage system for personal data with granular access control, approval workflows, and multi-factor authentication. It's designed as a modular OpenClaw extension that integrates seamlessly with the existing agent and messaging infrastructure.

## Design Principles

1. **Security First**: Enterprise-grade encryption (AES-256-GCM) with defense in depth
2. **Privacy by Design**: Data minimization, consent management, and revocable access
3. **Zero Trust**: Every access requires authentication and authorization
4. **Audit Everything**: Immutable logs for all operations
5. **Modular Architecture**: Clean separation of concerns for maintainability

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WhatsApp    │  │   Telegram   │  │    Slack     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Personal Vault Extension                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Agent Tools Layer                        │   │
│  │  • VaultStore  • VaultQuery   • VaultRequest        │   │
│  │  • VaultApprove • VaultAudit  • VaultPackage        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Core Services Layer                       │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ Encrypted    │  │     Auth     │                │   │
│  │  │   Storage    │  │   Manager    │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │  Approval    │  │  Permission  │                │   │
│  │  │  Workflow    │  │    Engine    │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │     Data     │  │   Secure     │                │   │
│  │  │   Packager   │  │  Transport   │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Data Storage Layer                         │   │
│  │                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Medical  │  │Employment│  │ Identity │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  │                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │Financial │  │   Audit  │  │   Auth   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Encrypted Storage Layer

**Purpose**: Secure storage with document-level encryption

**Key Components**:
- `EncryptedVaultStorage`: Main storage interface
- Per-document encryption with unique IVs
- Metadata indexing for searchability without decryption
- Secure deletion with data overwriting

**Security Features**:
- AES-256-GCM encryption
- Document-specific key derivation
- Authentication tags for tamper detection
- File permissions (0600) for access control

**Data Flow**:
```
Plain Data → Key Derivation → Encryption → Authenticated Ciphertext → Disk
```

### 2. Authentication Manager

**Purpose**: Multi-factor authentication and session management

**Supported Factors**:
1. **Passphrase**: Scrypt-derived key with salt
2. **Device**: RSA signature verification
3. **Biometric**: Platform integration (iOS/Android)
4. **Hardware Key**: FIDO2/WebAuthn support

**Session Management**:
- Time-bound sessions (24h default)
- Factor tracking for audit
- Device authorization registry
- Automatic cleanup of expired sessions

### 3. Access Control Layer

#### Request Validator
- Digital signature verification
- Expiration checking
- Request integrity validation
- Canonical representation for signing

#### Approval Workflow
- Request submission and tracking
- Multi-level approval support
- Time-bound permissions
- Usage limits and tracking

#### Permission Engine
- Field-level access control
- Condition-based permissions
- Time restrictions
- Recipient restrictions
- Purpose restrictions

### 4. Delivery System

#### Data Packager
- Encrypted package creation
- Digital signing for tamper-evidence
- Watermarking for leak tracking
- Field filtering for minimal disclosure

#### Secure Transport
- Multiple delivery methods:
  - **Portal**: Secure web access with tokens
  - **Email**: Encrypted attachments with access links
  - **API**: Programmatic access with mutual TLS
  - **Channel**: Integration with OpenClaw messaging

**Package Lifecycle**:
```
Data Request → Approval → Filtering → Encryption → Signing → Delivery → Access
```

## Data Schemas

### Medical Records
```json
{
  "recordType": "vaccination|prescription|lab-result|diagnosis",
  "patient": { "name", "dateOfBirth", "mrn" },
  "provider": { "name", "facility", "npi" },
  "attachments": [...],
  "privacy": { "shareable", "restrictedFields" }
}
```

### Employment Records
```json
{
  "recordType": "employment-history|certification|background-check",
  "employer": { "name", "industry", "location" },
  "position": { "title", "startDate", "current" },
  "compensation": { "salary", "currency", "benefits" },
  "privacy": { "shareable", "restrictedFields" }
}
```

### Identity Documents
```json
{
  "recordType": "passport|drivers-license|national-id",
  "personal": { "fullName", "dateOfBirth", "nationality" },
  "document": { "number", "expirationDate" },
  "attachments": [...],
  "privacy": { "verificationOnly", "restrictedFields" }
}
```

### Financial Records
```json
{
  "recordType": "bank-account|tax-return|investment",
  "institution": { "name", "type" },
  "account": { "accountNumber", "accountType", "status" },
  "privacy": { "verificationOnly", "restrictedFields" }
}
```

## Security Architecture

### Encryption Layers

```
┌─────────────────────────────────────┐
│     Application Layer               │
│  Plain text data + metadata         │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│     Document Encryption             │
│  AES-256-GCM + unique IV            │
│  Per-document key derivation        │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│     Transport Encryption            │
│  TLS 1.3 + ephemeral keys           │
│  Package encryption for delivery    │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│     Storage Encryption              │
│  File permissions (0600)            │
│  Encrypted filesystem (optional)    │
└─────────────────────────────────────┘
```

### Key Management

```
User Passphrase
      │
      ▼
Key Derivation (Scrypt/Argon2)
      │
      ├──────────────────────┐
      ▼                      ▼
Master Key           Document Salt
      │                      │
      ▼                      ▼
Document Key Derivation (PBKDF2)
      │
      ▼
Document Encryption Key
      │
      ▼
AES-256-GCM Encryption
```

### Access Control Flow

```
Request → Validation → Authentication → Authorization → Approval → Delivery
   │           │              │               │            │          │
   ▼           ▼              ▼               ▼            ▼          ▼
Signature   Expiry      MFA Check    Permission     Owner      Package
  Check      Check                     Check       Approval   Creation
```

## Audit & Compliance

### Audit Events
- All access requests (approved/rejected)
- All data retrievals
- All package deliveries
- Authentication attempts
- Permission changes
- Token usage

### Audit Log Structure
```json
{
  "eventId": "unique-id",
  "timestamp": "ISO-8601",
  "eventType": "request|approval|delivery|access",
  "actor": { "userId", "deviceId" },
  "resource": { "category", "fields" },
  "outcome": "success|failure",
  "metadata": { "ip", "reason", "restrictions" }
}
```

### Compliance Features

**GDPR**:
- Right to access (query tools)
- Right to erasure (secure deletion)
- Consent management (approval workflow)
- Data portability (export functions)

**HIPAA**:
- Encryption at rest and in transit
- Access control and audit logs
- Minimum necessary disclosure
- Business associate agreements (BAA) support

**CCPA**:
- Personal information inventory
- Disclosure tracking
- Opt-out mechanisms
- Data deletion on request

## Performance Considerations

### Optimization Strategies

1. **Metadata Caching**: Index encrypted documents by metadata
2. **Lazy Loading**: Only decrypt when accessed
3. **Batch Operations**: Group requests for efficiency
4. **Connection Pooling**: Reuse transport connections

### Scalability

- **Horizontal**: Multiple vault instances per user
- **Vertical**: Separate hot/cold storage tiers
- **Partitioning**: Category-based storage separation

## Integration with OpenClaw

### Agent Tools
- Natural language interface to vault operations
- Context-aware field suggestions
- Intelligent approval recommendations

### Gateway Integration
- WebSocket-based real-time notifications
- Channel delivery integration
- Authentication session sharing

### Extension Points
- Custom data categories
- Additional delivery methods
- Third-party auth providers
- Compliance modules

## Future Enhancements

1. **Zero-Knowledge Proofs**: Verify data without exposing it
2. **Blockchain Anchoring**: Immutable audit trail timestamps
3. **Federated Identity**: SSO integration
4. **Machine Learning**: Anomaly detection for security
5. **Mobile Biometrics**: Face ID / Touch ID integration
6. **Hardware Security Modules**: HSM key storage

## Testing Strategy

### Unit Tests
- Encryption/decryption correctness
- Authentication factor validation
- Permission engine logic
- Package integrity

### Integration Tests
- End-to-end request flows
- Multi-factor authentication
- Package delivery methods
- Audit log generation

### Security Tests
- Tamper detection
- Signature verification
- Access control bypass attempts
- Session hijacking prevention

## Deployment

### Requirements
- Node.js ≥22
- File system with ACL support
- TLS certificates (for remote access)
- Sufficient entropy for key generation

### Configuration
```json
{
  "vaultDir": "~/.openclaw/vault",
  "encryptionAlgorithm": "aes-256-gcm",
  "keyDerivation": "argon2id",
  "mfaRequired": true,
  "auditLogging": true,
  "maxRequestAge": 3600000,
  "autoExpireTokens": true
}
```

### Monitoring
- Access attempt rates
- Failed authentication counts
- Expired token cleanup
- Storage utilization

## Conclusion

The Personal Vault extension provides a production-ready, security-focused solution for managing sensitive personal data. Its modular architecture, comprehensive audit trail, and flexible access control make it suitable for both individual users and enterprise deployments requiring GDPR, HIPAA, or CCPA compliance.
