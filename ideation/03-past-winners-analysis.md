# Past Winners Analysis — Sui Overflow 2024 & 2025

## Scale Growth
| Year | Submissions | Countries | Tracks | Total Pool |
|------|------------|-----------|--------|------------|
| 2024 | 352 | 79 | 8 | Not disclosed |
| 2025 | 599 (+70%) | 85 | 9 | $550,000 |
| 2026 | TBD | TBD | 11+ | **$1,000,000+** |

---

## 2025 Winners (Most Relevant)

### AI Track
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **Suithetic** | LLM-powered structured synthetic data generation + onchain marketplace for verifiable datasets |
| 2nd | **OpenGraph** | Decentralized ML model building, verification, deployment on Sui + Walrus |
| 3rd | **RaidenX** | DeFAI data layer for AI trading agents |
| 4th | **Hyvve** | Token-incentivized data marketplace for AI training |

### Programmable Storage Track (= Walrus 2025)
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **SuiSign** | Decentralized document signing with verifiable onchain signatures |
| 2nd | **WalGraph** | First decentralized graph database on Sui/Walrus (JSON-LD, CRUD) |
| 3rd | **SuiMail** | Wallet-native decentralized email with pay-to-send spam prevention |
| 4th | **Walpress** | Censorship-resistant website builder on Walrus |

### DeFi Track
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **Magma Finance** | Programmable yield abstraction + modular vaults + AI rebalancing |
| 2nd | **Pismo Protocol** | Composable perpetuals exchange (7-service monorepo!) |
| 3rd | **MizuPay** | Mint mzUSD stablecoins against LBTC |
| 4th | **Kamo Finance** | Yield tokenization + time-decay AMM |

### Cryptography Track
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **ZeroLeaks** | ZK-powered whistleblowing — Circom circuits + Walrus + Seal |
| 2nd | **Shroud** | Privacy DEX with ZK-proof confidential swaps |

### Infra & Tooling
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **SuiSQL** | SQL database library for Sui/Walrus with indexes, joins, filters |
| 2nd | **Sui Provenance Suite** | Cryptographically verifiable code deployment |

### Payments & Wallets
| Place | Project | What They Built |
|-------|---------|-----------------|
| 1st | **PIVY** | Self-custodial stealth address payment toolkit |

---

## 2024 Notable Winners

| Track | 1st Place | What They Built |
|-------|-----------|-----------------|
| Gaming | **AresRPG** | 3D browser MMORPG using Sui as sole database — all game state on-chain |
| Infra | **Kraken** | Multisig ecosystem exploiting Sui's account model |
| zkLogin | **PinataBot** | Telegram bot for trading Sui assets via zkLogin |
| DeFi | **Hop Aggregator** | High-performance DEX aggregator with optimized routing |
| Consumer | **Pandora Finance** | Decentralized prediction market |

---

## Winning Patterns (CRITICAL)

### Pattern 1: Sui-Native Feature Exploitation (MANDATORY for 1st)
Every 1st-place winner deeply used a Sui-specific feature, NOT a port from Ethereum:
- AresRPG: Sui objects as sole game database
- ZeroLeaks: Seal + Walrus + Sui ZK in combination
- SuiSQL: Walrus as decentralized SQL backend
- Magma Finance: Move-native modular vault + AI

### Pattern 2: Complete Working Product (Not Just Contracts)
Winners ship:
- Full frontends with real UX
- Working integrations (Pyth, Walrus, zkLogin, Seal)
- Live demos with actual transactions
- Documentation sites

### Pattern 3: "This Could Be Real" Framing
Every winner had a clear real-world analogy:
- ZeroLeaks → protects journalists
- SuiSign → replaces DocuSign
- SuiMail → eliminates spam economically
- PIVY → privacy payments

### Pattern 4: Walrus Integration Strongly Favored
Projects using Walrus won across MULTIPLE tracks in 2025:
- ZeroLeaks (Crypto 1st), SuiSign (Storage 1st), WalGraph (Storage 2nd), SuiSQL (Infra 1st), SuiMail (Storage 3rd)

### Pattern 5: AI Crossover Projects Win Big
2025 showed AI + blockchain hybrid framing rewarded:
- Suithetic, Magma Finance (AI rebalancing), GiveRep (AI + social), Numeron (AI RPG)

### Pattern 6: Technical Quality Bar is HIGH
- ZeroLeaks: Custom Circom ZK circuits (real crypto engineering)
- Pismo Protocol: 7-service monorepo with Rust indexer + PostgreSQL
- SuiSQL: Actual SQL query engine implementation
- These are NOT weekend hacks — plan for serious engineering

### Pattern 7: Infrastructure Tracks Have Best ROI
Fewer competitors, judges value ecosystem impact, consistent winners year-over-year.

---

## Competition Intensity by Track (2025)
| Track | Level | Notes |
|-------|-------|-------|
| Entertainment & Culture | HIGHEST | Most submissions |
| AI | HIGH | Second most popular, many low-quality entries |
| DeFi | HIGH | Many ported EVM projects |
| Degen | MODERATE | Easy to enter |
| Cryptography | MODERATE-LOW | High skill floor |
| Infra & Tooling | LOW-MODERATE | Hardest to build |
| Payments & Wallets | LOW | Less glamorous |
| Programmable Storage | LOWEST | New track, Walrus-specific |

---

## What NOT To Do
- Don't port an existing Solana/EVM project — judges recognize immediately
- Don't submit contracts without a frontend
- Don't pick crowded tracks (Entertainment/AI) as a small team
- Don't build a "token" with no utility
- Don't ignore Walrus — it's the headline sponsor
