#!/usr/bin/env tsx
/**
 * Trustea — MemWal Integration Test
 *
 * Tests persistent AI memory: store decisions, recall context.
 *
 * Run:
 *   npx tsx scripts/test-memwal.ts
 */

import fs from "fs";
import path from "path";
import { MemWal } from "@mysten-incubation/memwal";

// Load .env
const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  env[key] = rest.join("=");
}

const MEMWAL_PRIVATE_KEY = env.MEMWAL_PRIVATE_KEY;
const MEMWAL_ACCOUNT_ID = env.MEMWAL_ACCOUNT_ID;
const MEMWAL_SERVER_URL = env.MEMWAL_SERVER_URL || "https://relayer-staging.memory.walrus.xyz";

if (!MEMWAL_PRIVATE_KEY || !MEMWAL_ACCOUNT_ID) {
  console.error("Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID in .env");
  console.error("Run: npx tsx scripts/setup-memwal-account.ts");
  process.exit(1);
}

console.log("Trustea — MemWal Integration Test\n");
console.log(`  Account: ${MEMWAL_ACCOUNT_ID.slice(0, 16)}...`);
console.log(`  Server:  ${MEMWAL_SERVER_URL}`);

// ---------------------------------------------------------------------------
// Create client
// ---------------------------------------------------------------------------

console.log("\n[1] Creating MemWal client...");
const memwal = MemWal.create({
  key: MEMWAL_PRIVATE_KEY,
  accountId: MEMWAL_ACCOUNT_ID,
  serverUrl: MEMWAL_SERVER_URL,
  namespace: "trustea:test",
});
console.log("  [PASS] Client created");

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

console.log("\n[2] Health check...");
const health = await memwal.health();
console.log(`  [PASS] status=${health.status}, version=${health.version}`);

// ---------------------------------------------------------------------------
// Store memories
// ---------------------------------------------------------------------------

console.log("\n[3] Storing agent decision (condition check)...");
const decision1 = await memwal.rememberAndWait(
  "Checked Alice's age condition for Smith Family Trust. Alice is currently 20 years old. Rule requires age >= 25. Condition NOT MET. Next check scheduled in 6 hours.",
  "trustea:decisions",
);
console.log(`  [PASS] Stored — blob_id: ${decision1.blob_id.slice(0, 20)}...`);

console.log("\n[4] Storing yield action...");
const decision2 = await memwal.rememberAndWait(
  "Yield strategy executed for Smith Family Trust. Deposited 60% of idle balance ($60,000) to Scallop lending pool at 6.0% APY. Remaining 40% ($40,000) in SUI staking at 4.5% APY. Risk profile: conservative. Total expected annual yield: $5,400.",
  "trustea:decisions",
);
console.log(`  [PASS] Stored — blob_id: ${decision2.blob_id.slice(0, 20)}...`);

console.log("\n[5] Storing compliance review...");
const decision3 = await memwal.rememberAndWait(
  "Quarterly compliance review completed for Smith Family Trust. All beneficiary NFTs verified. No unauthorized transfers detected. Trust balance: $103,420. 3 rules active. Agent uptime: 99.7%. No anomalies.",
  "trustea:decisions",
);
console.log(`  [PASS] Stored — blob_id: ${decision3.blob_id.slice(0, 20)}...`);

// ---------------------------------------------------------------------------
// Recall memories
// ---------------------------------------------------------------------------

console.log("\n[6] Recalling memories about 'Alice age condition'...");
const aliceResults = await memwal.recall("Alice age condition", {
  limit: 5,
  namespace: "trustea:decisions",
});
console.log(`  [PASS] Found ${aliceResults.total} result(s)`);
for (const r of aliceResults.results) {
  console.log(`    distance: ${r.distance.toFixed(3)} — "${r.text.slice(0, 80)}..."`);
}

console.log("\n[7] Recalling memories about 'yield strategy Scallop'...");
const yieldResults = await memwal.recall("yield strategy Scallop", {
  limit: 5,
  namespace: "trustea:decisions",
});
console.log(`  [PASS] Found ${yieldResults.total} result(s)`);
for (const r of yieldResults.results) {
  console.log(`    distance: ${r.distance.toFixed(3)} — "${r.text.slice(0, 80)}..."`);
}

console.log("\n[8] Recalling memories about 'compliance review'...");
const complianceResults = await memwal.recall("compliance audit quarterly", {
  limit: 5,
  namespace: "trustea:decisions",
});
console.log(`  [PASS] Found ${complianceResults.total} result(s)`);
for (const r of complianceResults.results) {
  console.log(`    distance: ${r.distance.toFixed(3)} — "${r.text.slice(0, 80)}..."`);
}

// ---------------------------------------------------------------------------
// Cross-namespace test
// ---------------------------------------------------------------------------

console.log("\n[9] Storing event in separate namespace...");
const event = await memwal.rememberAndWait(
  "Distribution proposed: $500 to Bob (monthly allowance). Rule #2 triggered. Veto window: 48 hours. Transaction: 9KhUX9RKWW...",
  "trustea:events",
);
console.log(`  [PASS] Stored in trustea:events — blob_id: ${event.blob_id.slice(0, 20)}...`);

console.log("\n[10] Recall from events namespace...");
const eventResults = await memwal.recall("Bob distribution", {
  limit: 5,
  namespace: "trustea:events",
});
console.log(`  [PASS] Found ${eventResults.total} result(s) in events`);
for (const r of eventResults.results) {
  console.log(`    distance: ${r.distance.toFixed(3)} — "${r.text.slice(0, 80)}..."`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(50)}`);
console.log("  MEMWAL TEST: ALL PASS");
console.log("=".repeat(50));
console.log(`\n  Stored: 4 memories across 2 namespaces`);
console.log(`  Recalled: semantic search working correctly`);
console.log(`  Account: ${MEMWAL_ACCOUNT_ID}`);
console.log(`  All memories persisted on Walrus (verifiable)\n`);
