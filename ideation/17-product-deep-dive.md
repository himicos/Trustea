# Trustea — Product Deep Dive

## The Core Mental Model

Trustea has **three user roles** and one **AI actor**:

| Role | What they do | Emotional state |
|------|-------------|-----------------|
| **Grantor** | Creates trusts, writes rules, funds them, oversees | "I want control and transparency" |
| **Beneficiary** | Receives NFT, tracks milestones, claims funds, views docs | "I want to know when I get my money" |
| **Viewer** (public link) | Sees trust overview, can't see encrypted docs or balances | "I was sent this link, what is this?" |
| **AI Agent** | Monitors conditions, proposes distributions, manages yield, logs everything | Runs autonomously, always auditable |

The product UX must serve all three simultaneously. The sidebar adapts based on who's connected.

---

## App Architecture

```
trustea.app/                        ← Landing (no wallet needed)
trustea.app/app                     ← Dashboard (wallet connected)
trustea.app/app/create              ← Create trust wizard (5 steps)
trustea.app/app/trust/[id]          ← Trust detail (grantor view)
trustea.app/app/trust/[id]/rules    ← Rules management
trustea.app/app/trust/[id]/agent    ← AI agent activity + MemWal
trustea.app/app/trust/[id]/docs     ← Encrypted documents
trustea.app/app/trust/[id]/invite   ← Invite beneficiaries
trustea.app/app/beneficiary/[nftId] ← Beneficiary portal
trustea.app/join/[code]             ← Invite link landing
```

---

## The Sidebar

Collapses to icons on mobile. Deep green (#0D6E4F) background, white text.

```
┌──────────────────────┐
│  🍃 Trustea          │  ← Logo, always links to /app
│                      │
│  ─── GRANTOR ───     │  ← Section only shows if you're a grantor
│  📊 Dashboard        │
│  ➕ Create Trust     │
│                      │
│  ─── YOUR TRUSTS ─── │  ← Lists trusts you created
│  🍵 Smith Family     │  ← Clicking expands sub-nav:
│     ├ Overview       │     /app/trust/[id]
│     ├ Rules          │     /app/trust/[id]/rules
│     ├ 🤖 Agent       │     /app/trust/[id]/agent
│     ├ 📄 Documents   │     /app/trust/[id]/docs
│     └ 👥 Invite      │     /app/trust/[id]/invite
│  🍵 Johnson Estate   │
│                      │
│  ─── BENEFICIARY ─── │  ← Section only shows if you hold BeneficiaryNFTs
│  🎫 Smith Family     │  ← Links to /app/beneficiary/[nftId]
│  🎫 Doe Foundation   │
│                      │
│  ─── AGENT ───       │  ← Shows if any trust has you as agent
│  🤖 Activity Log     │
│  🧠 Memory (MemWal)  │
│                      │
│  ──────────────      │
│  ⚙️  Settings        │
│  🔗 0xe50e...56      │  ← Connected wallet, click to disconnect
└──────────────────────┘
```

**How the sidebar knows what to show:**

On wallet connect, the frontend makes two parallel queries:
1. `fetchTrustsAsGrantor(address)` — query events where `TrustCreated.grantor == address`
2. `fetchBeneficiaryNFTs(address)` — `getOwnedObjects` with type filter `BeneficiaryNFT`

Backend support needed: **`lib/trust-reader.ts` already has `fetchBeneficiaryNFTs()`. Need to add `fetchTrustsCreatedBy(address)` — query `TrustCreated` events filtered by sender.**

---

## Landing Page (`/`)

No wallet required. Pure marketing. Must convert in 10 seconds.

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  [🍃 Trustea]                          [Connect Wallet →]  │
│                                                            │
│              ╭─────────────────────────╮                   │
│              │                         │                   │
│              │   The trust fund        │                   │
│              │   that runs itself.     │                   │
│              │                         │                   │
│              ╰─────────────────────────╯                   │
│                                                            │
│    Write rules in English. AI enforces them on-chain.      │
│    Encrypted. Permanent. No lawyers. No 2% fees.           │
│                                                            │
│         [ Create Your Trust ]    [ How it Works ↓ ]        │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│   ┌────────────┐   ┌────────────┐   ┌────────────┐       │
│   │    📝      │   │    🤖      │   │    🔒      │       │
│   │  Write     │   │  AI Agent  │   │  Encrypted │       │
│   │  Rules in  │   │  Monitors  │   │  on Walrus │       │
│   │  English   │   │  24/7      │   │  via Seal  │       │
│   │            │   │            │   │            │       │
│   │ "Pay Alice │   │ Checks     │   │ Only       │       │
│   │  $500/mo"  │   │ conditions │   │ authorized │       │
│   │  → on-chain│   │ proposes   │   │ parties    │       │
│   │  instantly │   │ releases   │   │ can view   │       │
│   └────────────┘   └────────────┘   └────────────┘       │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│   "HOW IT WORKS" SECTION                                   │
│                                                            │
│   Step 1: Create ──→ Step 2: Fund ──→ Step 3: Done        │
│                                                            │
│   You write the rules.                                     │
│   You add beneficiaries.                                   │
│   You deposit funds.                                       │
│   The AI does the rest — for decades.                      │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│   COMPARISON TABLE                                         │
│                                                            │
│   │               │ Traditional │  Trustea   │            │
│   │───────────────│─────────────│────────────│            │
│   │ Setup cost    │ $5,000+     │ ~$2 (gas)  │            │
│   │ Annual fee    │ 1-2% AUM    │ $0         │            │
│   │ Transparency  │ Opaque      │ On-chain   │            │
│   │ Audit trail   │ Paper files │ Walrus     │            │
│   │ Rule changes  │ Weeks       │ Minutes    │            │
│   │ Privacy       │ Lawyers see │ Seal       │            │
│   │ Duration      │ Human life  │ Permanent  │            │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│   Built on   [Sui]  [Walrus]  [Seal]  [MemWal]           │
│                                                            │
│   © 2026 Trustea  │  GitHub  │  Docs                      │
└────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Background: off-white (#FAFBFC)
- Hero text: near-black (#1A1A2E), Inter 48px bold
- Subtext: grey (#6B7280), Inter 20px
- CTA button: deep green (#0D6E4F) fill, white text, 12px radius, subtle shadow
- Cards: white bg, 1px green border (#0D6E4F at 20% opacity), 8px radius
- Sui/Walrus/Seal logos in grey, hover → color

---

## Create Trust Wizard — The Full Flow

### Step 1: Name & Purpose

Simple. Two inputs. Low friction entry.

- Trust name (required, max 64 chars)
- Purpose/description (optional textarea)
- **Backend**: Just state — no on-chain call yet. Everything batches in Step 5.

### Step 2: Rules in Plain English (THE HERO MOMENT)

This is where the product sells itself. The UI must feel magical.

```
┌────────────────────────────────────────────────────────────┐
│  Define Your Rules                          Step 2 of 5    │
│  ████████████░░░░░░░░░░░░                                  │
│                                                            │
│  Write rules in plain English. Our AI translates them      │
│  into programmable smart contract conditions.              │
│                                                            │
│  ┌──────────────────────────────────────────────┐         │
│  │ Release $50,000 to Alice when she turns 25   │  [Add]  │
│  └──────────────────────────────────────────────┘         │
│                                                            │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │  ✨ AI Translation (live, appears as you type)       │ │
│  │                                                       │ │
│  │  Rule Type: Time-based                                │ │
│  │  Trigger: Beneficiary age >= 25                       │ │
│  │  Amount: $50,000 (fixed)                              │ │
│  │  Recipient: "Alice" (wallet TBD in Step 3)            │ │
│  │                                                       │ │
│  │  Confidence: ████████████████████ 96%                 │ │
│  │                                                       │ │
│  │  ⚠️ Note: Requires Alice's birth date. You'll set    │ │
│  │     the exact timestamp in beneficiary details.       │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                            │
│  Your Rules:                                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 1  "Release $50,000 to Alice when she turns 25"    │   │
│  │    ✅ Time-based  │  $50,000  │  96% confidence     │   │
│  │    [Edit] [Remove]                                  │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ 2  "Send Bob $500 every month for college"          │   │
│  │    ✅ Periodic    │  $500/mo  │  94% confidence     │   │
│  │    [Edit] [Remove]                                  │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ 3  "Give Carol 10% of the balance each year"        │   │
│  │    ✅ Periodic    │  10%/yr   │  98% confidence     │   │
│  │    [Edit] [Remove]                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  💡 Try: "Pay tuition if enrolled in university"           │
│     "Release everything to my wife if I die"               │
│     "Distribute $1000 quarterly, pause if convicted"       │
│                                                            │
│  [← Back]                              [Continue →]        │
└────────────────────────────────────────────────────────────┘
```

**Frontend behavior:**
- Debounce input (500ms) → call `translateRule(input, apiKey)` 
- Show live translation card with animation (slide down, fade in)
- Confidence bar: green >= 90%, yellow 70-89%, red < 70%
- Warnings appear in amber (#F59E0B) inline
- Rules list is drag-reorderable
- "Try" suggestions at bottom cycle through examples

**Backend calls:**
- `POST` to `/api/translate-rule` → calls `translateRule()` from `agent/src/rule-translator.ts`
- Returns `TranslationResult { rule, explanation, confidence, warnings }`
- All stored client-side until Step 5

**Backend gap: Need a Next.js API route `/api/translate-rule` that wraps the rule translator.**

### Step 3: Add Beneficiaries

```
┌────────────────────────────────────────────────────────────┐
│  Add Beneficiaries                          Step 3 of 5    │
│  ██████████████████░░░░░░                                  │
│                                                            │
│  Each beneficiary receives a soulbound NFT that            │
│  encodes their rules and access rights.                    │
│                                                            │
│  ┌──────────────────────────────────────────────┐         │
│  │  Name: [Alice Smith          ]               │         │
│  │  Wallet: [0x7a3f...  ] or [Paste / QR scan] │         │
│  │  Rules: [✓ Rule 1: $50k at 25              ] │         │
│  │         [  Rule 2: $500/mo                  ] │         │
│  │         [  Rule 3: 10%/yr                   ] │         │
│  │  Birth date: [2006-03-15] (for age rules)    │         │
│  │                                     [Add →]  │         │
│  └──────────────────────────────────────────────┘         │
│                                                            │
│  ── OR ──                                                  │
│                                                            │
│  Don't have their wallet? Send an invite link:             │
│  [Generate Invite Link 🔗]                                 │
│                                                            │
│  Added Beneficiaries:                                      │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Alice Smith                                      │   │
│  │    0x7a3f...   │   Rule #1 (age-based, $50k)       │   │
│  │    [Remove]                                         │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ 👤 Bob Smith                                        │   │
│  │    ⏳ Invited (pending wallet)                       │   │
│  │    Rule #2 (periodic, $500/mo)                      │   │
│  │    Invite link: trustea.app/join/abc123              │   │
│  │    [Copy Link] [Remove]                              │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**The Invite Flow (key UX innovation):**

Grantors often don't have their child's/spouse's Sui wallet address. Solution:

1. Grantor clicks "Generate Invite Link" → creates a pending beneficiary
2. System generates a unique code → `trustea.app/join/[code]`
3. Grantor shares link via text/email/WhatsApp
4. Beneficiary opens link → connects wallet → their address is captured
5. On trust deployment, the beneficiary NFT is minted to that address

**Backend needs:**
- `invites` table or on-chain registry mapping invite codes → trust + rule assignment
- `/join/[code]` page: shows trust name + what rules apply to them (no sensitive data)
- After wallet connect: stores their address, marks invite as claimed
- On deploy: uses the resolved addresses for `buildAddBeneficiaryTx()`

**Backend gap: Need invite code generation + storage. Options:**
1. **Simple**: Store in a JSON blob on Walrus (encrypted). Code = blobId prefix.
2. **Better**: Use Sui dynamic fields on the Trust object as a pending-invite registry.
3. **Pragmatic for hackathon**: Store in-memory on the Next.js server or in localStorage. Resolve before deploy.

**Recommendation: Option 3 for hackathon. Invites are pre-deploy state — just client-side state persisted in localStorage. On deploy, all addresses must be resolved.**

### Step 4: Fund & Risk Profile

Same as in existing UX doc. Two decisions:
1. How much SUI to deposit initially
2. What risk profile for the AI yield manager

**Backend**: Already have `buildDepositTx()` and yield manager risk profiles.

### Step 5: Review & Deploy

The "big button" moment. Shows a summary, then executes a batch transaction:

```
Deploy sequence (one PTB with multiple commands):
  1. create_trust(name, description, agentAddress, clock)
  2. deposit(trust, coin)
  3. add_beneficiary(trust, alice, ..., clock)  → mints NFT
  4. add_beneficiary(trust, bob, ..., clock)    → mints NFT
  5. add_rule(trust, rule1_type, alice, ...)
  6. add_rule(trust, rule2_type, bob, ...)
  7. add_walrus_ref(trust, blobId)  → trust agreement doc
```

**Backend gap: Need `buildFullDeployTx()` that composes all individual builders into a single PTB. This is critical — the user signs ONCE, not 7 times.**

This function takes the entire wizard state and returns one `Transaction`:

```ts
function buildFullDeployTx(params: {
  name: string;
  description: string;
  agentAddress: string;
  depositAmount: bigint;
  beneficiaries: { address: string; name: string; ... }[];
  rules: TrustRule[];
  documentBlobId?: string;
}): Transaction
```

---

## Dashboard (`/app`)

What you see after connecting wallet.

```
┌─ Sidebar ──┬────────────────────────────────────────────────┐
│             │                                                │
│  🍃 Trustea │  Good evening, 0xe50e...56                     │
│             │                                                │
│  ── GRANTOR │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  📊 Dash    │  │ 2        │ │ $103,420 │ │ +$3,420  │      │
│  ➕ Create  │  │ Active   │ │ Total    │ │ Yield    │      │
│             │  │ Trusts   │ │ AUM      │ │ Earned   │      │
│  ── TRUSTS  │  └──────────┘ └──────────┘ └──────────┘      │
│  🍵 Smith   │                                                │
│  🍵 Johnson │  Your Trusts                                   │
│             │  ┌────────────────────────────────────────┐   │
│  ── BENEFI. │  │  🍵 Smith Family Trust          Active │   │
│  🎫 Smith   │  │     Balance: 50,420 SUI  │  Yield: 3.4% │ │
│             │  │     👥 3 beneficiaries │ 📋 3 rules     │   │
│  ── AGENT   │  │     🤖 Agent: monitoring │ 🧠 47 memories│  │
│  🤖 Log     │  │     Last activity: 2 hours ago          │   │
│  🧠 Memory  │  │                                         │   │
│             │  │     ┌─ Upcoming ────────────────────┐   │   │
│  ⚙️ Settings│  │     │ 📅 Carol annual dist — 209 days│   │   │
│  🔗 0xe50.. │  │     │ 🎂 Alice age unlock — 1.8 yrs  │   │   │
│             │  │     └──────────────────────────────┘   │   │
│             │  │                              [Manage →] │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  ┌────────────────────────────────────────┐   │
│             │  │  🍵 Johnson Estate Trust       Active  │   │
│             │  │     Balance: 53,000 SUI  │  Yield: 2.1%│   │
│             │  │     👥 1 beneficiary  │ 📋 1 rule       │   │
│             │  │                              [Manage →] │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  Recent Agent Activity (across all trusts)     │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ 🤖 2h ago  — Checked Alice age: 23     │   │
│             │  │ 💰 5h ago  — Earned $12.40 from Scallop│   │
│             │  │ 📋 1d ago  — Compliance review passed   │   │
│             │  │ 🔄 3d ago  — Rebalanced yield portfolio│   │
│             │  │              [View All Activity →]      │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
└─────────────┴────────────────────────────────────────────────┘
```

**Key insight**: The dashboard is different for grantors vs pure beneficiaries. If you only hold BeneficiaryNFTs (no trusts created), the dashboard shows your trusts as a beneficiary with milestone tracking instead.

---

## Trust Detail View (`/app/trust/[id]`)

### Overview Tab

```
┌─ Sidebar ──┬────────────────────────────────────────────────┐
│             │  Smith Family Trust                            │
│   ...       │  Created June 4, 2026  │  Status: ● Active    │
│             │                                                │
│             │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│             │  │50,420│ │+$420 │ │  3   │ │  3   │        │
│             │  │ SUI  │ │Yield │ │Benef.│ │Rules │        │
│             │  └──────┘ └──────┘ └──────┘ └──────┘        │
│             │                                                │
│             │  [Overview] [Rules] [Agent] [Documents]        │
│             │  ━━━━━━━━━                                     │
│             │                                                │
│             │  Beneficiaries                                 │
│             │  ┌──────────────────────────────────────┐     │
│             │  │ 👤 Alice Smith                        │     │
│             │  │    Rule: $50,000 when age >= 25       │     │
│             │  │    ████████████████░░░░  80%           │     │
│             │  │    ⏳ 1 year, 283 days to unlock      │     │
│             │  │                                        │     │
│             │  │ 👤 Bob Smith                           │     │
│             │  │    Rule: $500/month (periodic)         │     │
│             │  │    ✅ Active — last paid May 1         │     │
│             │  │    Next: June 1, 2026                  │     │
│             │  │                                        │     │
│             │  │ 👤 Carol Smith                         │     │
│             │  │    Rule: 10% annually                  │     │
│             │  │    ✅ Last paid: Jan 1, 2026           │     │
│             │  │    Next: Jan 1, 2027 (209 days)        │     │
│             │  └──────────────────────────────────────┘     │
│             │                                                │
│             │  Quick Actions                                 │
│             │  [+ Add Beneficiary] [+ Top Up] [+ Add Rule]  │
│             │  [📎 Invite Link]    [⏸ Pause]  [📝 Amend]    │
│             │                                                │
└─────────────┴────────────────────────────────────────────────┘
```

### Agent Tab (`/app/trust/[id]/agent`)

This is the MemWal-powered brain view:

```
│  🤖 AI Trustee Agent                                        │
│                                                              │
│  Status: ● Active  │  Memory: 47 entries  │  Last: 2h ago   │
│                                                              │
│  ┌── Agent Memory (MemWal) ────────────────────────────┐    │
│  │                                                      │    │
│  │  The agent maintains persistent memory across all    │    │
│  │  sessions. Every decision is stored on Walrus via    │    │
│  │  MemWal and can be recalled or audited at any time.  │    │
│  │                                                      │    │
│  │  Memory Namespaces:                                  │    │
│  │  📋 Decisions (23 entries)                           │    │
│  │  📊 Events (15 entries)                              │    │
│  │  💬 Communications (9 entries)                       │    │
│  │                                    [Browse Memory →] │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Activity Timeline                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Jun 4, 10:30 PM                                      │   │
│  │ 🔍 CONDITION CHECK                                   │   │
│  │    Checked 3 rules across 3 beneficiaries            │   │
│  │    • Alice age condition: NOT MET (age 20, need 25)  │   │
│  │    • Bob periodic: DUE (last paid May 1)             │   │
│  │    • Carol annual: NOT DUE (next Jan 1)              │   │
│  │    Memory: condition_check_1717539000                 │   │
│  │                                                      │   │
│  │ Jun 4, 10:31 PM                                      │   │
│  │ 💰 DISTRIBUTION PROPOSED                             │   │
│  │    Proposing $500 to Bob (monthly allowance)         │   │
│  │    Rule #2 triggered │ Veto window: 48 hours         │   │
│  │    On-chain tx: 6X4Y...9M3                           │   │
│  │    Memory: distribution_proposals_1717539060          │   │
│  │                                                      │   │
│  │ Jun 4, 10:32 PM                                      │   │
│  │ 📈 YIELD ACTION                                      │   │
│  │    Deposited 60% to Scallop (6.0% APY)              │   │
│  │    Deposited 40% to SUI Staking (4.5% APY)          │   │
│  │    Risk profile: Conservative                        │   │
│  │    Memory: yield_strategy_1717539120                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Agent Configuration                                         │
│  Risk Profile: [Conservative ▾]                              │
│  Check interval: Every 6 hours                               │
│  Override period: 48 hours                                   │
│  [⏸ Pause Agent]  [🔄 Run Cycle Now]                        │
```

**MemWal integration details:**
- Each trust gets its own MemWal namespace: `trustea:{trustId}`
- Sub-namespaces: `decisions`, `events`, `comms`
- Agent stores after every action: `memwalClient.rememberAndWait(namespace, content)`
- "Browse Memory" page queries: `memwalClient.recall(namespace, query, limit)`
- Memory entries link to on-chain `AgentAction` events for cross-referencing

**Backend gap: Need a MemWal account + delegate key. The client code (`lib/memwal/client.ts`) is ready but untested.**

---

## Beneficiary Portal (`/app/beneficiary/[nftId]`)

What Alice, Bob, or Carol see when they connect their wallet.

```
┌─ Sidebar ──┬────────────────────────────────────────────────┐
│             │                                                │
│  🍃 Trustea │  Welcome, Alice                                │
│             │                                                │
│  ── YOUR    │  ┌────────────────────────────────────────┐   │
│  TRUSTS     │  │                                        │   │
│  🎫 Smith   │  │   🎫  Beneficiary NFT                  │   │
│             │  │       Smith Family Trust                │   │
│  ⚙️ Settings│  │                                        │   │
│  🔗 0x7a3.. │  │   Allocation: $50,000                  │   │
│             │  │   Condition: Reach age 25               │   │
│             │  │   Status: ⏳ Locked                     │   │
│             │  │                                        │   │
│             │  │   ████████████████░░░░ 80%              │   │
│             │  │   1 year, 283 days remaining            │   │
│             │  │                                        │   │
│             │  │   When unlocked, your AI trustee will   │   │
│             │  │   propose the release. Funds transfer   │   │
│             │  │   after a 48-hour review window.        │   │
│             │  │                                        │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  Your Milestones                                │
│             │  ┌────────────────────────────────────────┐   │
│             │  │                                        │   │
│             │  │  ✅ Added to trust         Jun 4, 2026 │   │
│             │  │  │                                     │   │
│             │  │  ✅ NFT minted to wallet   Jun 4, 2026 │   │
│             │  │  │                                     │   │
│             │  │  ⏳ Trust funded            Jun 4, 2026 │   │
│             │  │  │  50,000 SUI deposited               │   │
│             │  │  │                                     │   │
│             │  │  ○ Age condition met        Mar 15, 2028│  │
│             │  │  │                                     │   │
│             │  │  ○ Distribution proposed    ~Mar 2028   │   │
│             │  │  │  (auto, by AI agent)                │   │
│             │  │  │                                     │   │
│             │  │  ○ 48-hour veto window      ~Mar 2028  │   │
│             │  │  │                                     │   │
│             │  │  ○ Funds released           ~Mar 2028  │   │
│             │  │     $50,000 → your wallet              │   │
│             │  │                                        │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  Your Documents (Encrypted)                     │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ 📄 Trust Agreement        [Decrypt →]  │   │
│             │  │ 📄 Your Allocation Terms  [Decrypt →]  │   │
│             │  │                                        │   │
│             │  │ 🔒 Encrypted with Seal. Only you and   │   │
│             │  │    the grantor can view these files.    │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  Recent Activity                                │
│             │  ├─ 2h ago — Agent checked your age: 20       │
│             │  ├─ 1w ago — Trust balance grew by $142       │
│             │  └─ Jun 4 — You were added as beneficiary      │
│             │                                                │
└─────────────┴────────────────────────────────────────────────┘
```

**The milestone timeline is key.** Beneficiaries want to know:
1. What's the condition?
2. How far along am I?
3. What happens next?
4. When do I get my money?

The vertical timeline with checkmarks + pending circles answers all of this.

**The Decrypt flow:**
1. Beneficiary clicks "Decrypt →"
2. Frontend creates a SessionKey: `createSessionKey(address, packageId, suiClient)`
3. Wallet signs the personal message
4. Calls `fetchAndDecrypt(blobId, trustId, ...)`
5. Seal key server verifies via `seal_approve` — checks whitelist + time-lock
6. Document decrypted and displayed in a modal/viewer

**Backend**: All exists in `lib/seal/client.ts` and `lib/seal/encrypt-store.ts`.

---

## Invite Flow (`/join/[code]`)

When a beneficiary doesn't have a wallet yet.

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  🍃 Trustea                                                │
│                                                            │
│  You've been added to a trust fund.                        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │  🍵 Smith Family Trust                             │   │
│  │                                                    │   │
│  │  Created by: 0xAAAA...                             │   │
│  │  Your role: Beneficiary                            │   │
│  │  Your rule: "Receive $50,000 when you turn 25"     │   │
│  │                                                    │   │
│  │  To claim your position, connect a Sui wallet.     │   │
│  │  A soulbound NFT encoding your rights will be      │   │
│  │  minted to your wallet when the trust deploys.     │   │
│  │                                                    │   │
│  │         [ Connect Wallet to Join ]                 │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Don't have a wallet?                                      │
│  Download Sui Wallet → [Chrome] [iOS] [Android]            │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│  What is Trustea?                                          │
│  An on-chain trust fund platform. Your grantor has         │
│  set up rules that automatically release funds to you      │
│  when conditions are met. No intermediaries. No fees.      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**After connecting:**
- Their address is stored against the invite code
- They see: "You're in! Your NFT will be minted when the trust is deployed."
- If trust is already deployed: the grantor can add them in a follow-up transaction

---

## Beneficiary Verification (Sub-Ownership Check)

**How the backend knows someone is a beneficiary:**

```
Frontend: User connects wallet → address = 0x7a3f...

Query 1: getOwnedObjects(address, { 
  filter: { StructType: `${PACKAGE_ID}::beneficiary_nft::BeneficiaryNFT` }
})

Result: [
  { objectId: "0xNFT1", fields: { trust_id: "0xTRUST1", beneficiary: "0x7a3f..." } },
  { objectId: "0xNFT2", fields: { trust_id: "0xTRUST2", beneficiary: "0x7a3f..." } },
]

→ User is a beneficiary of TRUST1 and TRUST2
→ Sidebar shows both under "BENEFICIARY" section
→ Each links to /app/beneficiary/[nftObjectId]
```

**The NFT IS the proof.** No separate database. No token-gating API. The soulbound BeneficiaryNFT in their wallet IS the verification. If they have it, they're a beneficiary. If they don't, they're not. The Seal `seal_approve` function checks the same thing on-chain when they try to decrypt documents.

**Backend**: `lib/trust-reader.ts` `fetchBeneficiaryNFTs()` already does this.

**What we still need:**
- `fetchTrustsCreatedBy(address)` in `trust-reader.ts` — for the grantor side of the sidebar

---

## Backend Gaps to Support All This

### New code needed:

| Component | File | What |
|---|---|---|
| `buildFullDeployTx()` | `lib/transactions.ts` | Compose entire wizard into one PTB |
| `fetchTrustsCreatedBy()` | `lib/trust-reader.ts` | Query TrustCreated events by sender |
| Rule translation API route | `frontend/app/api/translate-rule/route.ts` | Next.js route wrapping rule-translator |
| Invite code system | `frontend/lib/invites.ts` | Generate/resolve invite codes (localStorage for hackathon) |
| Seal decrypt API route | `frontend/app/api/decrypt/route.ts` | Or do entirely client-side with dapp-kit |
| Agent cycle trigger | `frontend/app/api/agent/run/route.ts` | Trigger agent.runCycle() on demand |

### Existing code that just needs wiring:

| Already built | Where | Used by |
|---|---|---|
| All 14 PTB builders | `lib/transactions.ts` | Every on-chain action in the frontend |
| Trust state reader | `lib/trust-reader.ts` | Dashboard, trust detail, beneficiary portal |
| Seal encrypt/decrypt | `lib/seal/client.ts` | Document upload/view |
| Walrus store/retrieve | `lib/walrus/client.ts` | Document storage |
| Rule translator | `agent/src/rule-translator.ts` | Step 2 of wizard |
| Condition monitor | `agent/src/condition-monitor.ts` | Agent tab, milestone tracking |
| Distribution engine | `agent/src/distribution-engine.ts` | Proposal generation |
| MemWal client | `lib/memwal/client.ts` | Agent memory browser |

---

## Color System Applied

```
Background:     #FAFBFC  — page bg, light mode
Surface:        #FFFFFF  — cards, modals, inputs
Border:         #E5E7EB  — subtle card borders
Border accent:  #0D6E4F20 — green tint borders for trust cards

Text primary:   #1A1A2E  — headings, body
Text secondary: #6B7280  — descriptions, labels
Text muted:     #9CA3AF  — timestamps, metadata

Green primary:  #0D6E4F  — CTA buttons, sidebar bg, active states
Green light:    #10B981  — success badges, "active" dots, progress bars
Green surface:  #ECFDF5  — light green background for success alerts

Sui blue:       #4DA2FF  — links, ecosystem badges, secondary actions
Blue surface:   #EFF6FF  — light blue background for info alerts

Warning:        #F59E0B  — confidence < 90%, pending states
Warning surface:#FFFBEB  — light amber bg for warnings

Error:          #EF4444  — errors, < 70% confidence, destructive actions
Error surface:  #FEF2F2  — light red bg for errors

Sidebar:        #0D6E4F  — deep green background
Sidebar text:   #FFFFFF  — white text
Sidebar active: #FFFFFF20 — white at 12% opacity for selected item
Sidebar hover:  #FFFFFF10 — white at 6% for hover

Progress bar:   #10B981 on #E5E7EB  — emerald fill on grey track
```

---

## What Backend to Build Next (Priority Order)

1. **`buildFullDeployTx()`** — compose wizard state into single PTB (30 min)
2. **`fetchTrustsCreatedBy()`** — query events for grantor sidebar (20 min)
3. **Next.js app scaffold** — pages, layouts, sidebar, wallet connect (2-3 hours)
4. **`/api/translate-rule` route** — wrap rule translator for frontend (15 min)
5. **Create wizard flow** — the 5 steps, state management, deploy button (3-4 hours)
6. **Dashboard** — trust cards, agent activity feed (2-3 hours)
7. **Trust detail** — overview, rules, agent, docs tabs (2-3 hours)
8. **Beneficiary portal** — NFT display, milestone timeline, decrypt (2-3 hours)
9. **Invite flow** — code generation, join page (1 hour)
10. **MemWal account setup** — get delegate key, test (30 min)
