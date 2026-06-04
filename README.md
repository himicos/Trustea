# Trustea

**On-chain trust fund infrastructure on Sui.**

Trustea replaces the expensive, opaque administration layer inside family trusts with programmable smart contracts, AI agents, and verifiable storage on Walrus. Write rules in plain English. An AI trustee enforces them on-chain — for decades.

---

## The Problem

$35 trillion sits in trust funds globally. Human trustees charge 1-2% of assets annually — $5,000-$50,000+/year — for work a program can do in milliseconds. The process is opaque, paper-based, and hasn't evolved since the 1900s.

## The Solution

Trustea automates trust fund administration using Sui's programmable object model and Walrus's persistent data layer:

- **Plain English rules** — Write "Release $50k to Alice when she turns 25" → AI translates → deploys as enforceable on-chain logic
- **AI Trustee Agent** — Monitors conditions 24/7, proposes distributions when rules are met, manages yield within risk bounds. Every decision stored permanently on Walrus via MemWal.
- **48-hour Human Override** — Grantor can veto any AI-proposed action before execution. The human stays in the loop.
- **Soulbound Beneficiary NFTs** — Each beneficiary receives a non-transferable NFT encoding their rules, allocation, and access rights
- **Encrypted Documents** — Trust agreements stored on Walrus, encrypted via Seal. Only authorized parties can decrypt. Time-locked documents that unlock on a specific date.
- **Verifiable Audit Trail** — Full history of every agent decision, condition check, and fund movement. Reconstructable 50 years from now.

Trustea is designed to work within the **directed trust** legal framework recognized in 17+ US states — where a licensed trust company handles administrative duties while technology handles the direction advisory role.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
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
- `beneficiary_nft.move` — Soulbound NFTs (key-only, no store) with wallet Display metadata
- `seal_policy.move` — Combined whitelist + time-lock Seal access policy
- `agent_log.move` — On-chain audit trail for all AI agent actions

**Testnet Package:** `0x6dd9f544633cc3dd119f045aa45711d1bc90158cf2059aa1bbba2967697d7079`

### Integration Tests — 56/56 PASS on Live Testnet

| Test | Result |
|------|--------|
| Trust lifecycle (create, deposit, beneficiary, rule, propose, cancel, pause, resume, amend) | PASS |
| Soulbound BeneficiaryNFT minted + verified in wallet | PASS |
| Walrus document store + retrieve round-trip | PASS |
| Walrus blob ID anchored on-chain in trust object | PASS |
| Seal encryption against real testnet key server | PASS |
| Seal access control (non-beneficiary correctly denied) | PASS |
| MemWal remember (4 memories across 2 namespaces on Walrus) | PASS |
| MemWal semantic recall (distance-ranked results) | PASS |
| AI Rule Translation (6 rule types: age, time, credential, periodic, custom) | PASS |
| Condition monitor (rules evaluated against live chain state) | PASS |
| Distribution engine (proposals generated from triggered conditions) | PASS |
| Yield manager (4 risk profiles: passive, conservative, moderate, aggressive) | PASS |
| Trust state reader (all fields parsed from live Sui object) | PASS |
| UI helpers (formatSui, milestone progress, veto countdown, dashboard stats) | PASS |

### TypeScript SDK (`lib/`)
- **14 transaction builders** for every contract function
- Full deploy composer — create trust + deposit + beneficiaries + rules in minimal transactions
- On-chain readers — trust state, beneficiary NFTs, agent activity events, grantor's trusts
- Seal + Walrus pipeline — encrypt, store, retrieve, decrypt
- UI helpers — SUI formatting, address truncation, milestone progress bars, veto countdowns, dashboard aggregates
- Document manifest system for encrypted file metadata

### AI Agent (`agent/`)
- **Rule Translator** — Plain English to structured on-chain rules with confidence scoring
- **Condition Monitor** — Evaluates time-based, credential-based, and periodic conditions
- **Distribution Engine** — Generates proposals, builds correct Sui transactions
- **Yield Manager** — Risk-profiled DeFi allocation strategies
- **TrusteeAgent** — Orchestrator that runs monitoring cycles and logs all decisions to MemWal

---

## How Each Technology Is Used

| Technology | What it does in Trustea |
|-----------|------------------------|
| **Sui Move** | Trust objects as shared programmable state. Soulbound NFTs for beneficiary identity. On-chain rules with automatic enforcement. |
| **Walrus** | Encrypted trust documents (agreements, amendments, identity proofs) stored as blobs. Permanent, retrievable for decades. |
| **Seal** | Beneficiary-only document access. Time-locked encryption that unlocks on a specific date. Whitelist policy enforced by Move contract. |
| **MemWal** | AI agent's persistent memory. Every condition check, distribution proposal, yield action, and compliance review stored on Walrus. Semantic recall across sessions. |

---

## Cost Comparison

| | Traditional Trust | Trustea |
|---|---|---|
| Setup | $5,000 – $50,000 | ~$2 (gas fees) |
| Annual fee | 0.5 – 1.5% AUM | ~$0 |
| Transparency | Opaque | On-chain + Walrus |
| Audit trail | Paper files | Permanent (MemWal on Walrus) |
| Rule changes | Weeks | Minutes |
| Privacy | Lawyers see everything | Seal encryption |
| Duration | Human lifespan | Perpetual |

---

## Project Structure

```
contracts/              Sui Move (4 modules, 12 tests)
  sources/
    trust.move              Trust object + full lifecycle
    beneficiary_nft.move    Soulbound beneficiary NFTs
    seal_policy.move        Whitelist + time-lock encryption
    agent_log.move          On-chain agent audit trail
  tests/
    trust_tests.move        Integration tests

lib/                    TypeScript SDK
  config.ts                 Network configuration
  transactions.ts           14 PTB builders + deploy composer
  trust-reader.ts           On-chain object readers
  helpers.ts                Formatters, progress, stats
  walrus/client.ts          Walrus REST client
  seal/client.ts            Seal encrypt/decrypt
  seal/encrypt-store.ts     Encrypt-then-store pipeline
  memwal/client.ts          MemWal persistent memory

agent/                  AI Trustee Agent
  src/
    agent.ts                Orchestrator (runCycle)
    rule-translator.ts      English → on-chain rules
    condition-monitor.ts    Condition evaluation
    distribution-engine.ts  Proposal + transaction building
    yield-manager.ts        DeFi allocation strategies

scripts/                Testing + deployment
  integration-test.ts       56/56 PASS on testnet
  test-memwal.ts            MemWal remember/recall
  test-seal-decrypt.ts      Seal access control
  walrus-smoke-test.ts      Walrus round-trip
  deploy.sh                 Build + test + publish
```

---

## Running

```bash
# Smart contract tests
cd contracts && sui move test

# Full integration test (requires funded testnet wallet)
npx tsx scripts/integration-test.ts

# Individual tests
npx tsx scripts/walrus-smoke-test.ts
npx tsx scripts/seal-test.ts
npx tsx scripts/test-memwal.ts
npx tsx scripts/test-rule-translator-local.ts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Sui Move (edition 2024) |
| Document Storage | Walrus |
| Encryption | Seal |
| AI Memory | MemWal (Walrus Memory) |
| AI Engine | Claude / local LLM |
| Frontend | Next.js, @mysten/dapp-kit |
| SDK | TypeScript, @mysten/sui |

---

## Team

**Nik Stoletov** — CTO, crypto enthusiast, builder. Architecture, smart contracts, backend, AI agent, Walrus/Seal/MemWal integration.

**Anna Shcherbinina** — Computer Science student at TU Graz. Design engineering, frontend, UX.

---

Sui Overflow 2026
