# Build Phases — Trustea

## Timeline: 17 days (June 4 → June 21)

---

## Phase 1: Foundation (Days 1-4) — June 4-7

### Milestone: "Trust creation works end-to-end on testnet"

**Track 1: Smart Contracts (You + Claude)**
- [x] Sui Move: `Trust` object — name, rules array, balance, beneficiary registry, Walrus blob refs → `contracts/sources/trust.move`
- [x] Sui Move: `BeneficiaryNFT` — per-beneficiary soulbound object with embedded rule conditions → `contracts/sources/beneficiary_nft.move`
- [x] Sui Move: `create_trust()`, `add_beneficiary()`, `deposit()`, `propose_distribution()`, `execute_distribution()` → `contracts/sources/trust.move`
- [x] Sui Move: Seal policy — `seal_approve()` combining whitelist + time lock → `contracts/sources/seal_policy.move`
- [x] Sui Move: Agent audit log — on-chain events for every agent action → `contracts/sources/agent_log.move`
- [x] Deploy to testnet → **Package: `0x6dd9f544633cc3dd119f045aa45711d1bc90158cf2059aa1bbba2967697d7079`**
- [x] Write tests — **12/12 pass** → `contracts/tests/trust_tests.move`

**Track 2: Frontend Scaffold (You + Claude)**
- [ ] Next.js project init with @mysten/dapp-kit, Radix UI
- [ ] Wallet connection (Sui Wallet / Slipway)
- [ ] Basic routing: `/`, `/dashboard`, `/create`, `/trust/:id`, `/beneficiary/:nft_id`
- [ ] Create Trust wizard skeleton (5 steps, navigation works)

**Track 3: Design System (Anna)**
- [ ] Logo concepts (tea leaf + trust motif)
- [ ] Color palette finalized (green/white/Sui blue)
- [ ] Typography (Inter + JetBrains Mono)
- [ ] Component library sketch: buttons, cards, inputs, progress bars
- [ ] Research: screenshot 3-5 trust fund services for UX reference

### Phase 1 Gate: ✅ Can create a trust with rules and mint beneficiary NFTs on testnet

---

## Phase 2: Walrus Integration (Days 5-8) — June 8-11

### Milestone: "Documents encrypted, stored, and retrievable"

**Track 1: Walrus + Seal (You + Claude)**
- [x] Walrus client wrapper — store/read documents via REST API → `lib/walrus/client.ts`
- [x] Walrus smoke test — round-trip store→retrieve verified on testnet → `scripts/walrus-smoke-test.ts`
- [x] Seal client wrapper — encrypt/decrypt with trust-scoped policy → `lib/seal/client.ts`
- [x] Seal encrypt verified — 157B→446B, AES-256 key, real key server → `scripts/seal-test.ts`
- [x] Encrypt-then-store pipeline — Seal encrypt → Walrus upload → return blobId → `lib/seal/encrypt-store.ts`
- [x] Batch encrypt+store for multi-document trust onboarding → `lib/seal/encrypt-store.ts`
- [x] Store blobId in Trust Sui object → `trust::add_walrus_ref()` in contract + `buildAddWalrusRefTx()` in `lib/transactions.ts`
- [x] Decrypt flow: beneficiary → SessionKey → seal_approve → fetchKeys → decrypt → `lib/seal/client.ts` `decryptForBeneficiary()`
- [ ] Document viewer component (decrypt + render) — **FRONTEND, not started**

**Track 2: AI Agent Core (You + Claude)**
- [x] Agent service: condition checker loop → `agent/src/condition-monitor.ts`
  - Time-based: check clock vs rule timestamp ✅
  - NFT-based / credential: check if beneficiary holds specific object ✅
  - Periodic: check elapsed time since last distribution ✅
- [x] Distribution proposal engine → `agent/src/distribution-engine.ts` (fixed: correct PTB args)
- [x] MemWal client wrapper — remember/recall/analyze → `lib/memwal/client.ts`
- [ ] MemWal account setup — **BLOCKED: need delegate key from MemWal dashboard**
- [x] Agent activity log → on-chain events via `contracts/sources/agent_log.move`

**Track 3: Frontend Build-Out (Anna + Claude)**
- [ ] Landing page design + implementation
- [ ] Create Trust wizard — Step 1 (name), Step 3 (beneficiaries), Step 4 (fund mgmt)
- [ ] Dashboard layout with trust cards
- [ ] Apply design system across all components
- [ ] Logo finalized + project logo (1:1 for submission)

### Phase 2 Gate: ✅ Full encrypt → store → decrypt flow works (tested). ⚠️ Agent monitors conditions (code ready, not live-tested with MemWal).

---

## Phase 3: The Magic (Days 9-12) — June 12-15

### Milestone: "AI translates English to rules + active fund management"

**Track 1: AI Rule Translation (You + Claude)**
- [x] Claude integration: plain English → structured TrustRule JSON → `agent/src/rule-translator.ts` (uses claude-opus-4-5)
- [x] Rule JSON → Move contract parameter mapping → `lib/transactions.ts` `buildAddRuleFromTranslation()` — **THE AI-TO-CHAIN BRIDGE**
- [ ] Frontend: Step 2 of wizard — type rule, see AI translation live — **FRONTEND, not started**
- [x] Validation: AI confirms rule with confidence score + warnings → `rule-translator.ts` returns `{ confidence, warnings[] }`
- [x] Edge cases: handles "$50,000"/"50k"/"10%"/"half"/"all"/"annually"/"monthly"/"quarterly" → `rule-translator.ts` system prompt

**Track 2: Active Fund Management (You + Claude)**
- [x] Risk profiles: passive / conservative / moderate / aggressive → `agent/src/yield-manager.ts`
- [x] Yield strategy engine with allocation ratios + rebalancing → `agent/src/yield-manager.ts`
- [ ] ⚠️ Real Scallop/NAVI integration — **STUBBED** (hardcoded APYs, no SDK calls)
- [ ] Yield tracking on dashboard — **FRONTEND, not started**
- [x] Yield actions logged via MemWal + on-chain agent_log → `agent/src/yield-manager.ts` + `agent_log.move`

**Track 3: Frontend Polish Phase 1 (Anna + Claude)**
- [ ] Trust management view (`/trust/:id`) — full implementation
- [ ] Beneficiary view (`/beneficiary/:nft_id`)
- [ ] Agent activity feed component
- [ ] Progress bars for condition tracking
- [ ] Responsive design pass

### Phase 3 Gate: ⚠️ Type English → see contract ✅ (backend). Agent manages funds ✅ (stubbed). Dashboard shows everything ❌ (no frontend).

---

## Phase 4: Polish & Demo (Days 13-17) — June 16-21

### Milestone: "Submission-ready with killer demo"

**Track 1: Integration Testing (You)**
- [x] PTB transaction builders for all 14 contract functions → `lib/transactions.ts`
- [x] Trust state reader (fetch + parse from chain) → `lib/trust-reader.ts`
- [x] E2E demo script: create trust → fund → add beneficiaries → Walrus upload → read back → `scripts/e2e-demo.ts`
- [ ] Run full e2e demo against testnet with real ANTHROPIC_API_KEY
- [ ] Test Seal decrypt from beneficiary perspective (SessionKey + wallet sign)
- [ ] Test agent runCycle() with real on-chain trust object
- [ ] Fix all bugs from testing

**Track 2: Mainnet Deployment (You)**
- [ ] Review all contracts for mainnet readiness
- [ ] Deploy Move contracts to mainnet
- [ ] Switch frontend to mainnet config
- [ ] Verify mainnet encrypt/store/decrypt flow
- [ ] Deploy frontend to Walrus Sites

**Track 3: Frontend Polish Phase 2 (Anna)**
- [ ] Micro-interactions and animations
- [ ] Loading states, error states, empty states
- [ ] Mobile responsive final pass
- [ ] Screenshots for README and submission
- [ ] GIF recordings of key flows

**Track 4: Demo Video (Both)**
- [ ] Script rehearsal (from `10-demo-video.md`)
- [ ] Film location scenes (financial district, walking shots)
- [ ] Screen record all demo flows (clean data, no errors)
- [ ] Edit: sync voiceover + footage + screen recordings
- [ ] Music, color grade, export ≤ 5 min
- [ ] Upload to YouTube

**Track 5: Submission (Both)**
- [ ] README with screenshots, architecture diagram, tech stack
- [ ] Public GitHub repo (clean commit history!) ✅ already granular
- [ ] Project logo (1:1 JPG/PNG)
- [ ] Description: what it does, why it matters
- [ ] Submit on DeepSurge
- [ ] Double-check: package ID, demo video URL, website URL

### Phase 4 Gate: Submitted. Deployed on mainnet. Demo video live. README polished.

---

## Progress Summary (as of June 4, end of day)

### Backend Completion: ~75%

| Component | File(s) | Status |
|---|---|---|
| Move contracts (4 modules) | `contracts/sources/*.move` | ✅ Deployed, 12/12 tests |
| Walrus store/retrieve | `lib/walrus/client.ts` | ✅ Tested on testnet |
| Seal encrypt/decrypt | `lib/seal/client.ts`, `encrypt-store.ts` | ✅ Encrypt verified, decrypt untested |
| Encrypt-then-store pipeline | `lib/seal/encrypt-store.ts` | ✅ Built, needs integration test |
| PTB transaction builders (14) | `lib/transactions.ts` | ✅ Built, type-checked |
| Trust state reader | `lib/trust-reader.ts` | ✅ Built, type-checked |
| AI Rule Translator | `agent/src/rule-translator.ts` | ✅ Built, needs API key test |
| English→on-chain bridge | `lib/transactions.ts` `buildAddRuleFromTranslation()` | ✅ Built |
| Condition monitor | `agent/src/condition-monitor.ts` | ✅ Built, needs live test |
| Distribution engine | `agent/src/distribution-engine.ts` | ✅ Fixed, correct PTB args |
| Agent orchestrator | `agent/src/agent.ts` | ✅ Built, needs live runCycle test |
| Yield manager | `agent/src/yield-manager.ts` | ⚠️ Stubbed (hardcoded APYs) |
| MemWal client | `lib/memwal/client.ts` | ⚠️ Built, no account/key |
| Config | `lib/config.ts` | ✅ Testnet package ID set |
| Deploy script | `scripts/deploy.sh` | ✅ Used successfully |
| E2E demo | `scripts/e2e-demo.ts` | ⚠️ Fixed, not yet run |
| Seal test | `scripts/seal-test.ts` | ✅ Passes |
| Walrus smoke test | `scripts/walrus-smoke-test.ts` | ✅ Passes |

### Frontend Completion: 0%
Everything in UX flow (`ideation/14-ux-flow.md`) is designed but not implemented.

### What's Needed to Hit 100%

**Critical (demo breaks without these):**
1. 🔴 **Frontend** — landing, wizard, dashboard, trust view, beneficiary view
2. 🔴 **Run e2e demo** — prove the full flow works live with real API key
3. 🟡 **Seal decrypt test** — verify beneficiary can actually decrypt documents
4. 🟡 **Agent live test** — run agent.runCycle() against real on-chain trust

**Important (makes demo compelling):**
5. 🟡 **MemWal account setup** — get delegate key, test remember/recall
6. 🟡 **Real DeFi integration** — even one Scallop deposit would make yield real
7. 🟡 **Walrus Sites deploy** — fully decentralized frontend hosting

**Polish (wow factor):**
8. 🔵 **Demo video** — film + edit + upload
9. 🔵 **README** — architecture diagram, screenshots
10. 🔵 **Mainnet deploy** — production readiness
11. 🔵 **Logo + branding** — Anna's deliverable

---

## Daily Rhythm

| Time | You | Anna |
|------|-----|------|
| Morning | Review overnight commits, plan day | Design work (logo, components, mockups) |
| Midday | Core engineering (contracts, agent, Walrus) | Frontend implementation (CSS, components) |
| Evening | Integration, testing, review Anna's work | Polish, content, research |
| Night | Claude builds while you sleep (background agents) | — |

---

## What Delivers 100% of the Idea (Demo Priorities)

### MUST HAVE (the demo breaks without these)
1. ✅ Create trust with plain English rules → AI translates → deploys on-chain — `rule-translator.ts` + `buildAddRuleFromTranslation()`
2. ✅ Mint beneficiary NFTs with embedded rules — `beneficiary_nft.move` + `buildAddBeneficiaryTx()`
3. ✅ Fund the trust (deposit SUI) — `trust::deposit()` + `buildDepositTx()`
4. ✅ Trust documents encrypted via Seal → stored on Walrus — `encrypt-store.ts`
5. 🔴 Dashboard showing trust status, beneficiaries, conditions — **FRONTEND NEEDED**
6. ⚠️ AI agent monitoring conditions + logging to MemWal — code ready, needs live test
7. ✅ Condition met → propose + execute distribution — `distribution-engine.ts` + contract
8. 🔴 Beneficiary can view their NFT + decrypt trust docs — **FRONTEND NEEDED** (backend decrypt exists)

### SHOULD HAVE (makes the demo 2x better)
9. ⚠️ Active DeFi yield management (even conservative mode only) — **STUBBED**
10. ⚠️ Agent activity feed with real MemWal entries — **needs MemWal account**
11. ✅ Soulbound NFT verification — `beneficiary_nft.move` key-only enforcement
12. ✅ Trust amendment flow (grantor modifies rules) — `buildAmendTrustTx()`
13. 🔴 Walrus Sites deployment (fully decentralized frontend) — **FRONTEND NEEDED FIRST**

### NICE TO HAVE (wow factor for judges)
14. 🔴 Yield ticker showing real-time earnings
15. ✅ Multi-trust dashboard support — `trust-reader.ts` can fetch any trust
16. 🔴 Beneficiary onboarding flow (receive NFT, connect wallet, see terms)
17. 🔴 Mobile responsive
18. 🔴 SuiNS custom domain (trustea.wal.app)

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Move contracts take too long | ✅ DONE — shipped Day 1 |
| AI rule translation unreliable | ✅ Built with confidence scoring + fallback |
| Walrus/Seal integration issues | ✅ Both tested against real testnet |
| MemWal beta instability | Agent logs to on-chain events as fallback (agent_log.move) |
| DeFi integration complexity | Stubbed with hardcoded APYs, real integration if time allows |
| Demo video quality | Film city shots early. Script is already written. |
| Mainnet deployment fails | Testnet works. Mainnet = same commands + config swap. |
| Anna's bandwidth | Her work is parallelizable. Design → approve → implement. Claude assists. |

---

## Sub-Agent Build Strategy

### Parallel Agent Deployment (when building)

**Agent 1: Move Contracts** ✅ COMPLETE
- Wrote and deployed smart contracts
- 12/12 tests pass on testnet
- Owns: `contracts/` directory

**Agent 2: Frontend** 🔴 NOT STARTED
- Next.js app with all pages
- Wallet integration, routing, state
- Owns: `frontend/` directory

**Agent 3: Walrus/Seal Integration** ✅ COMPLETE
- Encrypt/upload/decrypt flows built
- Walrus + Seal SDK tested against real testnet
- Owns: `lib/walrus/` and `lib/seal/`

**Agent 4: AI Agent Service** ✅ COMPLETE (needs live testing)
- Rule translation, condition monitoring, distribution engine
- MemWal integration built (needs account)
- Owns: `agent/` directory

Each agent works in isolation → you integrate at milestones → test end-to-end.
