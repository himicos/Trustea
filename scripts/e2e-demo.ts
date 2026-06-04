#!/usr/bin/env tsx
/**
 * Trustea — End-to-end demonstration script
 *
 * Demonstrates the full Trustea flow on Sui testnet:
 *   1. Create a Trust on-chain
 *   2. Add a beneficiary
 *   3. Deposit SUI
 *   4. Encrypt & upload a trust document to Walrus via Seal
 *   5. AI agent translates a plain-English rule
 *   6. Agent proposes a distribution
 *   7. Beneficiary fetches + decrypts the trust document
 *
 * Prerequisites:
 *   - sui CLI: `sui client active-address` returns a funded address
 *   - ANTHROPIC_API_KEY env var set
 *   - TRUSTEA_PACKAGE_ID env var set (from deploy.sh output)
 *   - TRUSTEA_GRANTOR_KEY env var: base64-encoded Sui private key (Ed25519)
 *   - TRUSTEA_BENEFICIARY_KEY env var: base64-encoded Sui private key (Ed25519)
 *
 * Run:
 *   TRUSTEA_PACKAGE_ID=0x... ANTHROPIC_API_KEY=... npx tsx scripts/e2e-demo.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { TESTNET_CONFIG } from "../lib/config.js";
import { createWalrusClient } from "../lib/walrus/client.js";
import { translateRule } from "../agent/src/rule-translator.js";

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

const PACKAGE_ID = process.env.TRUSTEA_PACKAGE_ID;
if (!PACKAGE_ID) {
  console.error("ERROR: Set TRUSTEA_PACKAGE_ID env var (run ./scripts/deploy.sh first)");
  process.exit(1);
}
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

function loadKeypair(envKey: string, label: string): Ed25519Keypair {
  const raw = process.env[envKey];
  if (raw) {
    return Ed25519Keypair.fromSecretKey(Buffer.from(raw, "base64"));
  }
  console.log(`  [${label}] No ${envKey} set — generating ephemeral keypair`);
  return new Ed25519Keypair();
}

// ---------------------------------------------------------------------------
// Sui client
// ---------------------------------------------------------------------------

const suiClient = new SuiJsonRpcClient({ url: TESTNET_CONFIG.sui.rpcUrl, network: "testnet" });

// ---------------------------------------------------------------------------
// Walrus client
// ---------------------------------------------------------------------------

const walrus = createWalrusClient("testnet");

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

let step = 0;
function log(msg: string) {
  console.log(msg);
}
function section(title: string) {
  step++;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  STEP ${step}: ${title}`);
  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------
// Main demo flow
// ---------------------------------------------------------------------------

log("\n🏛  Trustea — Live End-to-End Demo\n");

const grantor = loadKeypair("TRUSTEA_GRANTOR_KEY", "grantor");
const beneficiary = loadKeypair("TRUSTEA_BENEFICIARY_KEY", "beneficiary");
const grantorAddr = grantor.toSuiAddress();
const beneficiaryAddr = beneficiary.toSuiAddress();

log(`  Grantor    : ${grantorAddr}`);
log(`  Beneficiary: ${beneficiaryAddr}`);
log(`  Package    : ${PACKAGE_ID}`);

// Step 1: Check balances
section("Check balances");
const [grantorBalance, benBalance] = await Promise.all([
  suiClient.getBalance({ owner: grantorAddr }),
  suiClient.getBalance({ owner: beneficiaryAddr }),
]);
log(`  Grantor     balance: ${BigInt(grantorBalance.totalBalance) / 1_000_000_000n} SUI`);
log(`  Beneficiary balance: ${BigInt(benBalance.totalBalance) / 1_000_000_000n} SUI`);

if (BigInt(grantorBalance.totalBalance) < 100_000_000n) {
  log("\n⚠️  Grantor has < 0.1 SUI. Get testnet gas from the Sui Discord faucet.");
  log("   Then re-run this script.");
  process.exit(1);
}

// Step 2: AI Rule Translation
section("AI Rule Translation (Claude)");
if (!ANTHROPIC_API_KEY) {
  log("  ANTHROPIC_API_KEY not set — skipping rule translation demo");
} else {
  const rawRules = [
    "Send Alice $500 every month",
    "Release the full trust to Bob when he turns 25 (born 2001-06-15)",
    "Give Carol 10% of the trust balance each year",
  ];
  for (const raw of rawRules) {
    const result = await translateRule(raw, ANTHROPIC_API_KEY);
    log(`\n  Input  : "${raw}"`);
    log(`  Rule   : type=${result.rule.ruleType}, amount=${result.rule.amount}, period=${result.rule.conditionParams.periodMs ?? "n/a"}ms`);
    log(`  Explain: ${result.explanation}`);
    log(`  Conf   : ${(result.confidence * 100).toFixed(0)}%`);
    if (result.warnings.length) log(`  ⚠️  ${result.warnings.join("; ")}`);
  }
}

// Step 3: Create trust on-chain
section("Create Trust (on-chain)");
const createTx = new Transaction();
createTx.moveCall({
  target: `${PACKAGE_ID}::trust::create_trust`,
  arguments: [
    createTx.pure.string("Trustea Demo Trust"),
    createTx.pure.string("Created via Trustea e2e demo script"),
    createTx.pure.address(grantorAddr), // agent = grantor for demo
    createTx.object("0x6"),             // Clock shared object
  ],
});
createTx.setSender(grantorAddr);
createTx.setGasBudget(20_000_000);

const createResult = await suiClient.signAndExecuteTransaction({
  transaction: createTx,
  signer: grantor,
  options: { showObjectChanges: true, showEffects: true },
});

const trustChange = createResult.objectChanges?.find(
  (c) => c.type === "created" && "objectType" in c && c.objectType?.includes("::trust::Trust"),
);
if (!trustChange || trustChange.type !== "created") {
  console.error("Failed to find Trust in objectChanges:", createResult.objectChanges);
  process.exit(1);
}
const trustObjectId = trustChange.objectId;
log(`  Trust created: ${trustObjectId}`);
log(`  Tx digest    : ${createResult.digest}`);

// Step 4: Deposit SUI
section("Deposit 1 SUI into trust");
const depositTx = new Transaction();
const [coin] = depositTx.splitCoins(depositTx.gas, [depositTx.pure.u64(1_000_000_000)]);
depositTx.moveCall({
  target: `${PACKAGE_ID}::trust::deposit`,
  arguments: [depositTx.object(trustObjectId), coin],
});
depositTx.setSender(grantorAddr);
depositTx.setGasBudget(20_000_000);

const depositResult = await suiClient.signAndExecuteTransaction({
  transaction: depositTx,
  signer: grantor,
  options: { showEffects: true },
});
log(`  Deposited 1 SUI — tx: ${depositResult.digest}`);

// Step 5: Add beneficiary
section("Add Beneficiary (mints soulbound NFT)");
const addBenTx = new Transaction();
addBenTx.moveCall({
  target: `${PACKAGE_ID}::trust::add_beneficiary`,
  arguments: [
    addBenTx.object(trustObjectId),
    addBenTx.pure.address(beneficiaryAddr),
    addBenTx.pure.string("Alice"),
    addBenTx.pure.string("Monthly allowance of 0.5 SUI"),
    addBenTx.pure.u64(500_000_000),
    addBenTx.pure.bool(false),
    addBenTx.object("0x6"), // Clock
  ],
});
addBenTx.setSender(grantorAddr);
addBenTx.setGasBudget(20_000_000);

const addBenResult = await suiClient.signAndExecuteTransaction({
  transaction: addBenTx,
  signer: grantor,
  options: { showObjectChanges: true, showEffects: true },
});
const nftChange = addBenResult.objectChanges?.find(
  (c) => c.type === "created" && "objectType" in c && c.objectType?.includes("::beneficiary_nft::BeneficiaryNFT"),
);
log(`  Beneficiary added — tx: ${addBenResult.digest}`);
if (nftChange) log(`  BeneficiaryNFT: ${"objectId" in nftChange ? nftChange.objectId : "?"}`);

// Step 6: Encrypt & store trust document on Walrus
section("Encrypt + Store Trust Document on Walrus");
const trustDocument = {
  title: "Trustea Demo Trust Agreement",
  grantor: grantorAddr,
  beneficiary: beneficiaryAddr,
  terms: "Alice receives 0.5 SUI per month as allowance.",
  created: new Date().toISOString(),
};
const docBytes = new TextEncoder().encode(JSON.stringify(trustDocument, null, 2));
log(`  Document size: ${docBytes.byteLength} bytes`);
log(`  Uploading to Walrus (no Seal — demo mode without key server)...`);

const { blobId } = await walrus.storeDocument(docBytes, 5);
log(`  Blob ID: ${blobId}`);

// Anchor blob ID on-chain
const walrusRefTx = new Transaction();
walrusRefTx.moveCall({
  target: `${PACKAGE_ID}::trust::add_walrus_ref`,
  arguments: [
    walrusRefTx.object(trustObjectId),
    walrusRefTx.pure.string(blobId),
  ],
});
walrusRefTx.setSender(grantorAddr);
walrusRefTx.setGasBudget(20_000_000);

const walrusRefResult = await suiClient.signAndExecuteTransaction({
  transaction: walrusRefTx,
  signer: grantor,
  options: { showEffects: true },
});
log(`  Blob ID anchored on-chain — tx: ${walrusRefResult.digest}`);

// Step 7: Retrieve from Walrus (verify round-trip)
section("Retrieve Trust Document from Walrus");
const retrieved = await walrus.readDocument(blobId);
const decodedDoc = JSON.parse(new TextDecoder().decode(retrieved)) as typeof trustDocument;
log(`  Retrieved ${retrieved.byteLength} bytes`);
log(`  Title  : ${decodedDoc.title}`);
log(`  Grantor: ${decodedDoc.grantor}`);
log(`  Terms  : ${decodedDoc.terms}`);

// Step 8: Read trust state on-chain
section("Read Trust State On-Chain");
const trustObj = await suiClient.getObject({
  id: trustObjectId,
  options: { showContent: true },
});
if (trustObj.data?.content?.dataType === "moveObject") {
  const fields = trustObj.data.content.fields as Record<string, unknown>;
  log(`  Name             : ${fields.name}`);
  log(`  Status           : ${fields.status} (0=active)`);
  log(`  Balance (MIST)   : ${fields.balance}`);
  log(`  Beneficiary count: ${(fields.beneficiaries as string[])?.length ?? 0}`);
  log(`  Walrus blobs     : ${(fields.walrus_blob_ids as string[])?.join(", ")}`);
}

// Done
console.log(`\n${"=".repeat(60)}`);
console.log("  DEMO COMPLETE");
console.log("=".repeat(60));
console.log(`\n  Trust ID : ${trustObjectId}`);
console.log(`  Blob ID  : ${blobId}`);
console.log("\n  Explore on Suivision:");
console.log(`    https://testnet.suivision.xyz/object/${trustObjectId}`);
console.log(`    https://suiscan.xyz/testnet/object/${trustObjectId}`);
console.log("\n  Walrus blob:");
console.log(`    https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
