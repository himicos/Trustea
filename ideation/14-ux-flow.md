# Trustea — Full UX Flow

## Design Direction

### Brand
- **Logo**: Tea leaf motif — leaf = trust, growth, organic inheritance
- **Name**: Trustea (trust + tea) — pronounced "trustee"
- **Vibe**: SF fintech meets web3 — clean, confident, premium but accessible

### Color Palette
- **Primary**: Deep green (#0D6E4F) — trust, growth, tea
- **Secondary**: White (#FFFFFF) — clarity, clean
- **Accent**: Sui blue (#4DA2FF) — ecosystem alignment
- **Background**: Off-white (#FAFBFC) — soft, professional
- **Text**: Near-black (#1A1A2E) — readable
- **Success**: Emerald (#10B981)
- **Warning**: Amber (#F59E0B)
- **Cards**: White with subtle green border or shadow

### Typography
- **Headings**: Inter (clean, SF-native, Sui ecosystem uses it)
- **Body**: Inter
- **Mono** (contract details): JetBrains Mono

### UI Components
- Rounded buttons (Sui-friendly radius ~12px)
- Card-based layouts with subtle shadows
- Smooth transitions (200ms ease)
- Toast notifications for on-chain confirmations
- Wallet connection prominent but not overwhelming

---

## Screen-by-Screen Flow

### 1. Landing Page (`/`)

```
┌──────────────────────────────────────────────────┐
│  [Logo] Trustea                    [Connect Wallet] │
│                                                      │
│        On-chain trust management                     │
│        for the next century.                         │
│                                                      │
│   Programmable rules. AI-managed funds.              │
│   Verifiable on Walrus. Secured by Sui.              │
│                                                      │
│        [Create Your Trust]   [Learn More]            │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 100x     │ │ Decades  │ │ AI       │            │
│  │ Cheaper  │ │ of       │ │ Managed  │            │
│  │ than     │ │ Verifiable│ │ Funds    │            │
│  │ trustees │ │ History  │ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  Powered by [Sui] [Walrus] [Seal]                   │
└──────────────────────────────────────────────────────┘
```

**Actions**: Connect wallet → redirects to Dashboard

---

### 2. Dashboard (`/dashboard`)

The home base after connecting. Shows all trusts you're involved in.

```
┌──────────────────────────────────────────────────┐
│  [Logo]  Dashboard                 [0x1a2...] 🟢  │
│                                                      │
│  My Trusts (as Grantor)              [+ Create New] │
│  ┌────────────────────────────────────────────┐     │
│  │ 🍵 Smith Family Trust                      │     │
│  │    Balance: 250,000 USDC                    │     │
│  │    Beneficiaries: 3  │  Rules: 5 active     │     │
│  │    Status: ● Active  │  Agent: ● Monitoring │     │
│  │    [Manage] [View Activity]                 │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  My Trusts (as Beneficiary)                          │
│  ┌────────────────────────────────────────────┐     │
│  │ 🍵 Smith Family Trust                      │     │
│  │    Your allocation: $50,000 USDC            │     │
│  │    Conditions: 2/3 met ████████░░           │     │
│  │    Next milestone: University graduation    │     │
│  │    [View Details]                           │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  AI Agent Activity (last 7 days)                     │
│  ├─ ✅ Checked Alice's age condition — met           │
│  ├─ 💰 Yield earned: +$342 from DeFi rotation       │
│  ├─ 📋 Quarterly compliance review — passed          │
│  └─ 🔍 Verified Bob's enrollment NFT — pending       │
└──────────────────────────────────────────────────────┘
```

---

### 3. Create Trust Wizard (`/create`)

**Step 1: Name & Description**
```
┌──────────────────────────────────────────────────┐
│  Create Your Trust                    Step 1 of 5 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ██████░░░░░░░░░░░░░░░░░░                         │
│                                                      │
│  Trust Name                                          │
│  ┌──────────────────────────────────────┐           │
│  │ Smith Family Trust                    │           │
│  └──────────────────────────────────────┘           │
│                                                      │
│  Purpose (optional)                                  │
│  ┌──────────────────────────────────────┐           │
│  │ Education and milestone-based wealth  │           │
│  │ distribution for my children          │           │
│  └──────────────────────────────────────┘           │
│                                                      │
│                              [Continue →]            │
└──────────────────────────────────────────────────────┘
```

**Step 2: Add Rules (Plain English) ⭐ THE HERO MOMENT**
```
┌──────────────────────────────────────────────────┐
│  Define Your Rules                    Step 2 of 5 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ████████████░░░░░░░░░░░░                         │
│                                                      │
│  Write rules in plain English. The AI will           │
│  translate them into smart contract conditions.      │
│                                                      │
│  ┌──────────────────────────────────────┐           │
│  │ Release $50,000 to Alice when she    │  [+ Add] │
│  │ turns 25                              │           │
│  └──────────────────────────────────────┘           │
│                                                      │
│  Active Rules:                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ 1. "Release $50,000 to Alice at age 25"    │     │
│  │    → Condition: timestamp >= 2031-03-15     │     │
│  │    → Action: transfer 50,000 USDC to Alice  │     │
│  │    ✅ AI translated  [Edit] [Remove]        │     │
│  ├────────────────────────────────────────────┤     │
│  │ 2. "Pay Bob's tuition if enrolled in uni"   │     │
│  │    → Condition: holds University Diploma NFT│     │
│  │    → Action: release up to 30,000 USDC/year │     │
│  │    ✅ AI translated  [Edit] [Remove]        │     │
│  ├────────────────────────────────────────────┤     │
│  │ 3. "Distribute 10% annually to Carol"       │     │
│  │    → Condition: yearly on Jan 1              │     │
│  │    → Action: transfer 10% of balance         │     │
│  │    ✅ AI translated  [Edit] [Remove]        │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  [← Back]                        [Continue →]       │
└──────────────────────────────────────────────────────┘
```

**Step 3: Add Beneficiaries**
```
┌──────────────────────────────────────────────────┐
│  Add Beneficiaries                    Step 3 of 5 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ██████████████████░░░░░░                         │
│                                                      │
│  Each beneficiary receives a programmable NFT        │
│  with their specific rules embedded.                 │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ 👤 Alice                                    │     │
│  │    Wallet: 0x7a3...  │  Rules: #1           │     │
│  │    NFT will contain: age-based release       │     │
│  ├────────────────────────────────────────────┤     │
│  │ 👤 Bob                                      │     │
│  │    Wallet: 0x9f1...  │  Rules: #2           │     │
│  │    NFT will contain: credential-based        │     │
│  ├────────────────────────────────────────────┤     │
│  │ 👤 Carol                                    │     │
│  │    Wallet: 0x2d8...  │  Rules: #3           │     │
│  │    NFT will contain: annual distribution     │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  [+ Add Beneficiary]                                 │
│  [← Back]                        [Continue →]       │
└──────────────────────────────────────────────────────┘
```

**Step 4: Fund Management**
```
┌──────────────────────────────────────────────────┐
│  Fund Management                      Step 4 of 5 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ██████████████████████████░░                     │
│                                                      │
│  Initial Deposit                                     │
│  ┌──────────────────────────────────────┐           │
│  │ 100,000                    [USDC ▼] │           │
│  └──────────────────────────────────────┘           │
│  Balance: 250,000 USDC available                    │
│                                                      │
│  AI Fund Management (optional)                       │
│  ┌────────────────────────────────────────────┐     │
│  │ ○ Passive — Hold assets as deposited        │     │
│  │ ● Conservative — Low-risk yield (3-5% APY)  │     │
│  │ ○ Moderate — Balanced yield (5-10% APY)     │     │
│  │ ○ Aggressive — Higher risk (10%+ APY)       │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  The AI agent will rotate funds through              │
│  vetted DeFi protocols within your risk bounds.      │
│  All actions logged on Walrus for full auditability. │
│                                                      │
│  [← Back]                        [Continue →]       │
└──────────────────────────────────────────────────────┘
```

**Step 5: Review & Deploy**
```
┌──────────────────────────────────────────────────┐
│  Review & Deploy                      Step 5 of 5 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ████████████████████████████████████████         │
│                                                      │
│  Smith Family Trust                                  │
│                                                      │
│  Rules: 3 active conditions                          │
│  Beneficiaries: Alice, Bob, Carol                    │
│  Initial Deposit: 100,000 USDC                       │
│  Fund Strategy: Conservative (3-5% APY)              │
│                                                      │
│  Documents stored on: Walrus (encrypted via Seal)    │
│  Access control: Beneficiary whitelist + time locks  │
│  AI Agent: Enabled with MemWal persistent memory     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ 📜 Smart Contract Preview                   │     │
│  │                                              │     │
│  │ module trustea::smith_family_trust {         │     │
│  │   // Trust rules, beneficiary NFTs,          │     │
│  │   // Seal policies, fund management...       │     │
│  │ }                                            │     │
│  │ [View Full Contract]                         │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  [← Back]         [Deploy to Sui ✨]                │
│                                                      │
│  Deploying will:                                     │
│  • Create the trust smart contract on Sui            │
│  • Mint beneficiary NFTs                             │
│  • Encrypt & store trust documents on Walrus         │
│  • Activate the AI trustee agent                     │
└──────────────────────────────────────────────────────┘
```

---

### 4. Trust Management View (`/trust/:id`)

```
┌──────────────────────────────────────────────────┐
│  Smith Family Trust                    [Settings] │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │   Balance    │ │  Yield      │ │  Active     │  │
│  │  $103,420    │ │  +$3,420    │ │  Rules      │  │
│  │    USDC      │ │  (3.4%)     │ │    3        │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                      │
│  [Beneficiaries] [Rules] [Agent Activity] [Docs]    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                                      │
│  Beneficiaries                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ 👤 Alice        $50,000 allocated            │     │
│  │    Age: 23 → Unlocks at 25 (2028-03-15)     │     │
│  │    ████████████████░░░░ 80%                  │     │
│  │    Status: ⏳ Waiting for age condition       │     │
│  ├────────────────────────────────────────────┤     │
│  │ 👤 Bob          $30,000/yr allocated         │     │
│  │    Condition: University enrollment NFT       │     │
│  │    Status: 🔍 Checking credential...         │     │
│  ├────────────────────────────────────────────┤     │
│  │ 👤 Carol        10% annual distribution      │     │
│  │    Next: Jan 1, 2027                         │     │
│  │    Status: ✅ Last paid: Jan 1, 2026         │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  AI Agent Activity                                   │
│  ┌────────────────────────────────────────────┐     │
│  │ 🤖 Agent Status: ● Active                   │     │
│  │ Memory: 47 entries on Walrus (MemWal)        │     │
│  │                                              │     │
│  │ Recent:                                      │     │
│  │ Jun 4 — Rotated 20% to Scallop lending pool │     │
│  │ Jun 3 — Quarterly compliance check passed    │     │
│  │ Jun 1 — Verified Carol's annual distribution │     │
│  │ May 28 — Rebalanced: moved to lower-risk    │     │
│  │ [View Full History on Walrus →]              │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Trust Documents (Encrypted on Walrus)               │
│  ┌────────────────────────────────────────────┐     │
│  │ 📄 Trust Agreement v1.0    [View] [Amend]   │     │
│  │ 📄 Beneficiary Rules       [View]            │     │
│  │ 📄 Amendment Log           [View]            │     │
│  │ 🔒 Encrypted via Seal — only authorized      │     │
│  │    parties can decrypt                       │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  [+ Top Up Funds] [+ Add Beneficiary] [Amend Rules] │
└──────────────────────────────────────────────────────┘
```

---

### 5. Beneficiary View (`/beneficiary/:nft_id`)

What beneficiaries see when they connect their wallet.

```
┌──────────────────────────────────────────────────┐
│  🍵 Your Trust: Smith Family Trust                │
│                                                      │
│  You are a beneficiary of this trust.                │
│  Your rights are embedded in your Beneficiary NFT.   │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │  🎫 Beneficiary NFT #001                    │     │
│  │                                              │     │
│  │  Name: Alice Smith                           │     │
│  │  Allocation: $50,000 USDC                    │     │
│  │  Condition: Reach age 25                     │     │
│  │  Status: ⏳ 1 year, 283 days remaining       │     │
│  │                                              │     │
│  │  Progress: ████████████████░░░░ 80%          │     │
│  │                                              │     │
│  │  When condition is met, the AI agent will    │     │
│  │  propose distribution. Funds transfer        │     │
│  │  automatically after 7-day override period.  │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Your Documents (Seal-encrypted, only you can see)   │
│  📄 Trust terms applicable to you    [Decrypt & View]│
│                                                      │
│  Trust Activity (relevant to you)                    │
│  ├─ Jun 4 — AI agent confirmed your age: 23         │
│  ├─ Jan 1 — Annual trust review completed            │
│  └─ Nov 15 — Trust created, you were added           │
└──────────────────────────────────────────────────────┘
```

---

## What's "Shiny" for the Demo

### The 5 Wow Moments (in order of impact)

1. **Plain English → Smart Contract** — Type "Release $50k to Alice when she turns 25" → AI instantly shows the translated condition → deploys to Sui. This is the "holy shit" moment.

2. **Beneficiary gets NFT with rules embedded** — Add a wallet address → they receive a beautiful programmable NFT that IS their trust document. Not a JPEG. A rights instrument.

3. **AI Agent Dashboard** — Live view of the agent monitoring conditions, making yield decisions, logging everything to Walrus. It's not a static contract — it's alive.

4. **Seal Decrypt Flow** — Beneficiary clicks "View Trust Document" → Seal checks their wallet against the Move policy → decrypts and shows. Only THEY can see it. Visible privacy.

5. **Yield ticker** — Trust balance growing in real-time from DeFi yield management. The trust isn't just sitting there — the AI is working it within risk bounds.
