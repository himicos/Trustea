# Trustea

**On-chain trust fund infrastructure on Sui.**

Trustea replaces the expensive, opaque administration layer inside family trusts with programmable smart contracts, AI agents, and verifiable storage on Walrus. Write rules in plain English. An AI trustee enforces them on-chain — for decades.

---

## The Problem

$13 trillion sits in US private trusts today, with $124 trillion transferring between generations through 2048. The administration of these trusts — a $15.5 billion industry — runs on paper, phone calls, and fees of 1-2% of assets annually. That's $15,000-$30,000/year on a $1M trust. Trust filings jumped 15% in a single year as boomers begin the largest wealth transfer in history. The industry hasn't changed in decades.

## The Solution

Trustea automates trust fund administration using Sui's programmable object model and Walrus's persistent data layer:

- **Plain English rules** — Write "Release $50k to Alice when she turns 25" or "Pay tuition if enrolled, suspend if convicted" — the AI translates compound conditions into enforceable on-chain logic
- **AI Trustee Agent** — Model-agnostic (Claude, GPT, local LLMs). Monitors conditions 24/7, proposes distributions, manages yield. Every decision Seal-encrypted and stored permanently on Walrus via MemWal — the administration history is private and only accessible to authorized parties.
- **Configurable Human Override** — Grantor or trust protector can veto any AI-proposed action within a configurable window (default 48 hours, adjustable per trust)
- **Revocable & Irrevocable Trusts** — Grantor chooses at creation. Irrevocable trusts lock assets permanently — the grantor gives up control, matching real-world asset protection trusts
- **Beneficiary Self-Service** — Beneficiaries can request distributions with HEMS categories (health, education, maintenance, support). Grantor or agent approves/denies.
- **Soulbound Beneficiary NFTs** — Non-transferable NFTs encoding rules, allocation, and access rights
- **RWA Tokens** — Soulbound tokens representing real-world assets (real estate, securities, vehicles) held by the trust, with on-chain valuation tracking
- **Encrypted Documents** — Trust agreements stored on Walrus, encrypted via Seal. Only authorized parties can decrypt. Time-locked documents that unlock on a specific date.
- **Principal vs Income Accounting** — Tracks deposits and distributions separately, enabling "distribute income only, preserve principal" — the most common trust pattern
- **Verifiable Audit Trail** — Every agent decision Seal-encrypted and stored on Walrus via MemWal. The permanent record is private — only authorized parties can decrypt it. Reconstructable 50 years from now.

Trustea is designed to work within the **directed trust** legal framework recognized in 17+ US states — where a licensed trust company handles administrative duties while technology handles the direction advisory role.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Sui Move Contracts (6 modules, 24 tests)                   │
│  ├─ Trust — rules, balance, beneficiaries, protector,       │
│  │          revocability, principal/income accounting        │
│  ├─ BeneficiaryNFT — soulbound programmable identity        │
│  ├─ Seal Policy — whitelist + time-lock encryption          │
│  ├─ Agent Log — on-chain audit events                       │
│  └─ RWA Token — real-world asset representation             │
│                                                             │
│  Walrus Stack                                               │
│  ├─ Walrus — encrypted document storage (permanent blobs)   │
│  ├─ Seal — identity-based threshold encryption              │
│  └─ MemWal — persistent AI agent memory (Seal-encrypted)    │
│                                                             │
│  AI Agent (model-agnostic: Claude, GPT, Ollama, any LLM)   │
│  ├─ Rule Translator — English → compound on-chain rules     │
│  ├─ Condition Monitor — time, credential, periodic, compound│
│  ├─ Distribution Engine — propose → veto → execute          │
│  └─ Yield Manager — risk-profiled DeFi allocation           │
│                                                             │
│  TypeScript SDK (22 transaction builders)                    │
│  ├─ Every contract function exposed as a PTB builder        │
│  ├─ On-chain readers + parsers for all object types         │
│  └─ Accessible to any AI agent or external system           │
└─────────────────────────────────────────────────────────────┘
```

### Agent-Accessible Tooling

The entire TypeScript SDK is designed as a **tool layer for AI agents**:

- Any LLM agent (Claude, GPT, local model) can call the PTB builders to create transactions
- Trust state readers return structured data an agent can reason about
- The rule translator's system prompt works with any model that outputs JSON
- MemWal memories are Seal-encrypted on Walrus — the agent's reasoning is private and verifiable, not stored on anyone's server
- All 22 transaction builders, readers, and helpers are exported from a single `@trustea/lib` entry point

An external agent framework (LangChain, CrewAI, AutoGPT) could plug into Trustea by importing the SDK and calling `buildAddRuleTx()`, `fetchTrust()`, or `translateRule()` — the infrastructure is framework-agnostic.

---

## What's Built

### Smart Contracts (Sui Move)
- **6 modules**, 24/24 unit tests, deployed on testnet
- `trust.move` — Trust shared object with full lifecycle: create, deposit, add beneficiaries, add rules, propose/execute/cancel distributions, beneficiary requests (HEMS), approve/deny, pause/resume/close, amend, agent rotation, successor grantor, trust protector, revocable/irrevocable, principal vs income tracking
- `beneficiary_nft.move` — Soulbound NFTs (key-only, no store) with wallet Display metadata
- `seal_policy.move` — Combined whitelist + time-lock Seal access policy
- `agent_log.move` — On-chain audit trail for all AI agent actions
- `rwa_token.move` — Soulbound real-world asset tokens with valuation tracking

**Testnet Package:** `0x99918b1c3d33c75a0f8935713f5aa2ef82d8ef63d3352dfd0d320f69a1e0408e`

### Integration Tests — Verified on Live Testnet

| Component | Tests | Status |
|-----------|-------|--------|
| Trust lifecycle (create, deposit, beneficiary, rule, propose, cancel, pause, resume, amend) | 24 Move + 56 integration | PASS |
| Soulbound BeneficiaryNFT minted + verified in wallet | Integration | PASS |
| Beneficiary request + approve/deny flow | Move | PASS |
| Trust protector veto, pause/resume, agent rotation | Move | PASS |
| Irrevocable trust (close keeps balance, grantor can't amend) | Move | PASS |
| Principal vs income accounting | Move | PASS |
| Walrus document store + retrieve round-trip | Integration | PASS |
| Seal encryption against real testnet key server | Integration | PASS |
| Seal access control (non-beneficiary correctly denied) | Integration | PASS |
| MemWal remember + semantic recall (4 memories, 2 namespaces) | Integration | PASS |
| MemWal Private mode (local embed + Seal encrypt + Walrus store + local decrypt) | Integration | PASS |
| AI Rule Translation (12 trust fund patterns, local + cloud) | Integration | PASS |
| Condition monitor (compound rules, AND/OR logic) | Integration | PASS |
| Distribution engine + yield manager (4 risk profiles) | Integration | PASS |

### TypeScript SDK (`lib/`)
- **22 transaction builders** for every contract function including beneficiary requests, RWA tokens, agent rotation, and full deploy composer
- On-chain readers for Trust, PendingDistribution, DistributionRequest, BeneficiaryNFT, agent activity events
- Seal + Walrus pipeline — encrypt, store, retrieve, decrypt
- Principal vs income computation (`computeIncomeBalance`)
- UI helpers — SUI formatting, address truncation, milestone progress, veto countdowns, HEMS categories, dashboard aggregates

### AI Agent (`agent/`)
- **Rule Translator** — Model-agnostic. Tested with Claude API and local gemma3:27b. Handles 12 real-world trust fund patterns: age, time, credential, periodic, compound (AND/OR), HEMS, incentive (income matching), protective (bankruptcy/felony suspension), spendthrift caps, life events, generation-skipping, RWA-conditional
- **Condition Monitor** — Evaluates atomic and compound conditions with AND/OR logic. Credential checks via on-chain NFT ownership queries. Balance threshold checks.
- **Distribution Engine** — Generates proposals from triggered conditions, builds correct PTBs with the actual contract signature
- **Yield Manager** — 4 risk profiles (passive, conservative, moderate, aggressive) with allocation ratios and rebalancing
- **TrusteeAgent orchestrator** — `runCycle()` monitors, proposes, allocates, and logs everything to MemWal (Seal-encrypted on Walrus)

---

## How Each Technology Is Used

| Technology | What it does in Trustea |
|-----------|------------------------|
| **Sui Move** | Trust objects as shared programmable state. Soulbound NFTs for beneficiary identity. RWA tokens for real-world assets. On-chain rules with configurable enforcement. Principal/income accounting. |
| **Walrus** | Encrypted trust documents (agreements, amendments, identity proofs, RWA documentation) stored as blobs. Permanent, retrievable for decades. Annual trust reports generated by the agent. |
| **Seal** | Beneficiary-only document access. Time-locked encryption (documents readable only after a date). Agent memory encryption — the AI's reasoning is private on Walrus. Whitelist policy enforced by Move contract. |
| **MemWal** | AI agent's persistent memory. Every condition check, distribution proposal, yield action, and compliance review stored as Seal-encrypted memories on Walrus. The permanent record is private — only the delegate key holder can decrypt it. Semantic recall across sessions enables the agent to build context over years of trust administration. |

---

## Trust Fund Features

| Feature | Traditional Trust | Trustea |
|---------|------------------|---------|
| Legal setup | $1,000 – $10,000 (attorney) | Same (still needed) |
| Admin onboarding | $2,000 – $5,000 | ~$2 (gas fees) |
| Annual administration | 0.75 – 1.5% AUM ($15k–$30k on $1M) | Near $0 (agent + chain) |
| Revocable/irrevocable | Paper election | On-chain enforcement |
| Trust protector | Hired separately | On-chain role with veto power |
| Successor trustee | Documented in paper | On-chain with key rotation |
| Beneficiary requests | Phone calls and letters | Self-service on-chain (HEMS) |
| Principal vs income | Manual accounting | Automatic on-chain tracking |
| RWA inventory | Paper schedule | Soulbound tokens with valuations |
| Compound rules | Lawyer interpretation | AI + AND/OR logic on-chain |
| Audit trail | Filing cabinet | MemWal on Walrus (encrypted, permanent) |
| Transparency | Opaque | On-chain + Walrus |
| Privacy | Lawyers see everything | Seal (only authorized parties) |
| Duration | Human lifespan | Perpetual |
| 30-year cost on $5M | $150,000 – $450,000+ | $15,000 – $60,000 |

---

## Project Structure

```
contracts/              Sui Move (6 modules, 24 tests)
  sources/
    trust.move              Trust object + full lifecycle + requests
    beneficiary_nft.move    Soulbound beneficiary NFTs
    seal_policy.move        Whitelist + time-lock encryption
    agent_log.move          On-chain agent audit trail
    rwa_token.move          Real-world asset tokens
  tests/
    trust_tests.move        24 integration tests

lib/                    TypeScript SDK
  config.ts                 Network configuration
  transactions.ts           22 PTB builders + deploy composer
  trust-reader.ts           On-chain object readers + parsers
  helpers.ts                Formatters, progress, income, stats
  walrus/client.ts          Walrus REST client
  seal/client.ts            Seal encrypt/decrypt
  seal/encrypt-store.ts     Encrypt-then-store pipeline
  memwal/client.ts          MemWal persistent memory

agent/                  AI Trustee Agent (model-agnostic)
  src/
    agent.ts                Orchestrator (runCycle)
    rule-translator.ts      English → compound rules (12 patterns)
    condition-monitor.ts    Atomic + compound condition evaluation
    distribution-engine.ts  Proposal + transaction building
    yield-manager.ts        DeFi allocation strategies

scripts/                Testing + deployment
  integration-test.ts       Full testnet integration suite
  test-memwal.ts            MemWal remember/recall
  test-seal-decrypt.ts      Seal access control verification
  test-rule-translator-local.ts  12 trust fund patterns (local LLM)
  walrus-smoke-test.ts      Walrus round-trip
  setup-memwal-account.ts   MemWal account + delegate key setup
  deploy.sh                 Build + test + publish
```

---

## Running

```bash
# Smart contract tests (24/24)
cd contracts && sui move test

# Full integration test (requires funded testnet wallet)
npx tsx scripts/integration-test.ts

# Individual tests
npx tsx scripts/walrus-smoke-test.ts           # Walrus store/retrieve
npx tsx scripts/seal-test.ts                   # Seal encryption
npx tsx scripts/test-seal-decrypt.ts           # Seal access control
npx tsx scripts/test-memwal.ts                 # MemWal remember/recall
npx tsx scripts/test-rule-translator-local.ts  # 12 rule patterns (needs ollama)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Sui Move (edition 2024) |
| Document Storage | Walrus |
| Encryption | Seal |
| AI Memory | MemWal (Walrus Memory) — Seal-encrypted on Walrus |
| AI Engine | Model-agnostic (Claude, GPT, Ollama, any JSON-capable LLM) |
| Frontend | Next.js, @mysten/dapp-kit |
| SDK | TypeScript, @mysten/sui |

---

## Team

**Nik Stoletov** — CTO, crypto enthusiast, builder. Architecture, smart contracts, backend, AI agent, Walrus/Seal/MemWal integration.

**Anna Shcherbinina** — Computer Science student at TU Graz. Design engineering, frontend, UX.

---

Sui Overflow 2026
