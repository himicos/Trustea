# Tech Stack — Trustea

## Decision: LOCKED

---

## Core Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Smart Contracts** | Sui Move | Trust logic, beneficiary NFTs, conditional fund release, Seal access policies |
| **Storage** | Walrus (blobs) | Trust documents, amendments, audit trail — persistent, verifiable, decentralized |
| **Encryption** | Seal | Privacy layer — trust data encrypted, policy-controlled decryption via Move contracts |
| **Agent Memory** | MemWal | AI agent persistent memory across sessions — decision history, compliance logs |
| **Frontend** | Next.js / React + @mysten/dapp-kit | Dashboard, trust creation wizard, beneficiary views |
| **AI Agent** | Claude API (or OpenAI) + custom orchestration | Rule translation, condition monitoring, fund management proposals |
| **Hosting** | Walrus Sites (site-builder) | Decentralized frontend — censorship-resistant, persistent |
| **Wallet** | Sui Wallet / Slipway via @mysten/dapp-kit | User auth, tx signing |

---

## NPM Dependencies

```json
{
  "@mysten/sui": "latest",
  "@mysten/dapp-kit": "latest",
  "@mysten/walrus": "latest",
  "@mysten/seal": "latest",
  "@mysten-incubation/oc-memwal": "latest",
  "next": "14.x",
  "react": "18.x",
  "@radix-ui/themes": "latest",
  "@anthropic-ai/sdk": "latest"
}
```

---

## Reference Repos (Forked to himicos/)

| Repo | What We Use It For | Local Path |
|------|-------------------|------------|
| **[himicos/MemWal](https://github.com/himicos/MemWal)** | Agent memory SDK, sample apps (chatbot, noter, researcher) | `_ref/MemWal/` |
| **[himicos/seal](https://github.com/himicos/seal)** | Move access control patterns, frontend encrypt/upload example | `_ref/seal/` |
| **[himicos/walrus-sites](https://github.com/himicos/walrus-sites)** | Site builder CLI, deployment config | `_ref/walrus-sites/` |

---

## Seal Move Patterns We'll Use

### From `_ref/seal/move/patterns/sources/`:

| Pattern | File | Trustea Use Case |
|---------|------|-----------------|
| **Whitelist** | `whitelist.move` | Beneficiary access list — only whitelisted addresses can decrypt trust docs |
| **Time Lock** | `tle.move` | Time-based conditions — "release after timestamp T" (age, death, milestone) |
| **Private Data** | `private_data.move` | Owner-only encrypted data — grantor's private trust configuration |

### From `_ref/seal/examples/move/sources/`:

| Pattern | File | Trustea Use Case |
|---------|------|-----------------|
| **Allowlist** | `allowlist.move` | Full allowlist with admin Cap — grantor manages beneficiary access |
| **Subscription** | `subscription.move` | Time-bounded access with fee — potential for trustee-as-a-service model |

### Trustea's Custom Seal Policy (to build)
Combine whitelist + time lock + NFT ownership check:
```
seal_approve checks:
1. Is caller in the trust's beneficiary whitelist? (whitelist pattern)
2. Has the time condition been met? (tle pattern)
3. Does caller hold the specific BeneficiaryNFT? (custom check)
→ If all pass, decrypt trust document / release funds
```

---

## Key Code Patterns from Reference Repos

### Encrypt + Upload to Walrus (from Seal frontend example)
```typescript
// 1. Create SealClient
const client = new SealClient({
  suiClient,
  serverConfigs: [{
    objectId: DECENTRALIZED_KEY_SERVER_OBJ_ID,
    weight: 1,
    aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
  }],
  verifyKeyServers: false,
});

// 2. Encrypt data with policy
const nonce = crypto.getRandomValues(new Uint8Array(5));
const policyObjectBytes = fromHex(policyObject);
const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
const { encryptedObject } = await client.encrypt({
  threshold: 1,
  packageId,
  id,
  data: new Uint8Array(fileBuffer),
});

// 3. Upload encrypted blob to Walrus
const response = await fetch(`${publisherUrl}/v1/blobs?epochs=52`, {
  method: 'PUT',
  body: encryptedBytes.slice(),
});
const { blobId } = await response.json();

// 4. Associate blob with Sui object (Move call)
const tx = new Transaction();
tx.moveCall({
  target: `${packageId}::allowlist::publish`,
  arguments: [tx.object(trustId), tx.object(capId), tx.pure.string(blobId)],
});
```

### MemWal Agent Memory
```typescript
// Store decision
await memwal.remember({
  content: "Trust #42: Alice's age condition met (turned 25 on 2026-06-01). Proposed distribution of 50,000 USDC. Awaiting grantor override period.",
  namespace: "trustea-agent"
});

// Recall relevant history
const history = await memwal.recall({
  query: "Alice distribution history trust 42",
  namespace: "trustea-agent",
  limit: 10,
  topK: 5,
});
```

### Seal Access Control in Move (whitelist pattern)
```move
entry fun seal_approve(id: vector<u8>, wl: &Whitelist, ctx: &TxContext) {
    assert!(check_policy(ctx.sender(), id, wl), ENoAccess);
}
// Checks: Is caller whitelisted? Does ID match trust prefix?
```

### Time Lock in Move
```move
entry fun seal_approve(id: vector<u8>, c: &clock::Clock) {
    // Decode timestamp from id, check clock >= timestamp
    assert!(check_policy(id, c), ENoAccess);
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Walrus Sites                       │
│              (Decentralized Frontend)                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Next.js App                                         │
│  ├── Trust Creation Wizard (plain English → rules)   │
│  ├── Dashboard (trusts, beneficiaries, activity)     │
│  ├── Beneficiary View (my NFTs, my conditions)       │
│  └── Agent Activity Log                              │
│                                                      │
├──────────────┬──────────────┬───────────────────────┤
│  @mysten/    │  @mysten/    │  @mysten/             │
│  dapp-kit    │  seal        │  walrus               │
│  (wallet)    │  (encrypt)   │  (storage)            │
├──────────────┴──────────────┴───────────────────────┤
│                                                      │
│  Sui Move Contracts                                  │
│  ├── trustea::trust      (Trust object, rules, $)    │
│  ├── trustea::beneficiary (NFTs with embedded rules) │
│  ├── trustea::seal_policy (whitelist + time lock)    │
│  └── trustea::agent       (action logging on-chain)  │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Walrus Layer                                        │
│  ├── Trust documents (encrypted via Seal)            │
│  ├── Amendments & audit trail                        │
│  └── Agent memory (via MemWal)                       │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  AI Trustee Agent                                    │
│  ├── Claude/OpenAI for NLP (rule translation)        │
│  ├── Condition monitoring loop                       │
│  ├── Distribution proposal engine                    │
│  ├── DeFi yield management (optional, stretch)       │
│  └── MemWal for persistent memory                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## MemWal Sample Apps (Reference)

From `_ref/MemWal/apps/`:
| App | What It Does | Learn From |
|-----|-------------|------------|
| **chatbot** | Next.js chatbot with persistent memory | Full MemWal integration pattern |
| **noter** | Note-taking with AI memory | Remember/recall flow |
| **researcher** | Research agent with memory | Multi-step agent + memory |
| **app** | Playground app | Basic MemWal setup |

---

## Build Priority Order

### Phase 1: Core (Days 1-7)
1. Move contracts: Trust creation, beneficiary NFTs, fund deposit/withdrawal
2. Seal policy: whitelist + time lock combined
3. Frontend: Trust creation wizard + dashboard skeleton
4. Walrus: encrypt → upload → store blobId on-chain

### Phase 2: Agent (Days 8-12)
5. AI agent: plain English → Move rule translation
6. Condition monitoring: check time, check NFT ownership
7. MemWal: agent decision logging + recall
8. Distribution proposal flow

### Phase 3: Polish (Days 13-17)
9. Frontend polish (Anna leads): design system, animations, responsive
10. Demo video production
11. Testnet deployment + testing
12. Mainnet deployment (if feasible)
13. README, screenshots, submission artifacts

---

## Testnet Config

```yaml
# Walrus
publisher: https://publisher.walrus-testnet.walrus.space
aggregator: https://aggregator.walrus-testnet.walrus.space

# Seal
key_server: DECENTRALIZED_KEY_SERVER_OBJ_ID (from Seal docs)
aggregator: https://seal-aggregator-testnet.mystenlabs.com

# Sui
network: testnet
rpc: https://fullnode.testnet.sui.io:443
```
