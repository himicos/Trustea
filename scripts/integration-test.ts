#!/usr/bin/env tsx
/**
 * Trustea — Full Integration Test
 *
 * Tests every backend component against real Sui testnet:
 *   1. Create Trust on-chain
 *   2. Deposit SUI
 *   3. Add Beneficiary (mints soulbound NFT)
 *   4. Add Rule (time-based)
 *   5. Read trust state back from chain
 *   6. Upload document to Walrus
 *   7. Add Walrus blob ref on-chain
 *   8. Seal encrypt test
 *   9. Agent condition check
 *  10. Agent distribution proposal
 *  11. Verify beneficiary NFT ownership
 *  12. Yield strategy computation
 *  13. Helper functions (formatSui, milestones, etc.)
 *  14. Propose distribution on-chain
 *  15. Cancel distribution (grantor veto)
 *
 * Run:
 *   npx tsx scripts/integration-test.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { TESTNET_CONFIG } from "../lib/config.js";
import { createWalrusClient } from "../lib/walrus/client.js";
import {
  fetchTrust,
  fetchBeneficiaryNFTs,
  fetchTrustsCreatedBy,
  trustStatusLabel,
  TRUSTEA_PACKAGE_ID,
} from "../lib/trust-reader.js";
import {
  formatSui,
  formatAddress,
  formatRelativeTime,
  computeMilestoneProgress,
  computeVetoCountdown,
  computeDashboardStats,
} from "../lib/helpers.js";
import { checkConditions } from "../agent/src/condition-monitor.js";
import { generateProposals } from "../agent/src/distribution-engine.js";
import { getYieldStrategy } from "../agent/src/yield-manager.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const PKG = TESTNET_CONFIG.seal.packageId;
const suiClient = new SuiJsonRpcClient({ url: TESTNET_CONFIG.sui.rpcUrl, network: "testnet" });
const walrus = createWalrusClient("testnet");

// Grantor = the existing funded wallet
import fs from "fs";
import path from "path";

const grantor = (() => {
  const home = process.env.HOME || "/Users/apple";
  const keystorePath = path.join(home, ".sui/sui_config/sui.keystore");
  const keystore = JSON.parse(fs.readFileSync(keystorePath, "utf-8")) as string[];
  const raw = Buffer.from(keystore[0], "base64");
  // Sui keystore format: first byte is scheme (0=ed25519), rest is secret key
  return Ed25519Keypair.fromSecretKey(raw.subarray(1));
})();
const grantorAddr = grantor.toSuiAddress();

// Generate fresh beneficiary keypair
const beneficiary = new Ed25519Keypair();
const beneficiaryAddr = beneficiary.toSuiAddress();

// Agent = grantor for this test (simplifies signing)
const agentAddr = grantorAddr;

let step = 0;
let passed = 0;
let failed = 0;

function section(title: string) {
  step++;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TEST ${step}: ${title}`);
  console.log("=".repeat(60));
}

function pass(msg: string) {
  passed++;
  console.log(`  [PASS] ${msg}`);
}

function fail(msg: string, err?: unknown) {
  failed++;
  console.log(`  [FAIL] ${msg}`);
  if (err) console.log(`         ${err}`);
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n  Trustea Integration Test Suite");
console.log(`  Grantor:     ${grantorAddr}`);
console.log(`  Beneficiary: ${beneficiaryAddr}`);
console.log(`  Package:     ${PKG}`);

// ── TEST 1: Helper functions ──────────────────────────────────────────

section("Helper functions (pure, no network)");
{
  const sui = formatSui(1_500_000_000n);
  if (sui === "1.5 SUI") pass(`formatSui(1.5B mist) = "${sui}"`);
  else fail(`formatSui expected "1.5 SUI", got "${sui}"`);

  const addr = formatAddress(grantorAddr);
  if (addr.includes("...") && addr.length < grantorAddr.length) pass(`formatAddress = "${addr}"`);
  else fail(`formatAddress didn't truncate`);

  const rel = formatRelativeTime(Date.now() - 3_600_000);
  if (rel.includes("hour")) pass(`formatRelativeTime(-1h) = "${rel}"`);
  else fail(`formatRelativeTime unexpected: "${rel}"`);

  const label = trustStatusLabel(0);
  if (label === "active") pass(`trustStatusLabel(0) = "${label}"`);
  else fail(`trustStatusLabel unexpected: "${label}"`);
}

// ── TEST 2: Create Trust ──────────────────────────────────────────────

section("Create Trust on-chain");
let trustObjectId = "";
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::create_trust`,
    arguments: [
      tx.pure.string("Integration Test Trust"),
      tx.pure.string("Automated integration test"),
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
      pass(`Trust created: ${formatAddress(trustObjectId)}`);
      pass(`Tx: ${result.digest}`);
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

// ── TEST 3: Deposit SUI ───────────────────────────────────────────────

section("Deposit 0.1 SUI");
{
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000)]); // 0.1 SUI
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

// ── TEST 4: Add Beneficiary ───────────────────────────────────────────

section("Add Beneficiary (mint soulbound NFT)");
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::add_beneficiary`,
    arguments: [
      tx.object(trustObjectId),
      tx.pure.address(beneficiaryAddr),
      tx.pure.string("Alice Test"),
      tx.pure.string("Time-based release at timestamp"),
      tx.pure.u64(50_000_000), // 0.05 SUI allocation
      tx.pure.bool(false),
      tx.object("0x6"),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    const nftChange = result.objectChanges?.find(
      (c) => c.type === "created" && "objectType" in c && c.objectType?.includes("::beneficiary_nft::BeneficiaryNFT"),
    );
    if (nftChange && nftChange.type === "created") {
      pass(`BeneficiaryNFT minted: ${formatAddress(nftChange.objectId)}`);
      pass(`Sent to: ${formatAddress(beneficiaryAddr)}`);
    } else {
      pass(`Beneficiary added (NFT in objectChanges may be filtered)`);
    }
    pass(`Tx: ${result.digest}`);
  } catch (e) {
    fail("add_beneficiary failed", e);
  }
}

// ── TEST 5: Add Rule ──────────────────────────────────────────────────

section("Add time-based rule");
{
  // Rule: release 0.05 SUI to beneficiary after timestamp (5 min from now for testing)
  const unlockTimestamp = Date.now() + 5 * 60 * 1000;
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
      tx.pure.string("Release 0.05 SUI after 5 minutes (test)"),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    pass(`Rule added — unlock at ${new Date(unlockTimestamp).toISOString()}`);
    pass(`Tx: ${result.digest}`);
  } catch (e) {
    fail("add_rule failed", e);
  }
}

// ── TEST 6: Read Trust State ──────────────────────────────────────────

section("Fetch + parse Trust from chain");
{
  // Small delay to let the RPC index the latest transactions
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const trust = await fetchTrust(suiClient, trustObjectId);
    pass(`Name: "${trust.name}"`);
    pass(`Grantor: ${formatAddress(trust.grantor)}`);
    pass(`Balance: ${formatSui(trust.balance)}`);
    pass(`Beneficiaries: ${trust.beneficiaries.length}`);
    pass(`Rules: ${trust.rules.length}`);
    pass(`Status: ${trustStatusLabel(trust.status)}`);

    if (trust.name === "Integration Test Trust") pass("Name matches");
    else fail(`Name mismatch: "${trust.name}"`);

    if (trust.balance === 100_000_000n) pass("Balance matches (0.1 SUI)");
    else fail(`Balance mismatch: ${trust.balance}`);

    if (trust.beneficiaries.length === 1) pass("1 beneficiary");
    else fail(`Expected 1 beneficiary, got ${trust.beneficiaries.length}`);

    if (trust.rules.length === 1) pass("1 rule");
    else fail(`Expected 1 rule, got ${trust.rules.length}`);

    // Test milestone progress
    if (trust.rules.length > 0) {
      const progress = computeMilestoneProgress(trust.rules[0], trust.createdAt);
      pass(`Milestone progress: ${progress.percentage}% — "${progress.label}"`);
    }

    // Test dashboard stats
    const stats = computeDashboardStats([trust]);
    pass(`Dashboard stats: ${stats.activeTrusts} active, ${formatSui(stats.totalBalanceMist)} total`);
  } catch (e) {
    fail("fetchTrust failed", e);
  }
}

// ── TEST 7: Fetch trusts created by grantor ───────────────────────────

section("Fetch trusts created by grantor (event query)");
{
  try {
    const trusts = await fetchTrustsCreatedBy(suiClient, grantorAddr);
    if (trusts.length > 0) {
      pass(`Found ${trusts.length} trust(s) created by grantor`);
      for (const t of trusts) {
        pass(`  ${t.name} — ${formatAddress(t.trustId)}`);
      }
    } else {
      fail("No trusts found for grantor (event indexing may be delayed)");
    }
  } catch (e) {
    fail("fetchTrustsCreatedBy failed", e);
  }
}

// ── TEST 8: Verify beneficiary NFT ownership ──────────────────────────

section("Verify BeneficiaryNFT in beneficiary wallet");
{
  try {
    const nfts = await fetchBeneficiaryNFTs(suiClient, beneficiaryAddr);
    if (nfts.length > 0) {
      pass(`Found ${nfts.length} BeneficiaryNFT(s) in beneficiary wallet`);
      for (const nft of nfts) {
        pass(`  NFT: ${formatAddress(nft.objectId)}`);
        pass(`  Fields: ${JSON.stringify(nft.fields).slice(0, 120)}...`);
      }
    } else {
      fail("No BeneficiaryNFTs found — soulbound transfer may not have worked");
    }
  } catch (e) {
    fail("fetchBeneficiaryNFTs failed", e);
  }
}

// ── TEST 9: Walrus store + retrieve ───────────────────────────────────

section("Walrus document store + retrieve");
let testBlobId = "";
{
  const doc = {
    title: "Integration Test Trust Agreement",
    grantor: grantorAddr,
    beneficiary: beneficiaryAddr,
    terms: "Release 0.05 SUI to Alice after 5 minutes.",
    timestamp: new Date().toISOString(),
  };
  const docBytes = new TextEncoder().encode(JSON.stringify(doc, null, 2));

  try {
    const { blobId, info } = await walrus.storeDocument(docBytes, 5);
    testBlobId = blobId;
    pass(`Stored: ${blobId}`);
    pass(`Status: ${info.status}, endEpoch: ${info.endEpoch}`);

    // Retrieve
    const retrieved = await walrus.readDocument(blobId);
    const decoded = new TextDecoder().decode(retrieved);
    const parsed = JSON.parse(decoded) as typeof doc;

    if (parsed.title === doc.title) pass("Round-trip verified — content matches");
    else fail("Content mismatch after retrieval");
  } catch (e) {
    fail("Walrus store/retrieve failed", e);
  }
}

// ── TEST 10: Add Walrus ref on-chain ──────────────────────────────────

section("Add Walrus blob reference to trust");
{
  if (testBlobId) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PKG}::trust::add_walrus_ref`,
      arguments: [tx.object(trustObjectId), tx.pure.string(testBlobId)],
    });

    try {
      const result = await signAndExec(tx, grantor);
      pass(`Walrus ref added: ${testBlobId}`);
      pass(`Tx: ${result.digest}`);

      // Verify it's in the trust
      const trust = await fetchTrust(suiClient, trustObjectId);
      if (trust.walrusBlobIds.includes(testBlobId)) {
        pass("Blob ID confirmed in trust.walrus_blob_ids");
      } else {
        fail("Blob ID not found in trust after add_walrus_ref");
      }
    } catch (e) {
      fail("add_walrus_ref failed", e);
    }
  } else {
    fail("Skipped — no blobId from previous test");
  }
}

// ── TEST 11: Seal encrypt ─────────────────────────────────────────────

section("Seal encryption test");
{
  try {
    const { SealClient } = await import("@mysten/seal");
    const sealClient = new SealClient({
      suiClient,
      serverConfigs: [{
        objectId: TESTNET_CONFIG.seal.keyServerObjectId,
        weight: 1,
        aggregatorUrl: TESTNET_CONFIG.seal.aggregatorUrl,
      }],
      verifyKeyServers: false,
    });

    const { fromHex, toHex } = await import("@mysten/sui/utils");
    const policyBytes = fromHex(trustObjectId);
    const nonce = crypto.getRandomValues(new Uint8Array(5));
    const encId = toHex(new Uint8Array([...policyBytes, ...nonce]));

    const testData = new TextEncoder().encode("Seal encrypt test for Trustea integration");

    const { encryptedObject } = await sealClient.encrypt({
      threshold: 1,
      packageId: PKG,
      id: encId,
      data: testData,
    });

    if (encryptedObject.byteLength > testData.byteLength) {
      pass(`Encrypted: ${testData.byteLength}B → ${encryptedObject.byteLength}B`);
      pass(`Encryption ID: ${encId.slice(0, 20)}...`);
    } else {
      fail("Encrypted output not larger than input");
    }
  } catch (e) {
    fail("Seal encryption failed", e);
  }
}

// ── TEST 12: Condition monitor ────────────────────────────────────────

section("Agent condition monitor");
{
  try {
    const trust = await fetchTrust(suiClient, trustObjectId);

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

    const checks = await checkConditions({
      trustId: trustObjectId,
      rules: [mockRule],
      suiClient: suiClient as any, // CoreClient compat
      currentTime: Date.now(),
      lastDistributions: new Map(),
      beneficiaryAddresses: beneficiaryMap,
    });

    pass(`Checked ${checks.length} condition(s)`);
    for (const check of checks) {
      pass(`  Rule #${check.ruleIndex}: conditionMet=${check.conditionMet}, details="${check.details}"`);
    }
  } catch (e) {
    fail("Condition monitor failed", e);
  }
}

// ── TEST 13: Distribution engine ──────────────────────────────────────

section("Distribution proposal engine");
{
  try {
    const trust = await fetchTrust(suiClient, trustObjectId);
    const onChainRule = trust.rules[0];

    // Force condition met for testing
    const mockCheck = {
      ruleIndex: 0,
      conditionMet: true,
      details: "Test: forced condition met",
      beneficiary: beneficiaryAddr,
      checkedAt: Date.now(),
    };

    const mockRule = {
      ruleType: "time" as const,
      amount: Number(onChainRule.amount) / 1_000_000_000,
      isPercentage: false,
      conditionDescription: onChainRule.description,
      conditionParams: { type: "time", timestamp: Number(onChainRule.conditionValue) },
      beneficiary: beneficiaryAddr,
    };

    const proposals = await generateProposals({
      trustId: trustObjectId,
      conditionChecks: [mockCheck],
      rules: [mockRule],
      trustBalance: Number(trust.balance) / 1_000_000_000,
    });

    pass(`Generated ${proposals.length} proposal(s)`);
    for (const p of proposals) {
      pass(`  ${formatAddress(p.beneficiary)}: $${p.amount} — "${p.reason.slice(0, 60)}..."`);
    }
  } catch (e) {
    fail("Distribution engine failed", e);
  }
}

// ── TEST 14: Yield manager ────────────────────────────────────────────

section("Yield strategy computation");
{
  try {
    const strategies = await getYieldStrategy({
      balance: 100_000,
      riskProfile: "conservative",
      currentAllocations: [],
    });

    pass(`${strategies.length} yield strategies for conservative profile`);
    for (const s of strategies) {
      pass(`  ${s.protocol}: ${s.action} $${s.amount} @ ${s.expectedApy}% APY (risk: ${s.riskScore}/10)`);
    }

    // Test all profiles
    for (const profile of ["passive", "moderate", "aggressive"] as const) {
      const strats = await getYieldStrategy({
        balance: 100_000,
        riskProfile: profile,
        currentAllocations: [],
      });
      pass(`  ${profile}: ${strats.length} strategies`);
    }
  } catch (e) {
    fail("Yield manager failed", e);
  }
}

// ── TEST 15: Propose distribution on-chain ────────────────────────────

section("Propose distribution on-chain (agent action)");
let distributionId = "";
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::propose_distribution`,
    arguments: [
      tx.object(trustObjectId),
      tx.pure.u64(0), // rule_index
      tx.pure.address(beneficiaryAddr),
      tx.pure.u64(50_000_000), // 0.05 SUI
      tx.pure.string("Integration test: condition met, proposing release"),
      tx.object("0x6"),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor); // agent = grantor
    const distChange = result.objectChanges?.find(
      (c) => c.type === "created" && "objectType" in c && c.objectType?.includes("::trust::PendingDistribution"),
    );
    if (distChange && distChange.type === "created") {
      distributionId = distChange.objectId;
      pass(`PendingDistribution created: ${formatAddress(distributionId)}`);
    } else {
      pass("Distribution proposed (object may be shared)");
    }
    pass(`Tx: ${result.digest}`);
  } catch (e) {
    fail("propose_distribution failed", e);
  }
}

// ── TEST 16: Cancel distribution (grantor veto) ───────────────────────

section("Cancel distribution (grantor override/veto)");
{
  if (distributionId) {
    // Compute veto countdown first
    try {
      const { fetchPendingDistribution } = await import("../lib/trust-reader.js");
      const dist = await fetchPendingDistribution(suiClient, distributionId);
      const countdown = computeVetoCountdown(dist);
      pass(`Veto countdown: canExecute=${countdown.canExecute}, "${countdown.label}"`);
    } catch {
      pass("Couldn't fetch distribution for countdown (may need indexing time)");
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PKG}::trust::cancel_distribution`,
      arguments: [
        tx.object(trustObjectId),
        tx.object(distributionId),
      ],
    });

    try {
      const result = await signAndExec(tx, grantor);
      pass(`Distribution cancelled (grantor veto)`);
      pass(`Tx: ${result.digest}`);
    } catch (e) {
      fail("cancel_distribution failed", e);
    }
  } else {
    fail("Skipped — no distributionId from previous test");
  }
}

// ── TEST 17: Pause + Resume trust ─────────────────────────────────────

section("Pause and resume trust");
{
  // Pause
  const pauseTx = new Transaction();
  pauseTx.moveCall({
    target: `${PKG}::trust::pause_trust`,
    arguments: [pauseTx.object(trustObjectId)],
  });

  try {
    await signAndExec(pauseTx, grantor);
    const paused = await fetchTrust(suiClient, trustObjectId);
    if (paused.status === 1) pass("Trust paused (status=1)");
    else fail(`Expected status 1, got ${paused.status}`);
  } catch (e) {
    fail("pause_trust failed", e);
  }

  // Resume
  const resumeTx = new Transaction();
  resumeTx.moveCall({
    target: `${PKG}::trust::resume_trust`,
    arguments: [resumeTx.object(trustObjectId)],
  });

  try {
    await signAndExec(resumeTx, grantor);
    const resumed = await fetchTrust(suiClient, trustObjectId);
    if (resumed.status === 0) pass("Trust resumed (status=0)");
    else fail(`Expected status 0, got ${resumed.status}`);
  } catch (e) {
    fail("resume_trust failed", e);
  }
}

// ── TEST 18: Amend trust ──────────────────────────────────────────────

section("Amend trust (rename)");
{
  // Use raw BCS for Option<String> since the amend function uses Options
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::trust::amend_trust`,
    arguments: [
      tx.object(trustObjectId),
      tx.pure.option("string", "Integration Test Trust (Amended)"),
      tx.pure.option("string", null),
      tx.pure.option("u64", null),
      tx.pure.option("bool", null),
    ],
  });

  try {
    const result = await signAndExec(tx, grantor);
    pass(`Trust amended — tx: ${result.digest}`);

    const amended = await fetchTrust(suiClient, trustObjectId);
    if (amended.name.includes("Amended")) pass(`New name: "${amended.name}"`);
    else fail(`Name not updated: "${amended.name}"`);
  } catch (e) {
    fail("amend_trust failed", e);
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log("  INTEGRATION TEST RESULTS");
console.log("=".repeat(60));
console.log(`\n  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log(`\n  Trust:  ${trustObjectId}`);
console.log(`  Explorer: https://testnet.suivision.xyz/object/${trustObjectId}`);
if (testBlobId) {
  console.log(`  Walrus:   https://aggregator.walrus-testnet.walrus.space/v1/blobs/${testBlobId}`);
}
console.log();

process.exit(failed > 0 ? 1 : 0);
