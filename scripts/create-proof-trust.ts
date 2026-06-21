#!/usr/bin/env tsx
/**
 * Create a fully-loaded "proof trust" on Sui testnet:
 *   tx1: create_trust
 *   tx2: add_beneficiary + add_rule + configure_dms + deposit  (single PTB)
 *
 * Uses the active sui CLI key from ~/.sui/sui_config/sui.keystore
 * Mirrors the frontend wizard's PTB shape (frontend/src/app/app/create/page.tsx:260+).
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { readFileSync } from "fs";
import { homedir } from "os";

const PACKAGE_ID = "0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a";
const BENEFICIARY = "0x645ec801f925f1865f9049f887486da77d3d6f50f63f740fbb281dcb47621387"; // burner

const keystore: string[] = JSON.parse(
  readFileSync(`${homedir()}/.sui/sui_config/sui.keystore`, "utf8"),
);
const { secretKey } = decodeSuiPrivateKey(
  Ed25519Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(keystore[0], "base64").slice(1)),
  ).getSecretKey(),
);
const kp = Ed25519Keypair.fromSecretKey(secretKey);
const SENDER = kp.toSuiAddress();
console.log("Sender:", SENDER);

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });

const MIN = 60_000;
const MIST = 1_000_000_000;

async function main() {
  // ---- tx1: create_trust ----
  console.log("\n[tx1] create_trust …");
  const tx1 = new Transaction();
  tx1.moveCall({
    target: `${PACKAGE_ID}::trust::create_trust`,
    arguments: [
      tx1.pure.string("Proof Trust — DMS + Rule"),
      tx1.pure.string("End-to-end on-chain proof: AI-translated rule, soulbound beneficiary, dead-man switch armed."),
      tx1.pure.address(SENDER),               // agent_address
      tx1.pure.u64(48 * 60 * 60 * 1000),       // override_period_ms (48h)
      tx1.pure.bool(true),                     // is_revocable
      tx1.pure.option("address", SENDER),      // successor_grantor (required by configure_dms)
      tx1.pure.option("address", null),        // trust_protector
      tx1.object("0x6"),
    ],
  });
  const r1 = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx1,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: r1.digest });
  const created = r1.objectChanges?.find(
    (c: any) => c.type === "created" && c.objectType?.includes("::trust::Trust"),
  ) as any;
  if (!created) throw new Error("Trust object not found in objectChanges");
  const trustId = created.objectId;
  console.log("  trust:", trustId);
  console.log("  digest:", r1.digest);

  // ---- tx2: add_beneficiary + add_rule + configure_dms + deposit ----
  console.log("\n[tx2] add_beneficiary + add_rule + configure_dms + deposit …");
  const tx2 = new Transaction();

  tx2.moveCall({
    target: `${PACKAGE_ID}::trust::add_beneficiary`,
    arguments: [
      tx2.object(trustId),
      tx2.pure.address(BENEFICIARY),
      tx2.pure.string("Alice"),
      tx2.pure.string("Monthly stipend while enrolled in university; full inheritance at 30."),
      tx2.pure.u64(100 * 100),     // 100% (basis points)
      tx2.pure.bool(true),         // is_percentage
      tx2.object("0x6"),
    ],
  });

  // Rule: PERIODIC (type=3), pay 0.01 SUI every 30 days
  tx2.moveCall({
    target: `${PACKAGE_ID}::trust::add_rule`,
    arguments: [
      tx2.object(trustId),
      tx2.pure.u8(3),                                // RULE_TYPE_PERIODIC
      tx2.pure.address(BENEFICIARY),
      tx2.pure.u64(Math.round(0.01 * MIST)),         // 0.01 SUI
      tx2.pure.bool(false),                          // not percentage — flat amount
      tx2.pure.u64(30 * 24 * 60 * 60 * 1000),        // periodMs = 30 days
      tx2.pure.string("Pay 0.01 SUI to Alice every 30 days while enrolled in university."),
    ],
  });

  // DMS: 2-min heartbeat, 2-min grace, 5-min veto, threshold 1, 1 activator (sender)
  tx2.moveCall({
    target: `${PACKAGE_ID}::trust::configure_dms`,
    arguments: [
      tx2.object(trustId),
      tx2.pure.u64(2 * MIN),       // heartbeat_period_ms
      tx2.pure.u64(2 * MIN),       // grace_period_ms
      tx2.pure.u64(5 * MIN),       // veto_period_ms
      tx2.pure.u8(1),              // activation_threshold
      tx2.pure.vector("address", [SENDER]),
      tx2.object("0x6"),
    ],
  });

  // Deposit 0.005 SUI (sender low on gas)
  const depositMist = Math.round(0.005 * MIST);
  const [coin] = tx2.splitCoins(tx2.gas, [tx2.pure.u64(depositMist)]);
  tx2.moveCall({
    target: `${PACKAGE_ID}::trust::deposit`,
    arguments: [tx2.object(trustId), coin],
  });

  const r2 = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx2,
    options: { showEffects: true, showEvents: true },
  });
  await client.waitForTransaction({ digest: r2.digest });
  console.log("  digest:", r2.digest);
  console.log("  status:", r2.effects?.status);
  console.log("  events:", r2.events?.length, "emitted");

  // ---- verify on chain ----
  console.log("\n[verify] reading trust object …");
  const obj = await client.getObject({ id: trustId, options: { showContent: true } });
  const f: any = (obj.data?.content as any)?.fields;
  console.log("  name:", f.name);
  console.log("  beneficiaries:", f.beneficiaries?.length ?? 0);
  console.log("  rules:", f.rules?.length ?? 0);
  console.log("  dms_enabled:", f.dms_enabled);
  console.log("  dms_heartbeat_period_ms:", f.dms_heartbeat_period_ms);
  console.log("  balance (MIST):", f.balance);

  console.log("\n✓ Proof trust ready:");
  console.log("  /app/trust?id=" + trustId);
  console.log("  https://testnet.suivision.xyz/object/" + trustId);
}

main().catch((e) => { console.error(e); process.exit(1); });
