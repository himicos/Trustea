# Trustea

**On-chain trust fund infrastructure on Sui.**

Trustea replaces the expensive, opaque administration layer inside family trusts with programmable smart contracts, AI agents, and verifiable storage on Walrus. Write rules in plain English. An AI trustee enforces them on-chain — for decades.

> *"The trust industry hasn't changed in 100 years. We're changing it."*

---

## The Problem

$35 trillion sits in trust funds globally. Human trustees charge 1-2% of assets annually — $5,000-$50,000+/year — for work a program can do in milliseconds. The process is opaque, paper-based, and hasn't evolved since the 1900s.

## The Solution

Trustea operates within the **directed trust** framework recognized in 17+ US states. A licensed trust company remains the administrative trustee. Trustea automates the **direction advisor** role — the expensive part:

- **Plain English → Smart Contract** — Write "Release $50k to Alice when she turns 25" → AI translates → deploys as enforceable on-chain logic
- **AI Trustee Agent** — Monitors conditions 24/7, proposes distributions when rules are met, manages yield within risk bounds
- **48-hour Human Override** — Grantor or trust protector can veto any AI-proposed action before execution
- **Verifiable Audit Trail** — Every agent decision persisted on Walrus via MemWal. Reconstructable 50 years from now
- **Encrypted Documents** — Trust agreements stored on Walrus, encrypted via Seal. Only authorized parties can decrypt

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  LEGAL LAYER (Off-chain)                            │
│  Directed Trust (SD/DE) + Licensed Admin Trustee    │
│  Trust Protector = human override / kill switch     │
├─────────────────────────────────────────────────────┤
│  TECHNOLOGY LAYER (On-chain — Trustea)              │
│                                                     │
│  Sui Move Contracts                                 │
│  ├─ Trust object (rules, balance, beneficiaries)    │
│  ├─ BeneficiaryNFT (soulbound, programmable)        │
│  ├─ Seal Policy (whitelist + time-lock encryption)  │
│  └─ Agent Log (on-chain audit events)               │
│                                                     │
│  Walrus Stack                                       │
│  ├─ Walrus — encrypted document storage (blobs)     │
│  ├─ Seal — identity-based threshold encryption      │
│  └─ MemWal — persistent AI agent memory             │
│                                                     │
│  AI Agent                                           │
│  ├─ Rule Translator (English → Move parameters)     │
│  ├─ Condition Monitor (time, credential, periodic)  │
│  ├─ Distribution Engine (propose → veto → execute)  │
│  └─ Yield Manager (risk-profiled DeFi allocation)   │
└─────────────────────────────────────────────────────┘
```

---

## What's Built

### Smart Contracts (Sui Move)
- **4 modules**, 12/12 unit tests, deployed on testnet
- `trust.move` — Trust shared object with full lifecycle (create, deposit, add beneficiaries, add rules, propose/execute/cancel distributions, pause/resume/close, amend)
- `beneficiary_nft.move` — Soulbound NFTs (key-only, no store) with Display metadata
- `seal_policy.move` — Whitelist + time-lock Seal access control
- `agent_log.move` — On-chain audit trail for all agent actions

**Package ID:** `0x6dd9f544633cc3dd119f045aa45711d1bc90158cf2059aa1bbba2967697d7079`

### Integration Tests — 56/56 PASS on Live Testnet
Every component tested against real Sui infrastructure:

| Test | Result |
|------|--------|
| Trust lifecycle (create → deposit → beneficiary → rule → propose → cancel → pause → resume → amend) | PASS |
| Soulbound BeneficiaryNFT minted + verified in wallet | PASS |
| Walrus document store + retrieve round-trip | PASS |
| Walrus blob ID anchored on-chain | PASS |
| Seal encryption (222B → 511B, real key server) | PASS |
| Seal access control (non-beneficiary correctly denied) | PASS |
| MemWal remember (4 memories across 2 namespaces) | PASS |
| MemWal recall (semantic search, distance ranking) | PASS |
| AI Rule Translation (6/6 rule types parsed correctly) | PASS |
| Condition monitor (evaluated rules against chain state) | PASS |
| Distribution engine (proposals generated from conditions) | PASS |
| Yield manager (all 4 risk profiles computed) | PASS |
| Trust state reader (parsed all fields from live object) | PASS |
| Dashboard helpers (formatSui, milestones, veto countdown) | PASS |

### TypeScript SDK (`lib/`)
- **14 PTB transaction builders** for every contract function
- `buildFullDeployTxs()` — compose entire create-trust wizard into minimal transactions
- `fetchTrust()`, `fetchTrustsCreatedBy()`, `fetchBeneficiaryNFTs()`, `fetchAgentActivity()` — on-chain readers
- `encryptAndStore()` / `fetchAndDecrypt()` — Seal + Walrus pipeline
- `computeMilestoneProgress()`, `computeVetoCountdown()`, `computeDashboardStats()` — UI helpers
- Document manifest system for mapping blob IDs to human-readable names

### AI Agent (`agent/`)
- **Rule Translator** — Claude-powered (or local LLM) plain English → structured `TrustRule` with confidence scoring and ambiguity warnings
- **Condition Monitor** — evaluates time-based, credential-based, and periodic conditions against on-chain state
- **Distribution Engine** — generates proposals when conditions are met, builds correct PTBs
- **Yield Manager** — risk-profiled allocation strategies (passive/conservative/moderate/aggressive)
- **TrusteeAgent orchestrator** — `runCycle()` ties everything together, logs all decisions to MemWal

---

## Walrus Track Alignment

Every Walrus primitive has a genuine purpose — not bolted on:

| Primitive | Purpose in Trustea |
|-----------|-------------------|
| **Walrus (blobs)** | Trust documents (agreements, amendments, identity proofs) stored encrypted, retrievable for decades |
| **Seal (encryption)** | Only grantor + listed beneficiaries can decrypt. Time-locked documents that become readable on a specific date (e.g., after grantor's death) |
| **MemWal (memory)** | AI agent stores every decision, condition check, yield action, compliance review. Semantic recall across sessions. Long-running agent that remembers across years of trust administration |

### Track Statement Fit
> *"Long-running workflows where agents track state over time"*

A trust fund runs for decades. The AI agent checks conditions, proposes distributions, manages yield, and logs everything to MemWal — continuously, across years.

> *"How agents become more useful when they can remember and build over time"*

The agent recalls past decisions when making new ones. "Last time Alice's age check failed at 20. She's now 23. 2 years remaining." Context compounds.

> *"How workflows improve when data is shared, durable, and portable"*

Trust documents on Walrus are permanent. If Trustea disappears, the data remains. A new agent, a new frontend, even a different protocol can read the same blobs. The trust outlives the software.

---

## Cost Comparison

| | Traditional Trust | Trustea |
|---|---|---|
| Setup | $5,000 – $50,000 | ~$2 (gas) |
| Annual fee | 0.5 – 1.5% AUM | ~$0 |
| Transparency | Opaque (paper files) | On-chain + Walrus |
| Audit trail | Lawyer's filing cabinet | MemWal (verifiable, permanent) |
| Rule changes | Weeks (lawyer meetings) | Minutes (amend transaction) |
| Privacy | Lawyers see everything | Seal (only authorized parties) |
| Duration | Limited by human lifespan | Perpetual (South Dakota law) |
| **30-year cost on $5M** | **$150,000 – $450,000+** | **$15,000 – $60,000** |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Sui Move (edition 2024) |
| Blob Storage | Walrus (`@mysten/walrus`) |
| Encryption | Seal (`@mysten/seal`) |
| AI Memory | MemWal (`@mysten-incubation/memwal`) |
| AI Engine | Claude API / local LLM (rule translation) |
| Frontend | Next.js + `@mysten/dapp-kit` |
| TypeScript SDK | Custom `lib/` with PTB builders, readers, helpers |

---

## Project Structure

```
contracts/          Sui Move smart contracts (4 modules, 12 tests)
  sources/
    trust.move              Core trust object + lifecycle
    beneficiary_nft.move    Soulbound beneficiary NFTs
    seal_policy.move        Whitelist + time-lock encryption policy
    agent_log.move          On-chain agent audit trail
  tests/
    trust_tests.move        12 integration tests

lib/                TypeScript SDK
  config.ts                 Network configuration (testnet/mainnet)
  transactions.ts           14 PTB builders + full deploy composer
  trust-reader.ts           On-chain object fetchers + parsers
  helpers.ts                Formatters, milestone progress, dashboard stats
  index.ts                  Barrel exports
  walrus/client.ts          Walrus REST client wrapper
  seal/client.ts            Seal encrypt/decrypt wrapper
  seal/encrypt-store.ts     Combined encrypt→store pipeline
  memwal/client.ts          MemWal persistent memory wrapper

agent/              AI Trustee Agent
  src/
    agent.ts                TrusteeAgent orchestrator (runCycle)
    rule-translator.ts      Plain English → TrustRule (Claude/LLM)
    condition-monitor.ts    Time, credential, periodic condition checks
    distribution-engine.ts  Proposal generation + PTB construction
    yield-manager.ts        Risk-profiled DeFi allocation strategies

scripts/            Test + deployment scripts
  integration-test.ts       56/56 PASS — full testnet integration
  test-memwal.ts            MemWal remember + recall test
  test-seal-decrypt.ts      Seal encrypt + access control test
  test-rule-translator-local.ts  Rule translation with local LLM
  walrus-smoke-test.ts      Walrus store/retrieve round-trip
  seal-test.ts              Seal encryption against key server
  setup-memwal-account.ts   One-time MemWal account setup
  deploy.sh                 Contract build + test + publish
  e2e-demo.ts               Full live demo script

ideation/           Research, strategy, design docs
  00-19                     Track analysis, idea validation, UX flows,
                            build phases, design system, legal positioning
```

---

## Running Tests

```bash
# Smart contracts
cd contracts && sui move test        # 12/12 PASS

# Full integration test (requires funded Sui testnet wallet)
npx tsx scripts/integration-test.ts  # 56/56 PASS

# Individual component tests
npx tsx scripts/walrus-smoke-test.ts           # Walrus round-trip
npx tsx scripts/seal-test.ts                   # Seal encryption
npx tsx scripts/test-seal-decrypt.ts           # Seal access control
npx tsx scripts/test-memwal.ts                 # MemWal remember/recall
npx tsx scripts/test-rule-translator-local.ts  # Rule translation (needs ollama)
```

---

## Track

**Sui Overflow 2026 — Walrus Track**

## Team

- **Nik** — Architecture, smart contracts, backend, AI agent, integration
- **Anna Shcherbinina** — Frontend, design system, UX

Built during Sui Overflow 2026 (May 7 – June 21, 2026)
