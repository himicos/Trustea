# Walrus Track — Problem Statement

## Prize Pool: $70,000 total
- 1st: $35,000 | 2nd: $15,000 | 3rd: $7,500 | 4th: $5,000
- +$7,500 honorable mentions / special awards

## The Problem
AI agents today are powerful but fundamentally **stateless and fragmented**:
- Complete tasks in isolation
- Lose context across sessions
- Can't share knowledge across tools, teams, or workflows
- Memory tied to single app/model/device → brittle, hard to scale, hard to trust

## The Challenge
**Rethink how agentic systems are built using Walrus as a Verifiable Data Platform for AI.**

## What to Build
Build functional AI agents or agentic workflows (single or multi-agent) in any domain that demonstrate:

1. **Long-term memory** using persistent, verifiable memory for agents (MemWal)
2. **Persistent data and file access** using Walrus (directly or via file management interface)
3. **Integrations and tooling** making it easier for devs to adopt Walrus/MemWal in agentic systems

## Especially Interested In

### Agent Systems
- Long-running workflows tracking state over time (research agents, trading agents, monitoring)
- Multi-agent coordination (negotiation, task delegation, step-by-step execution)
- Artifact-driven workflows (generate, store, reuse datasets, logs, reports, intermediate outputs)

### Tooling & Integrations
- Persistent memory plugins/adapters for existing agent frameworks (use Walrus directly or MemWal as memory layer)
- Workflow orchestration layers combining memory, messaging, execution across agents with Walrus as storage
- Cross-tool/cross-agent memory sharing (different systems read/write to same context on Walrus)
- Developer tools to inspect, debug, manage agent memory and data on Walrus

## Project Could Be
- User-facing agent or multi-agent system
- Developer tool or framework integration
- New interface for interacting with persistent AI memory and data

## What Judges Want
NOT just demos — **working systems** that show:
- How agents become more useful when they can remember and build over time
- How workflows improve when data is shared, durable, portable
- How devs can move beyond fragile, siloed memory setups

**Goal**: Push toward AI agents as persistent, collaborative systems powered by a reliable data layer.

## Key Tech Stack / References
- **Walrus** — decentralized storage (docs, CLI, HTTP API, TypeScript SDK)
- **MemWal** (Walrus Memory) — persistent memory layer for agents
  - Playground: create account + delegate key for agent
  - GitHub repo: sample apps, skills
- **Walrus Sites** — site-builder CLI, publish sites
- **Seal** — privacy layer for Walrus and MemWal
- **Sui Stack Messaging** — messaging using Walrus for storage/recovery + Seal for privacy

## Community
- Telegram: Walrus Builder Group
- Discord: #developers channel
- Office Hours: Abner (Walrus) for idea validation
