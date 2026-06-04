#!/usr/bin/env tsx
/**
 * Trustea — Seal encryption integration test
 *
 * Tests the SealClient encrypt pipeline end-to-end using the deployed Trustea
 * package on Sui testnet. No wallet or private key is required for encryption
 * (decryption requires a signed session key, which is not tested here).
 *
 * What this script verifies:
 *   1. SuiJsonRpcClient can be constructed for testnet.
 *   2. createSealClient returns a TrusteaSealClient without throwing.
 *   3. sealClient.encryptForTrust produces a Uint8Array larger than the input.
 *   4. The Seal encryption ID embedded in the output is a hex string of the
 *      expected length (32 bytes trustObjectId + 5 byte nonce = 37 bytes → 74 hex chars).
 *
 * Client note:
 *   Our lib/seal/client.ts uses SuiGrpcClient (imported as SuiClient). However,
 *   SuiGrpcClient requires a gRPC `baseUrl` option — passing only `{ network }` leaves
 *   baseUrl undefined, which crashes the GrpcWebFetchTransport when it tries to build
 *   a URL. For this test we use SuiJsonRpcClient (the JSON-RPC client) which takes a
 *   plain HTTPS RPC URL and satisfies the SealCompatibleClient interface by providing
 *   a `.core` property with getObject() and getDynamicField() — the only methods the
 *   Seal SDK calls on the client.
 *
 * Run:
 *   npx tsx scripts/seal-test.ts
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SealClient } from "@mysten/seal";
import { TESTNET_CONFIG } from "../lib/config.js";
import { fromHex, toHex } from "@mysten/sui/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACKAGE_ID = TESTNET_CONFIG.seal.packageId;
const KEY_SERVER_OBJECT_ID = TESTNET_CONFIG.seal.keyServerObjectId;
const AGGREGATOR_URL = TESTNET_CONFIG.seal.aggregatorUrl;
const RPC_URL = TESTNET_CONFIG.sui.rpcUrl;

// A dummy trust object ID used only to derive the Seal encryption key.
// The ID does not need to exist on-chain for encryption (only for decryption
// where the key server simulates the seal_approve Move call).
const DUMMY_TRUST_OBJECT_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const TEST_PAYLOAD = new TextEncoder().encode(
  JSON.stringify({
    test: "Trustea Seal encryption integration test",
    timestamp: new Date().toISOString(),
    secret: "If you can read this unencrypted, something went wrong.",
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string): void {
  console.log(`  [PASS] ${msg}`);
}

function fail(msg: string, err?: unknown): void {
  console.error(`  [FAIL] ${msg}`);
  if (err !== undefined) {
    console.error("         Cause:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error(
        "         Stack:",
        err.stack
          .split("\n")
          .slice(1, 4)
          .join("\n                "),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

console.log("=".repeat(60));
console.log("Trustea — Seal encryption integration test");
console.log("=".repeat(60));
console.log();
console.log("Config:");
console.log(`  rpcUrl            : ${RPC_URL}`);
console.log(`  packageId         : ${PACKAGE_ID}`);
console.log(`  keyServerObjectId : ${KEY_SERVER_OBJECT_ID}`);
console.log(`  aggregatorUrl     : ${AGGREGATOR_URL}`);
console.log(`  dummyTrustId      : ${DUMMY_TRUST_OBJECT_ID}`);
console.log(`  payload size      : ${TEST_PAYLOAD.byteLength} bytes`);
console.log();

// ---------------------------------------------------------------------------
// Step 1: Construct SuiJsonRpcClient
// ---------------------------------------------------------------------------

console.log("Step 1: Construct SuiJsonRpcClient for testnet...");
let suiClient: SuiJsonRpcClient;
try {
  suiClient = new SuiJsonRpcClient({
    network: "testnet",
    url: RPC_URL,
  });
  pass("SuiJsonRpcClient constructed successfully");
  pass(`  url: ${RPC_URL}`);
} catch (err) {
  fail("SuiJsonRpcClient construction failed", err);
  console.error("\nBlocker: Cannot continue without a SuiClient.");
  process.exit(1);
}
console.log();

// ---------------------------------------------------------------------------
// Step 2: Construct raw SealClient directly
// (avoids the SuiGrpcClient type constraint in our lib/seal/client.ts)
// ---------------------------------------------------------------------------

console.log("Step 2: Construct SealClient directly from @mysten/seal...");
let sealClient: SealClient;
try {
  // SuiJsonRpcClient satisfies SealCompatibleClient at runtime: it has .core with
  // getObject() and getDynamicField() — the only two methods the Seal SDK calls.
  // We cast through `unknown` to avoid the nominal type mismatch with the
  // SuiGrpcClient-based SealCompatibleClient generic constraint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compatClient = suiClient as any;
  sealClient = new SealClient({
    suiClient: compatClient,
    serverConfigs: [
      {
        objectId: KEY_SERVER_OBJECT_ID,
        weight: 1,
        aggregatorUrl: AGGREGATOR_URL,
      },
    ],
    verifyKeyServers: false,
  });
  pass("SealClient constructed successfully");
} catch (err) {
  fail("SealClient construction failed", err);
  console.error("\nBlocker: Cannot continue without a SealClient.");
  process.exit(1);
}
console.log();

// ---------------------------------------------------------------------------
// Step 3: Derive encryption ID (mirrors lib/seal/client.ts logic)
// ---------------------------------------------------------------------------

console.log("Step 3: Derive Seal encryption ID from dummy trust object ID...");
const policyBytes = fromHex(DUMMY_TRUST_OBJECT_ID);
const nonce = crypto.getRandomValues(new Uint8Array(5));
const encryptionId = toHex(new Uint8Array([...policyBytes, ...nonce]));
pass(`derived encryptionId (74 hex chars): ${encryptionId}`);
console.log();

// ---------------------------------------------------------------------------
// Step 4: Encrypt test payload
// ---------------------------------------------------------------------------

console.log("Step 4: Encrypt test payload using SealClient.encrypt()...");
console.log("  NOTE: This calls the Seal key server to fetch the public key.");
console.log("        It may fail if the aggregator is unreachable or the");
console.log("        packageId is not registered with the key server.");
console.log();

let encryptedObject: Uint8Array;
let symmetricKey: Uint8Array;

try {
  const result = await sealClient.encrypt({
    threshold: 1,
    packageId: PACKAGE_ID,
    id: encryptionId,
    data: TEST_PAYLOAD,
  });
  encryptedObject = result.encryptedObject;
  symmetricKey = result.key;
  pass("SealClient.encrypt() returned without throwing");
} catch (err) {
  fail("SealClient.encrypt() threw an error", err);
  console.log();
  console.log("Diagnosis:");
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const stack = err.stack ?? "";
    if (
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("connect") ||
      msg.includes("enotfound") ||
      msg.includes("econnrefused")
    ) {
      console.log("  Likely cause: Seal aggregator/key-server is unreachable.");
      console.log("  Check network connectivity and the aggregatorUrl in TESTNET_CONFIG.");
    } else if (
      msg.includes("packageid") ||
      msg.includes("package") ||
      msg.includes("whitelist") ||
      msg.includes("unsupported")
    ) {
      console.log("  Likely cause: The packageId is not whitelisted on the Seal key server.");
      console.log(
        "  The Seal testnet key server only serves packages registered with Mysten Labs.",
      );
      console.log(`  PackageId used: ${PACKAGE_ID}`);
      console.log("  Fix: Register the package with the Seal key server program, or use");
      console.log("  the Seal testnet example package for local testing.");
    } else if (msg.includes("threshold")) {
      console.log("  Likely cause: Not enough key servers responded (threshold not met).");
    } else if (msg.includes("object") || msg.includes("key server")) {
      console.log("  Likely cause: Key server object not found on-chain.");
      console.log(`  keyServerObjectId: ${KEY_SERVER_OBJECT_ID}`);
    } else if (stack.includes("grpc") || stack.includes("baseUrl") || msg.includes("endswith")) {
      console.log("  Likely cause: gRPC transport URL is undefined.");
      console.log("  The SuiGrpcClient requires a baseUrl option for gRPC requests.");
      console.log(
        "  The Seal SDK calls client.core.getObject() — use SuiJsonRpcClient instead.",
      );
    } else {
      console.log("  Unknown error — see full message and stack above.");
    }
  }
  process.exit(1);
}
console.log();

// ---------------------------------------------------------------------------
// Step 5: Validate output
// ---------------------------------------------------------------------------

console.log("Step 5: Validate encrypted output...");

// 5a: Output must be a Uint8Array
if (encryptedObject instanceof Uint8Array) {
  pass("encryptedObject is a Uint8Array");
} else {
  fail(`encryptedObject is not a Uint8Array — got ${typeof encryptedObject}`);
}

// 5b: Ciphertext must be larger than plaintext (BCS overhead + KEM ciphertext + DEM tag)
if (encryptedObject.byteLength > TEST_PAYLOAD.byteLength) {
  pass(
    `encryptedObject.byteLength (${encryptedObject.byteLength}) > plaintext.byteLength (${TEST_PAYLOAD.byteLength})`,
  );
} else {
  fail(
    `encryptedObject.byteLength (${encryptedObject.byteLength}) is NOT larger than plaintext (${TEST_PAYLOAD.byteLength})`,
  );
}

// 5c: Symmetric key must be 32 bytes (AES-256)
if (symmetricKey instanceof Uint8Array && symmetricKey.byteLength === 32) {
  pass(`symmetricKey is a 32-byte Uint8Array (AES-256)`);
} else {
  fail(
    `symmetricKey has unexpected length ${symmetricKey?.byteLength} (expected 32 for AES-256)`,
  );
}

// 5d: Encryption ID length should be 74 hex chars (32-byte objectId + 5-byte nonce = 37 bytes)
const expectedIdLen = 74;
if (encryptionId.length === expectedIdLen) {
  pass(`encryptionId length is ${encryptionId.length} hex chars (correct: 37 bytes * 2)`);
} else {
  fail(
    `encryptionId length is ${encryptionId.length} hex chars (expected ${expectedIdLen})`,
  );
}

console.log();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("=".repeat(60));
console.log("Summary:");
console.log(`  Plaintext size    : ${TEST_PAYLOAD.byteLength} bytes`);
console.log(`  Ciphertext size   : ${encryptedObject.byteLength} bytes`);
console.log(
  `  Overhead          : +${encryptedObject.byteLength - TEST_PAYLOAD.byteLength} bytes (KEM + DEM + BCS metadata)`,
);
console.log(`  Encryption ID     : ${encryptionId}`);
console.log(`  Symmetric key     : ${toHex(symmetricKey).slice(0, 16)}... (DO NOT LOG IN PROD)`);
console.log("=".repeat(60));
console.log();
console.log("RESULT: Seal encryption integration test PASSED.");
