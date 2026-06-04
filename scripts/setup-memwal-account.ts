#!/usr/bin/env tsx
/**
 * One-time MemWal account setup on Sui testnet.
 *
 * Creates the on-chain account and registers the delegate key.
 * After running, copy the MEMWAL_ACCOUNT_ID to .env.
 *
 * Run:
 *   npx tsx scripts/setup-memwal-account.ts
 */

import fs from "fs";
import path from "path";
import { createAccount, addDelegateKey } from "@mysten-incubation/memwal/account";
import { TESTNET_CONFIG } from "../lib/config.js";

// Load .env manually
const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  env[key] = rest.join("=");
}

const MEMWAL_PUBLIC_KEY = env.MEMWAL_PUBLIC_KEY;
if (!MEMWAL_PUBLIC_KEY) {
  console.error("MEMWAL_PUBLIC_KEY not found in .env");
  process.exit(1);
}

// Get Sui private key from keystore (bech32 format)
const home = process.env.HOME || "/Users/apple";
const keystorePath = path.join(home, ".sui/sui_config/sui.keystore");
const keystore = JSON.parse(fs.readFileSync(keystorePath, "utf-8")) as string[];
// The keystore stores base64-encoded keys. We need the bech32 suiprivkey format.
// Let's use the raw key and convert.
const rawKey = Buffer.from(keystore[0], "base64");
// Sui keystore: byte[0] = scheme (0=ed25519), bytes[1..33] = secret key
const secretBytes = rawKey.subarray(1, 33);

// Import to get the bech32 private key
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
const keypair = Ed25519Keypair.fromSecretKey(secretBytes);
const suiPrivateKey = keypair.getSecretKey();

console.log("MemWal Account Setup");
console.log(`  Package:    ${TESTNET_CONFIG.memwal.packageId}`);
console.log(`  Registry:   ${TESTNET_CONFIG.memwal.registryId}`);
console.log(`  Sui Address: ${keypair.toSuiAddress()}`);
console.log(`  Delegate PK: ${MEMWAL_PUBLIC_KEY.slice(0, 16)}...`);

// Step 1: Create account
// Create SuiClient for the memwal SDK
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
const suiClient = new SuiJsonRpcClient({ url: TESTNET_CONFIG.sui.rpcUrl, network: "testnet" });

console.log("\n[Step 1] Creating MemWal account on-chain...");
try {
  const result = await createAccount({
    packageId: TESTNET_CONFIG.memwal.packageId,
    registryId: TESTNET_CONFIG.memwal.registryId,
    suiPrivateKey,
    suiNetwork: "testnet",
    suiClient,
  });

  console.log(`  Account created!`);
  console.log(`  Account ID: ${result.accountId}`);
  console.log(`  Owner:      ${result.owner}`);
  console.log(`  Tx digest:  ${result.digest}`);

  // Step 2: Add delegate key
  console.log("\n[Step 2] Adding delegate key...");
  const addResult = await addDelegateKey({
    packageId: TESTNET_CONFIG.memwal.packageId,
    accountId: result.accountId,
    publicKey: MEMWAL_PUBLIC_KEY,
    label: "Trustea AI Agent v1",
    suiPrivateKey,
    suiNetwork: "testnet",
    suiClient,
  });

  console.log(`  Delegate key added!`);
  console.log(`  Tx digest: ${addResult.digest}`);

  // Step 3: Update .env
  console.log("\n[Step 3] Updating .env...");
  let newEnv = envContent;
  if (newEnv.includes("# MEMWAL_ACCOUNT_ID=")) {
    newEnv = newEnv.replace(
      /# MEMWAL_ACCOUNT_ID=.*/,
      `MEMWAL_ACCOUNT_ID=${result.accountId}`,
    );
  } else if (newEnv.includes("MEMWAL_ACCOUNT_ID=")) {
    newEnv = newEnv.replace(
      /MEMWAL_ACCOUNT_ID=.*/,
      `MEMWAL_ACCOUNT_ID=${result.accountId}`,
    );
  } else {
    newEnv += `\nMEMWAL_ACCOUNT_ID=${result.accountId}\n`;
  }
  fs.writeFileSync(envPath, newEnv);
  console.log(`  .env updated with MEMWAL_ACCOUNT_ID=${result.accountId}`);

  console.log("\n  Done! MemWal account is ready.");
} catch (e) {
  console.error("Failed:", e);
  process.exit(1);
}
