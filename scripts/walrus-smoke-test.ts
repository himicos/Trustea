#!/usr/bin/env tsx
/**
 * Trustea — Walrus smoke test
 *
 * Tests the raw Walrus store → retrieve pipeline without any Seal encryption,
 * against the public testnet endpoints. No wallet or private key required.
 *
 * Run:
 *   npx tsx scripts/walrus-smoke-test.ts
 */

import { createWalrusClient } from "../lib/walrus/client.js";

const walrus = createWalrusClient("testnet");

const TEST_PAYLOAD = new TextEncoder().encode(
  JSON.stringify({
    test: "Trustea Walrus smoke test",
    timestamp: new Date().toISOString(),
    message: "If you can read this, Walrus round-trip works.",
  }),
);

console.log("[walrus-smoke] Storing test payload...");
console.log(`  publisher : ${walrus.publisherUrl}`);
console.log(`  aggregator: ${walrus.aggregatorUrl}`);
console.log(`  payload   : ${TEST_PAYLOAD.byteLength} bytes`);

const { blobId, info } = await walrus.storeDocument(TEST_PAYLOAD, 5);
console.log(`\n[walrus-smoke] Stored OK`);
console.log(`  blobId  : ${blobId}`);
console.log(`  status  : ${info.status}`);
console.log(`  endEpoch: ${info.endEpoch}`);

console.log("\n[walrus-smoke] Retrieving blob...");
const retrieved = await walrus.readDocument(blobId);
const decoded = new TextDecoder().decode(retrieved);
console.log(`  retrieved: ${retrieved.byteLength} bytes`);

const parsed = JSON.parse(decoded) as { message: string; timestamp: string };
console.log(`  message  : ${parsed.message}`);
console.log(`  timestamp: ${parsed.timestamp}`);

if (decoded !== new TextDecoder().decode(TEST_PAYLOAD)) {
  console.error("\n[walrus-smoke] FAIL: retrieved bytes do not match stored bytes");
  process.exit(1);
}

console.log("\n[walrus-smoke] PASS — Walrus round-trip verified.");
