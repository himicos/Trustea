# Build Phases — Trustea

## Timeline: 17 days (June 4 → June 21)

---

## Phase 1: Foundation (Days 1-4) — June 4-7

### Milestone: "Trust creation works end-to-end on testnet"

**Track 1: Smart Contracts (You + Claude)**
- [ ] Sui Move: `Trust` object — name, rules array, balance, beneficiary registry, Walrus blob refs
- [ ] Sui Move: `BeneficiaryNFT` — per-beneficiary object with embedded rule conditions
- [ ] Sui Move: `create_trust()`, `add_beneficiary()`, `deposit_funds()`, `release_funds()`
- [ ] Sui Move: Seal policy — `seal_approve()` combining whitelist + time lock
- [ ] Deploy to testnet, note package ID
- [ ] Write basic tests

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

### Phase 1 Gate: Can create a trust with rules and mint beneficiary NFTs on testnet

---

## Phase 2: Walrus Integration (Days 5-8) — June 8-11

### Milestone: "Documents encrypted, stored, and retrievable"

**Track 1: Walrus + Seal (You + Claude)**
- [ ] Encrypt trust document with Seal (AES + Seal key encrypt pattern)
- [ ] Upload encrypted blob to Walrus (`@mysten/walrus`)
- [ ] Store blobId in Trust Sui object
- [ ] Decrypt flow: beneficiary → SessionKey → seal_approve → decrypt
- [ ] Store trust amendment history on Walrus
- [ ] Document viewer component (decrypt + render)

**Track 2: AI Agent Core (You + Claude)**
- [ ] Agent service: condition checker loop
  - Time-based: check clock vs rule timestamp
  - NFT-based: check if beneficiary holds specific soulbound NFT
- [ ] Distribution proposal engine: when condition met → propose release
- [ ] MemWal integration: remember decisions, recall history
- [ ] Agent delegate key setup on testnet
- [ ] Agent activity log → store on Walrus

**Track 3: Frontend Build-Out (Anna + Claude)**
- [ ] Landing page design + implementation
- [ ] Create Trust wizard — Step 1 (name), Step 3 (beneficiaries), Step 4 (fund mgmt)
- [ ] Dashboard layout with trust cards
- [ ] Apply design system across all components
- [ ] Logo finalized + project logo (1:1 for submission)

### Phase 2 Gate: Full encrypt → store → decrypt flow works. Agent monitors conditions.

---

## Phase 3: The Magic (Days 9-12) — June 12-15

### Milestone: "AI translates English to rules + active fund management"

**Track 1: AI Rule Translation (You + Claude)**
- [ ] Claude/OpenAI integration: plain English → structured rule JSON
- [ ] Rule JSON → Move contract parameter mapping
- [ ] Frontend: Step 2 of wizard — type rule, see AI translation live
- [ ] Validation: AI confirms rule is enforceable
- [ ] Edge cases: handle ambiguous rules gracefully

**Track 2: Active Fund Management (You + Claude)**
- [ ] Integration with Scallop or other Sui DeFi protocol (testnet)
- [ ] Risk profiles: passive / conservative / moderate / aggressive
- [ ] AI agent: deposit/withdraw from lending pool within risk bounds
- [ ] Yield tracking: show earnings on dashboard
- [ ] All DeFi actions logged to MemWal + on-chain

**Track 3: Frontend Polish Phase 1 (Anna + Claude)**
- [ ] Trust management view (`/trust/:id`) — full implementation
- [ ] Beneficiary view (`/beneficiary/:nft_id`)
- [ ] Agent activity feed component
- [ ] Progress bars for condition tracking
- [ ] Responsive design pass

### Phase 3 Gate: Type English → see contract. Agent manages funds. Dashboard shows everything.

---

## Phase 4: Polish & Demo (Days 13-17) — June 16-21

### Milestone: "Submission-ready with killer demo"

**Track 1: Integration Testing (You)**
- [ ] End-to-end test: create trust → fund → add beneficiaries → condition met → release
- [ ] Test Seal decrypt from beneficiary perspective
- [ ] Test agent condition monitoring over time
- [ ] Test fund management yield rotation
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
- [ ] Public GitHub repo (clean commit history!)
- [ ] Project logo (1:1 JPG/PNG)
- [ ] Description: what it does, why it matters
- [ ] Submit on DeepSurge
- [ ] Double-check: package ID, demo video URL, website URL

### Phase 4 Gate: Submitted. Deployed on mainnet. Demo video live. README polished.

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
1. ✅ Create trust with plain English rules → AI translates → deploys on-chain
2. ✅ Mint beneficiary NFTs with embedded rules
3. ✅ Fund the trust (deposit USDC/SUI)
4. ✅ Trust documents encrypted via Seal → stored on Walrus
5. ✅ Dashboard showing trust status, beneficiaries, conditions
6. ✅ AI agent monitoring conditions + logging to MemWal
7. ✅ Condition met → propose + execute distribution
8. ✅ Beneficiary can view their NFT + decrypt trust docs

### SHOULD HAVE (makes the demo 2x better)
9. Active DeFi yield management (even conservative mode only)
10. Agent activity feed with real MemWal entries
11. Soulbound NFT verification (diploma check)
12. Trust amendment flow (grantor modifies rules)
13. Walrus Sites deployment (fully decentralized frontend)

### NICE TO HAVE (wow factor for judges)
14. Yield ticker showing real-time earnings
15. Multi-trust dashboard
16. Beneficiary onboarding flow (receive NFT, connect wallet, see terms)
17. Mobile responsive
18. SuiNS custom domain (trustea.wal.app)

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Move contracts take too long | Start with minimal contract, iterate. Seal patterns are copy-paste. |
| AI rule translation unreliable | Hardcode 3-5 rule templates + AI parsing. Fallback to template selection. |
| Walrus/Seal integration issues | Use reference code from `_ref/seal/examples/frontend/`. Proven patterns. |
| MemWal beta instability | Use as enhancement, not critical path. Agent can log to on-chain events as fallback. |
| DeFi integration complexity | Start with mock yield, add real Scallop integration if time allows. |
| Demo video quality | Film city shots early (Day 14-15). Edit is 1 day of work. Script is already written. |
| Mainnet deployment fails | Ensure testnet works perfectly first. Mainnet deploy is same commands + config swap. |
| Anna's bandwidth | Her work is parallelizable. Design → you approve → she implements. Claude assists. |

---

## Sub-Agent Build Strategy

### Parallel Agent Deployment (when building)

**Agent 1: Move Contracts**
- Writes and deploys smart contracts
- Tests on testnet
- Owns: `contracts/` directory

**Agent 2: Frontend**
- Next.js app with all pages
- Wallet integration, routing, state
- Owns: `frontend/` directory

**Agent 3: Walrus/Seal Integration**
- Encrypt/upload/decrypt flows
- Walrus SDK integration
- Owns: `lib/walrus/` and `lib/seal/`

**Agent 4: AI Agent Service**
- Rule translation, condition monitoring
- MemWal integration
- Owns: `agent/` directory

Each agent works in isolation → you integrate at milestones → test end-to-end.
