# Quickstart Setup — Trustea

## Environment Variables Template

```env
# === Sui ===
SUI_NETWORK=testnet
SUI_PRIVATE_KEY=suiprivkey1...

# === Walrus ===
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# === Seal (Testnet — Decentralized Committee, recommended) ===
SEAL_KEY_SERVER_OBJECT_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
SEAL_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com
SEAL_PACKAGE_ID=0xdccbeb87767be2b2346af5575eb139807205e4c23ec53dc616f951fe1d814112

# === MemWal ===
MEMWAL_PRIVATE_KEY=<ed25519-delegate-key-hex>
MEMWAL_ACCOUNT_ID=0x<account-object-id>
MEMWAL_SERVER_URL=https://relayer-staging.memory.walrus.xyz
MEMWAL_PACKAGE_ID=0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6
MEMWAL_REGISTRY_ID=0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437

# === AI ===
ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY=sk-...
```

---

## Mainnet Package IDs (for final deployment)

```env
# Seal Mainnet
SEAL_PACKAGE_ID=0x931739224160073d8e391c9aa6e7ade9818e9814b4907066b7efa058636c4e45

# MemWal Mainnet
MEMWAL_PACKAGE_ID=0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6
MEMWAL_REGISTRY_ID=0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
```

---

## NPM Install

```bash
npm install @mysten/sui @mysten/dapp-kit @mysten/walrus @mysten/seal @mysten-incubation/memwal
npm install next react react-dom @radix-ui/themes
npm install @anthropic-ai/sdk  # or @ai-sdk/openai + ai
```

---

## MemWal Agent Setup (One-Time)

```typescript
import {
  generateDelegateKey,
  addDelegateKey,
  createAccount,
} from "@mysten-incubation/memwal/account";

// 1. Create MemWal account on Sui (owner wallet, one-time)
await createAccount({
  packageId: "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
  registryId: "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
  suiPrivateKey: "suiprivkey1...",  // owner wallet
});

// 2. Generate delegate key for the AI agent
const agentKey = await generateDelegateKey();
console.log("MEMWAL_PRIVATE_KEY:", agentKey.privateKey);  // save to .env

// 3. Register delegate key on-chain
await addDelegateKey({
  packageId: "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
  accountId: "0x<your-account-object-id>",  // from step 1
  publicKey: agentKey.publicKey,
  label: "Trustea Agent v1",
  suiPrivateKey: "suiprivkey1...",  // owner wallet
});

// 4. Use in app (no owner wallet needed)
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: "https://relayer-staging.memory.walrus.xyz",
  namespace: "trustea-agent",
});
```

---

## Seal Encrypt + Walrus Upload Pattern

```typescript
import { SealClient } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { fromHex, toHex } from "@mysten/sui/utils";

const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

const sealClient = new SealClient({
  suiClient,
  serverConfigs: [{
    objectId: "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98",
    aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com",
    weight: 1,
  }],
  verifyKeyServers: false,
});

// Encrypt
const nonce = crypto.getRandomValues(new Uint8Array(5));
const policyObjectBytes = fromHex(trustObjectId);
const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));

const { encryptedObject } = await sealClient.encrypt({
  threshold: 1,  // decentralized committee handles threshold internally
  packageId: TRUSTEA_PACKAGE_ID,
  id,
  data: new Uint8Array(documentBuffer),
});

// Upload encrypted blob to Walrus
const response = await fetch(
  `${WALRUS_PUBLISHER}/v1/blobs?epochs=52&deletable=false`,
  { method: "PUT", body: encryptedObject }
);
const result = await response.json();
const blobId = result.newlyCreated?.blobObject?.blobId
  ?? result.alreadyCertified?.blobId;
```

---

## Seal Decrypt Pattern (Frontend)

```typescript
import { SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";

// 1. Create session key
const sessionKey = await SessionKey.create({
  address: walletAddress,
  packageId: TRUSTEA_PACKAGE_ID,
  ttlMin: 10,
  suiClient,
});

// 2. User signs (wallet popup)
const message = sessionKey.getPersonalMessage();
const { signature } = await signPersonalMessage({ message });
sessionKey.setPersonalMessageSignature(signature);

// 3. Build seal_approve transaction
const tx = new Transaction();
tx.moveCall({
  target: `${TRUSTEA_PACKAGE_ID}::trust_seal::seal_approve`,
  arguments: [
    tx.pure.vector("u8", fromHex(id)),
    tx.object(trustObjectId),
  ],
});
const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

// 4. Decrypt (no gas spent — dry run only)
const decrypted = await sealClient.decrypt({
  data: encryptedBlob,
  sessionKey,
  txBytes,
});
```

---

## MemWal Agent Usage

```typescript
// Store trust decision
await memwal.rememberAndWait(
  "Trust #42: Alice turned 25 on 2026-06-01. Condition met. " +
  "Proposed distribution: 50,000 USDC. Override period: 7 days.",
  "trustea-agent",
  { timeoutMs: 30_000 }
);

// Recall before making a decision
const history = await memwal.recall({
  query: "Alice distribution history trust 42",
  namespace: "trustea-agent",
  limit: 10,
  maxDistance: 0.65,  // always filter — 0.7+ is noise
});

// Extract structured facts from longer text
const { facts } = await memwal.analyzeAndWait(
  "Trust #42 was created by John Smith on Jan 1, 2026. " +
  "Beneficiaries: Alice (age condition 25), Bob (university enrollment). " +
  "Total funds: 500,000 USDC. Risk tolerance: conservative.",
  "trustea-agent"
);
```

---

## MemWal Distance Reference
| Distance | Meaning |
|----------|---------|
| < 0.25 | Duplicate / near-exact |
| 0.25–0.55 | Related |
| 0.55–0.7 | Weak / noisy |
| >= 0.7 | Unrelated — filter out |

---

## Gotchas Cheat Sheet

| Gotcha | Fix |
|--------|-----|
| Walrus blobs are PUBLIC by default | Always Seal-encrypt before upload |
| `remember()` is async, not instant | Use `rememberAndWait()` if you need to recall immediately after |
| `remember()` is append-only, no upsert | Dedupe before storing |
| Seal server set is immutable after encryption | Don't mix testnet configs mid-project |
| Delegate keys are server-side only | Never expose MEMWAL_PRIVATE_KEY to browser |
| SessionKey TTL = 10 min default | Handle re-signing gracefully in UX |
| `seal_approve` is dry-run only | No gas spent, but must be side-effect-free |
| Testnet gets wiped | Don't rely on testnet data persisting |
| Single-commit repos = auto-DQ | Commit frequently from day 1 |
| Max 20 delegate keys per MemWal account | Plenty for hackathon |

---

## Move Contract Deploy

```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch main sui

# Build and publish Trustea contracts
cd contracts/
sui move build
sui client publish --gas-budget 100000000

# Note the package ID from output — use as TRUSTEA_PACKAGE_ID
```

---

## Walrus Sites Deploy (Frontend)

```bash
# Install site-builder
cargo install --git https://github.com/MystenLabs/walrus-sites.git site-builder

# Build frontend
cd frontend/ && npm run build

# Deploy to Walrus Sites
site-builder deploy ./out  # or ./dist for Vite

# Get your site URL
site-builder convert <OBJECT_ID>
# → <base36-id>.wal.app
```
