#!/usr/bin/env tsx
/**
 * Trustea — Agent runCycle System Test
 *
 * Proves the full agent pipeline works end-to-end against real testnet:
 *   1. Create a fresh trust on-chain
 *   2. Deposit 0.05 SUI
 *   3. Add a beneficiary
 *   4. Add a time-based rule (unlock 2 minutes from now)
 *   5. Run agent pipeline components in sequence
 *   6. Wait 2 minutes
 *   7. Run again — condition should now be met
 *   8. Log all results to MemWal
 *
 * Run:
 *   npx tsx scripts/test-agent-cycle.ts
 */

import fs from "fs";
import path from "path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { MemWal } from "@mysten-incubation/memwal";
import { TESTNET_CONFIG } from "../lib/config.js";
import { fetchTrust, trustStatusLabel } from "../lib/trust-reader.js";
import { formatSui, formatAddress } from "../lib/helpers.js";
import { checkConditions, type ConditionCheck } from "../agent/src/condition-monitor.js";
import { generateProposals, type DistributionProposal } from "../agent/src/distribution-engine.js";
import { getYieldStrategy, type YieldStrategy } from "../agent/src/yield-manager.js";

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------

const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const [k, ...v] = t.split("=");
  env[k] = v.join("=");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const PKG = TESTNET_CONFIG.seal.packageId;
const suiClient = new SuiJsonRpcClient({ url: TESTNET_CONFIG.sui.rpcUrl, network: "testnet" });

// Load grantor keypair from Sui keystore
const grantor = (() => {
  const home = process.env.HOME || "/Users/apple";
  const keystorePath = path.join(home, ".sui/sui_config/sui.keystore");
  const keystore = JSON.parse(fs.readFileSync(keystorePath, "utf-8")) as string[];
  const raw = Buffer.from(keystore[0], "base64");
  return Ed25519Keypair.fromSecretKey(raw.subarray(1));
})();
const grantorAddr = grantor.toSuiAddress();

// Fresh beneficiary
const beneficiary = new Ed25519Keypair();
const beneficiaryAddr = beneficiary.toSuiAddress();

// Agent = grantor for simplicity
const agentAddr = grantorAddr;

// MemWal client
let memwal: ReturnType<typeof MemWal.create> | null = null;
const MEMWAL_PRIVATE_KEY = env.MEMWAL_PRIVATE_KEY;
const MEMWAL_ACCOUNT_ID = env.MEMWAL_ACCOUNT_ID;
const MEMWAL_SERVER_URL = env.MEMWAL_SERVER_URL || "https://relayer-staging.memory.walrus.xyz";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let step = 0;
let passed = 0;
let failed = 0;
const results: { step: number; title: string; status: "PASS" | "FAIL"; detail: string }[] = [];

function section(title: string) {
  step++;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  STEP ${step}: ${title}`);
  console.log("=".repeat(60));
}

function pass(msg: string) {
  passed++;
  console.log(`  [PASS] ${msg}`);
  results.push({ step, title: `Step ${step}`, status: "PASS", detail: msg });
}

function fail(msg: string, err?: unknown) {
  failed++;
  console.log(`  [FAIL] ${msg}`);
  if (err) console.log(`         ${err}`);
  results.push({ step, title: `Step ${step}`, status: "FAIL", detail: msg });
}

async function signAndExec(tx: Transaction, signer: Ed25519Keypair) {
  tx.setSender(signer.toSuiAddress());
  tx.setGasBudget(30_000_000);
  return suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showObjectChanges: true, showEffects: true },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n  Trustea Agent runCycle System Test");
console.log(`  Grantor:     ${grantorAddr}`);
console.log(`  Beneficiary: ${beneficiaryAddr}`);
console.log(`  Package:     ${PKG}`);

// ── STEP 1: Initialize MemWal ────────────────────────────────────────

section("Initialize MemWal client");
{
  if (MEMWAL_PRIVATE_KEY && MEMWAL_ACCOUNT_ID) {
    try {
      memwal = MemWal.create({
        key: MEMWAL_PRIVATE_KEY,
        accountId: MEMWAL_ACCOUNT_ID,
        serverUrl: MEMWAL_SERVER_URL,
        namespace: "trustea:agent-test",
      });
      pass(`MemWal client created (account: ${MEMWAL_ACCOUNT_ID.slice(0, 16)}...)`);
    } catch (e) {
      fail("MemWal client creation failed", e);
    }
  } else {
    fail("Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID in .env — MemWal logging disabled");
    console.log("         Run: npx tsx scripts/setup-memwal-account.ts");
  }
}

// ── STEP 2: Create Trust ─────────────────────────────────────────────

section("Create fresh trust on testnet");
let trustObjectId = "";
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::create_trust`,
    arguments: [
      tx.pure.string("Agent Cycle Test Trust"),
      tx.pure.string("Testing agent runCycle pipeline"),
      tx.pure.address(agentAddr),
      tx.pure.u64(0), // override_period_ms (0 = use 48hr default)
      tx.pure.bool(true), // is_revocable
      tx.pure.option("address", undefined), // successor_grantor = None
      tx.pure.option("address", undefined), // trust_protector = None
      tx.object("0x6"), // clock
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    const trustChange = result.objectChanges?.find(
      (c) => c.type === "created" && "objectType" in c && c.objectType?.includes("::trust::Trust"),
    );
    if (trustChange && trustChange.type === "created") {
      trustObjectId = trustChange.objectId;
      pass(`Trust created: ${trustObjectId.slice(0, 16)}...`);
    } else {
      fail("Trust object not found in objectChanges");
    }
  } catch (e) {
    fail("create_trust failed", e);
  }
}

if (!trustObjectId) {
  console.log("\n  ABORT: Cannot continue without trust object.");
  process.exit(1);
}

// ── STEP 3: Deposit 0.05 SUI ────────────────────────────────────────

section("Deposit 0.05 SUI");
{
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000)]); // 0.05 SUI
  tx.moveCall({
    target: `${PKG}::trust::deposit`,
    arguments: [tx.object(trustObjectId), coin],
  });

  try {
    const result = await signAndExec(tx, grantor);
    pass(`Deposit tx: ${result.digest}`);
  } catch (e) {
    fail("deposit failed", e);
  }
}

// ── STEP 4: Add Beneficiary ─────────────────────────────────────────

section("Add beneficiary");
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::add_beneficiary`,
    arguments: [
      tx.object(trustObjectId),
      tx.pure.address(beneficiaryAddr),
      tx.pure.string("TestBeneficiary"),
      tx.pure.string("Time-based release for agent cycle test"),
      tx.pure.u64(50_000_000), // 0.05 SUI
      tx.pure.bool(false),
      tx.object("0x6"),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    pass(`Beneficiary added: ${beneficiaryAddr.slice(0, 16)}...`);
  } catch (e) {
    fail("add_beneficiary failed", e);
  }
}

// ── STEP 5: Add time-based rule (unlock 2 min from now) ─────────────

section("Add time-based rule (unlock in 2 minutes)");
const unlockTimestamp = Date.now() + 2 * 60 * 1000; // 2 minutes from now
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::add_rule`,
    arguments: [
      tx.object(trustObjectId),
      tx.pure.u8(1), // RULE_TYPE_TIME
      tx.pure.address(beneficiaryAddr),
      tx.pure.u64(50_000_000), // 0.05 SUI
      tx.pure.bool(false),
      tx.pure.u64(unlockTimestamp),
      tx.pure.string("Release 0.05 SUI after 2 minutes (agent cycle test)"),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    pass(`Rule added — unlock at ${new Date(unlockTimestamp).toISOString()}`);
  } catch (e) {
    fail("add_rule failed", e);
  }
}

// ── STEP 6: First agent cycle (condition NOT yet met) ────────────────

section("Agent pipeline — Cycle 1 (condition should NOT be met)");
{
  try {
    const trust = await fetchTrust(suiClient, trustObjectId);
    pass(`Trust fetched: balance=${formatSui(trust.balance)}, rules=${trust.rules.length}`);

    // Build TrustRule from on-chain rule
    const onChainRule = trust.rules[0];
    const mockRule = {
      ruleType: "time" as const,
      amount: Number(onChainRule.amount) / 1_000_000_000,
      isPercentage: onChainRule.isPercentage,
      conditionDescription: onChainRule.description,
      conditionParams: {
        type: "time",
        timestamp: Number(onChainRule.conditionValue),
      },
      beneficiary: onChainRule.beneficiary,
    };

    const beneficiaryMap = new Map<number, string>();
    beneficiaryMap.set(0, beneficiaryAddr);

    // 6a: checkConditions
    const checks = await checkConditions({
      trustId: trustObjectId,
      rules: [mockRule],
      suiClient: suiClient as any,
      currentTime: Date.now(),
      lastDistributions: new Map(),
      beneficiaryAddresses: beneficiaryMap,
    });

    if (checks.length > 0) {
      pass(`checkConditions returned ${checks.length} result(s)`);
      for (const c of checks) {
        console.log(`    Rule #${c.ruleIndex}: conditionMet=${c.conditionMet}`);
        console.log(`    Details: ${c.details}`);
      }
      if (!checks[0].conditionMet) {
        pass("Condition correctly NOT met (unlock time is in the future)");
      } else {
        fail("Condition unexpectedly met — timing issue");
      }
    } else {
      fail("checkConditions returned empty array");
    }

    // 6b: generateProposals (should be empty since condition not met)
    const proposals = await generateProposals({
      trustId: trustObjectId,
      conditionChecks: checks,
      rules: [mockRule],
      trustBalance: Number(trust.balance) / 1_000_000_000,
    });

    if (proposals.length === 0) {
      pass("generateProposals correctly returned 0 proposals (condition not met)");
    } else {
      fail(`Expected 0 proposals, got ${proposals.length}`);
    }

    // 6c: getYieldStrategy
    const strategies = await getYieldStrategy({
      balance: Number(trust.balance) / 1_000_000_000,
      riskProfile: "conservative",
      currentAllocations: [],
    });
    pass(`getYieldStrategy returned ${strategies.length} strategies for conservative profile`);
    for (const s of strategies) {
      console.log(`    ${s.protocol}: ${s.action} $${s.amount} @ ${s.expectedApy}% APY`);
    }

    // 6d: Log cycle 1 to MemWal
    if (memwal) {
      try {
        const logEntry = await memwal.rememberAndWait(
          `Agent cycle 1 for trust ${trustObjectId.slice(0, 16)}. ` +
          `Checked ${checks.length} condition(s). ` +
          `Condition NOT met — unlock at ${new Date(unlockTimestamp).toISOString()}. ` +
          `0 proposals generated. ${strategies.length} yield strategies.`,
          "trustea:agent-test",
        );
        pass(`MemWal logged cycle 1 — blob_id: ${logEntry.blob_id.slice(0, 20)}...`);
      } catch (e) {
        fail("MemWal log failed for cycle 1", e);
      }
    } else {
      console.log("  [SKIP] MemWal not connected — skipping log");
    }
  } catch (e) {
    fail("Agent pipeline cycle 1 failed", e);
  }
}

// ── STEP 7: Wait 2 minutes ──────────────────────────────────────────

section("Waiting 2 minutes for time condition to expire...");
{
  const waitMs = Math.max(0, unlockTimestamp - Date.now() + 2000); // +2s buffer
  console.log(`  Waiting ${Math.ceil(waitMs / 1000)} seconds...`);

  // Show countdown every 30 seconds
  const startWait = Date.now();
  while (Date.now() - startWait < waitMs) {
    const remaining = Math.ceil((waitMs - (Date.now() - startWait)) / 1000);
    if (remaining > 0 && remaining % 30 === 0) {
      console.log(`  ... ${remaining}s remaining`);
    }
    await sleep(Math.min(1000, waitMs - (Date.now() - startWait)));
  }
  pass("Wait complete");
}

// ── STEP 8: Second agent cycle (condition SHOULD be met) ─────────────

section("Agent pipeline — Cycle 2 (condition SHOULD be met)");
{
  try {
    const trust = await fetchTrust(suiClient, trustObjectId);
    pass(`Trust fetched: balance=${formatSui(trust.balance)}`);

    const onChainRule = trust.rules[0];
    const mockRule = {
      ruleType: "time" as const,
      amount: Number(onChainRule.amount) / 1_000_000_000,
      isPercentage: onChainRule.isPercentage,
      conditionDescription: onChainRule.description,
      conditionParams: {
        type: "time",
        timestamp: Number(onChainRule.conditionValue),
      },
      beneficiary: onChainRule.beneficiary,
    };

    const beneficiaryMap = new Map<number, string>();
    beneficiaryMap.set(0, beneficiaryAddr);

    // 8a: checkConditions
    const checks = await checkConditions({
      trustId: trustObjectId,
      rules: [mockRule],
      suiClient: suiClient as any,
      currentTime: Date.now(),
      lastDistributions: new Map(),
      beneficiaryAddresses: beneficiaryMap,
    });

    if (checks.length > 0 && checks[0].conditionMet) {
      pass("Condition correctly MET (unlock time has passed)");
    } else {
      fail("Condition should be met but is not");
    }

    for (const c of checks) {
      console.log(`    Rule #${c.ruleIndex}: conditionMet=${c.conditionMet}`);
      console.log(`    Details: ${c.details}`);
    }

    // 8b: generateProposals (should produce 1 proposal)
    const proposals = await generateProposals({
      trustId: trustObjectId,
      conditionChecks: checks,
      rules: [mockRule],
      trustBalance: Number(trust.balance) / 1_000_000_000,
    });

    if (proposals.length > 0) {
      pass(`generateProposals returned ${proposals.length} proposal(s)`);
      for (const p of proposals) {
        console.log(`    Beneficiary: ${p.beneficiary.slice(0, 16)}...`);
        console.log(`    Amount: $${p.amount}`);
        console.log(`    Reason: ${p.reason.slice(0, 80)}...`);
        console.log(`    Status: ${p.status}`);
      }
    } else {
      fail("Expected at least 1 proposal, got 0");
    }

    // 8c: getYieldStrategy
    const strategies = await getYieldStrategy({
      balance: Number(trust.balance) / 1_000_000_000,
      riskProfile: "conservative",
      currentAllocations: [],
    });
    pass(`getYieldStrategy returned ${strategies.length} strategies`);

    // 8d: Log cycle 2 to MemWal
    if (memwal) {
      try {
        const logEntry = await memwal.rememberAndWait(
          `Agent cycle 2 for trust ${trustObjectId.slice(0, 16)}. ` +
          `Checked ${checks.length} condition(s). ` +
          `Condition MET — unlock time passed. ` +
          `${proposals.length} proposal(s) generated: ` +
          proposals.map((p) => `$${p.amount} to ${p.beneficiary.slice(0, 10)}...`).join(", ") +
          `. ${strategies.length} yield strategies.`,
          "trustea:agent-test",
        );
        pass(`MemWal logged cycle 2 — blob_id: ${logEntry.blob_id.slice(0, 20)}...`);
      } catch (e) {
        fail("MemWal log failed for cycle 2", e);
      }
    } else {
      console.log("  [SKIP] MemWal not connected — skipping log");
    }
  } catch (e) {
    fail("Agent pipeline cycle 2 failed", e);
  }
}

// ── STEP 9: Recall agent memories from MemWal ────────────────────────

section("Recall agent memories from MemWal");
{
  if (memwal) {
    try {
      const recallResults = await memwal.recall("agent cycle condition met proposal", {
        limit: 5,
        namespace: "trustea:agent-test",
      });
      pass(`Recalled ${recallResults.total} memories from MemWal`);
      for (const r of recallResults.results) {
        console.log(`    distance: ${r.distance.toFixed(3)} — "${r.text.slice(0, 80)}..."`);
      }
    } catch (e) {
      fail("MemWal recall failed", e);
    }
  } else {
    console.log("  [SKIP] MemWal not connected");
  }
}

// ── SUMMARY ──────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log("  AGENT CYCLE TEST RESULTS");
console.log("=".repeat(60));
console.log();

for (const r of results) {
  const icon = r.status === "PASS" ? "[PASS]" : "[FAIL]";
  console.log(`  ${icon} ${r.detail.slice(0, 70)}`);
}

console.log();
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log();
console.log(`  Trust:    ${trustObjectId}`);
console.log(`  Explorer: https://testnet.suivision.xyz/object/${trustObjectId}`);
console.log();

process.exit(failed > 0 ? 1 : 0);
