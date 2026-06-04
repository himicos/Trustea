# Agentic Web Track — Problem Statement

## Prize Pool: $62,500 total
- 1st: $30,000 | 2nd: $15,000 | 3rd: $10,000 | 4th: $7,500

## Critical Quote from Organizers
> "The Agentic Web track rewards projects that use Sui as a **meaningful part of the AI stack** — not as a payment rail bolted on at the end. Every submission must show why Sui specifically (Move objects, zkLogin, PTBs, Deepbook, Walrus, or Seal) makes the AI component better, safer, or more composable. **Generic LLM wrappers that happen to hold SUI will not place.**"

## Sub-tracks (inspiration only — all compete in one pool)

### Sub-track 1: Autonomous Risk Guardian
**Problem:** DeFi protocols run on static risk parameters. A de-peg or flash crash makes them stale within seconds.

**Build:** Live risk monitor for a Sui lending/perps protocol that:
- Ingests oracle price feeds
- Runs an AI risk model
- Autonomously executes parameter adjustment or market pause via Move policy object
- Every action logged on-chain
- Reversible by DAO override

**Hard Requirements:**
- ✅ Live price feed
- ✅ Visible AI risk score
- ✅ At least one autonomous on-chain action
- ✅ Human override mechanism

### Sub-track 2: Autonomous Agent Wallet
**Problem:** AI agents stuck at the "approve" wall — every action needs human signature.

**Build:** Agent wallet on Sui using zkLogin or Move policy object:
- Grants AI agent a capped budget + protocol scope (e.g., "max 500 USDC, Deepbook only, expires 24h")
- Agent autonomously executes strategy
- Enforces its own ceiling
- On-chain activity log
- Owner revocation demonstrable

**Hard Requirements:**
- ✅ Real Deepbook orders
- ✅ Self-enforced budget ceiling
- ✅ On-chain activity log
- ✅ Owner revocation demo

### Sub-track 3: Intent Engine
**Problem:** Users shouldn't need to know what a liquidity pool is.

**Build:** Intent engine that:
- Parses plain-English financial goal
- Compiles into Sui PTB
- Guardian check surfaces risks (high slippage, concentration, stale pools) in plain language
- User explicitly confirms before execution

> "A swap chatbot with no guardian layer is not an intent engine."

**Hard Requirements:**
- ✅ Text → PTB → execution flow
- ✅ Human-readable PTB preview
- ✅ Guardian catching at least 2 risk classes
- ✅ Explicit confirmation step

## Key Sui Primitives to Use
- **Move objects** — policy objects, on-chain state
- **zkLogin** — keyless auth for agents
- **PTBs** (Programmable Transaction Blocks) — composable tx execution
- **Deepbook** — on-chain orderbook
- **Walrus** — decentralized storage
- **Seal** — privacy layer
