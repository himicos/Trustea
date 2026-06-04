# Walrus Technical Reference — Trustea Build

## Networks

| Network | Sui Chain | Status | Epoch Duration |
|---|---|---|---|
| **Mainnet** | Sui Mainnet | Live (since March 2025) | ~2 weeks |
| **Testnet** | Sui Testnet | Live | ~2 weeks (wiped periodically) |

### Endpoints
- **Testnet Aggregator** (read): `https://aggregator.walrus-testnet.walrus.space`
- **Testnet Publisher** (write): `https://publisher.walrus-testnet.walrus.space`
- **Mainnet Portal**: `https://wal.app`

---

## 1. Walrus Storage — HTTP API (Simplest Path)

### Store a Blob
```bash
# Store file for 5 epochs (~10 weeks)
curl -X PUT "$PUBLISHER/v1/blobs?epochs=5" --upload-file "trust-doc.pdf"

# Store as non-deletable (permanent for duration)
curl -X PUT "$PUBLISHER/v1/blobs?epochs=52&deletable=false" --upload-file "trust-doc.pdf"

# Store and send blob Sui object to specific address
curl -X PUT "$PUBLISHER/v1/blobs?send_object_to=$ADDRESS" --upload-file "file"
```
Returns JSON with `blobId`.

### Read a Blob
```bash
curl "$AGGREGATOR/v1/blobs/<BLOB_ID>" --output file.bin
```

---

## 2. TypeScript SDK — `@mysten/walrus`

```bash
npm install @mysten/walrus @mysten/sui
```

```typescript
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
const walrusClient = new WalrusClient({
  network: 'testnet',
  suiClient,
});

// Upload
const result = await walrusClient.writeBlob({
  blob: new Uint8Array(data),
  deletable: false,
  epochs: 52,
  signer: keypair,
});

// Download
const data = await walrusClient.readBlob({ blobId: 'xxx' });

// Multi-file upload (quilts)
await walrusClient.writeFiles(files, { epochs: 52, signer: keypair });
const files = await walrusClient.getFiles({ blobId: 'xxx' });
```

**Auth**: All writes require a Sui `Keypair` signer. Frontend: connect Sui wallet.

---

## 3. Seal — Encryption & Access Control

```bash
npm install @mysten/seal @mysten/sui
```

### How It Works
1. Encrypt data client-side (identity-based threshold encryption)
2. Decryption keys split across independent key servers (t-of-n threshold)
3. Access policy defined in a **Move smart contract** on Sui
4. Key servers check live Sui state against policy before releasing partial keys
5. Client reconstructs key and decrypts locally

### Access Policy Types (Move Contracts)
- **Address-based** — wallet owns specific object
- **NFT/token holder** — beneficiary holds the right NFT
- **Allowlist** — explicit list of addresses
- **Time-based** — unlock after timestamp ⭐ critical for trusts
- **Group/multisig** — multiple approvals required
- **Event-triggered** — custom on-chain event fires

### TypeScript Usage
```typescript
import { SealClient, SessionKey } from '@mysten/seal';

const sealClient = new SealClient({
  serverConfigs: [{ objectId: '<KEY_SERVER_ID>', weight: 1 }],
});

// Encrypt
const { encryptedObject } = await sealClient.seal.encrypt({
  threshold: 2,
  packageId: '<MOVE_PACKAGE_ID>',
  id: '<POLICY_ID>',
  data: new Uint8Array(trustDocument),
});

// Decrypt (requires wallet signature + policy check)
const sessionKey = new SessionKey({ ... });
await sessionKey.sign(wallet);
const plaintext = await sealClient.seal.decrypt({
  data: encryptedObject,
  sessionKey,
  txBytes, // PTB calling seal_approve from your Move contract
});
```

### For Large Files (Recommended for Trustea)
1. Generate AES-256 symmetric key
2. Encrypt document with AES
3. Encrypt AES key with Seal (policy-controlled)
4. Store AES ciphertext on Walrus
5. Store Seal-encrypted key reference in Sui Trust object

---

## 4. MemWal — AI Agent Persistent Memory (Beta)

```bash
npm install @mysten-incubation/oc-memwal
```

**What it is**: Encrypted, verifiable, semantically searchable memory for AI agents, stored on Walrus.

### Architecture
Relayer handles: embedding generation → Seal encryption → Walrus upload → vector indexing → semantic retrieval

### Core API
```typescript
// Store memory
await memwal.remember({
  content: "Beneficiary Alice turned 25, distribution approved",
  namespace: "trustea-agent"
});

// Bulk store (up to 20)
await memwal.rememberBulk([
  { content: "Trust #42 quarterly review completed" },
  { content: "Bob's university enrollment verified via soulbound NFT" }
]);

// Retrieve (semantic search)
const memories = await memwal.recall({
  query: "beneficiary distribution history",
  namespace: "trustea-agent",
  limit: 5,
  topK: 3,
  maxDistance: 0.8,
});
```

**Key**: `remember()` is async — embedding/encrypt/upload happens in background. Don't assume instant availability.

---

## 5. Walrus Sites — Decentralized Frontend Hosting

```bash
cargo install site-builder
site-builder deploy ./dist
```

- Static assets stored as quilts on Walrus
- Sui object maps paths → blob IDs
- Portal serves files to browsers: `<base36-object-id>.wal.app`
- No backend, no servers, censorship-resistant
- Perfect for Trustea frontend (SPA + Sui wallet interaction)

---

## 6. Storage Costs & Lifecycle

| Factor | Detail |
|---|---|
| Cost | ~$5/GB/epoch |
| Epoch | ~2 weeks |
| Max pre-purchase | ~2 years of epochs |
| Overhead | ~4.5-5x (Red Stuff erasure coding) |
| Renewal | Smart contracts can auto-extend with WAL funds |
| Deletable blobs | Can be removed early; burn Sui object to reclaim fee |
| Non-deletable | Permanent for prepaid duration |

### For Trustea
- Trust documents: `deletable: false`, fund a renewal contract with WAL for perpetual storage
- Agent memory: MemWal handles lifecycle
- Cost for a trust: probably pennies per document per year

---

## 7. Gotchas & Limitations

| Issue | Impact on Trustea | Mitigation |
|---|---|---|
| **Blobs are PUBLIC by default** | Trust docs exposed without encryption | Always encrypt via Seal before upload |
| **Epoch expiry = data loss** | Trust docs vanish if not renewed | Auto-renewal Sui contract funded with WAL |
| **MemWal is beta** | API may change | Use for demo, note as forward-looking |
| **Seal SessionKey TTL** | Decryption sessions expire | Handle re-signing in UX gracefully |
| **No byte-range reads** | Can't read partial blob | Use quilts for multi-doc structures |
| **Testnet wiped periodically** | Demo data lost | Demo on testnet, plan mainnet deploy |
| **WAL price volatility** | Storage cost unpredictable | Small data = negligible cost regardless |

---

## 8. Trustea Architecture Pattern

```
User (Frontend)
  ├── Creates trust rules (plain English)
  ├── AI translates → Move smart contract
  │
  ├── Trust Document (PDF/JSON)
  │   ├── AES-256 encrypt
  │   ├── Seal encrypt the AES key (policy: beneficiary + time + multisig)
  │   ├── Upload ciphertext → Walrus (deletable: false, epochs: 52)
  │   └── Store blobId + Seal key ref → Sui Trust Object
  │
  ├── Beneficiary NFTs
  │   └── Programmable Sui objects with embedded rules
  │
  ├── AI Trustee Agent
  │   ├── Monitors conditions (age, credentials, compliance)
  │   ├── Proposes distributions → logged on-chain
  │   ├── Active fund management (DeFi yield within risk bounds)
  │   └── Memory → MemWal (persistent across sessions)
  │
  └── Frontend → Walrus Sites (decentralized, no server)
```

### Sui Objects
- `Trust` — main object: rules, balances, beneficiary registry, Walrus blob refs
- `BeneficiaryNFT` — per-beneficiary: their rules, conditions, status
- `TrustAmendment` — logged changes to trust terms
- `AgentAction` — on-chain log of every AI agent decision

### Seal Policies (Move)
- `can_view_trust(beneficiary_address, trust_id)` — decrypt trust docs
- `can_release_funds(beneficiary_address, conditions_met)` — unlock distributions
- `can_amend_trust(grantor_address, trust_id)` — modify trust terms
