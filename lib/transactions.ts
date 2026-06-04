/**
 * Trustea Transaction Builders
 *
 * Constructs Sui Programmable Transaction Blocks (PTBs) for every public
 * function exposed by the Trustea Move contract (`trustea::trust`).
 *
 * Usage:
 * ```ts
 * import { buildCreateTrustTx } from "@trustea/lib/transactions";
 *
 * const tx = buildCreateTrustTx("Family Trust", "My trust", agentAddr);
 * const result = await suiClient.signAndExecuteTransaction({ signer, transaction: tx });
 * ```
 */

import { Transaction } from "@mysten/sui/transactions";
import { TESTNET_CONFIG } from "./config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sui shared Clock object — always 0x6 on every Sui network. */
const CLOCK_OBJECT_ID = "0x6";

/** Default Trustea package ID (testnet). Can be overridden per-call. */
const DEFAULT_PACKAGE_ID = TESTNET_CONFIG.seal.packageId;

/** The Move module name within the package. */
const MODULE = "trust";

/** Rule type constants — mirror the Move contract. */
export const RULE_TYPE_AGE = 0;
export const RULE_TYPE_TIME = 1;
export const RULE_TYPE_CREDENTIAL = 2;
export const RULE_TYPE_PERIODIC = 3;

// ---------------------------------------------------------------------------
// TrustRule bridge type (imported inline to avoid circular deps)
// ---------------------------------------------------------------------------

/**
 * Subset of the AI-translated TrustRule used by buildAddRuleFromTranslation.
 * Mirrors the full TrustRule interface from agent/src/rule-translator.ts.
 */
export interface TrustRule {
  ruleType: "age" | "time" | "credential" | "periodic" | "custom";
  amount: number;
  isPercentage: boolean;
  conditionDescription: string;
  conditionParams: {
    type: string;
    timestamp?: number;
    periodMs?: number;
    nftType?: string;
    customLogic?: string;
    negativeCheck?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the Move target string for a given function.
 */
function target(packageId: string, fn: string): string {
  return `${packageId}::${MODULE}::${fn}`;
}

/**
 * Map a TrustRule ruleType string to the on-chain u8 constant.
 * Falls back to RULE_TYPE_CREDENTIAL (2) for "custom" / unknown types.
 */
function ruleTypeToU8(ruleType: TrustRule["ruleType"]): number {
  switch (ruleType) {
    case "age":
      return RULE_TYPE_AGE;
    case "time":
      return RULE_TYPE_TIME;
    case "credential":
      return RULE_TYPE_CREDENTIAL;
    case "periodic":
      return RULE_TYPE_PERIODIC;
    default:
      // "custom" has no on-chain equivalent; treat as credential so the
      // agent handles the off-chain logic check.
      return RULE_TYPE_CREDENTIAL;
  }
}

/**
 * Derive the condition_value (u64) from a TrustRule's conditionParams.
 *
 * - age/time  → conditionParams.timestamp (ms) or 0
 * - periodic  → conditionParams.periodMs or 0
 * - credential / custom → 0 (checked off-chain by the agent)
 */
function conditionValueFromRule(rule: TrustRule): bigint {
  const { conditionParams } = rule;
  if (rule.ruleType === "age" || rule.ruleType === "time") {
    return BigInt(conditionParams.timestamp ?? 0);
  }
  if (rule.ruleType === "periodic") {
    return BigInt(conditionParams.periodMs ?? 0);
  }
  return 0n;
}

// ---------------------------------------------------------------------------
// 1. create_trust
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::create_trust`.
 *
 * Signature:
 *   create_trust(name: String, description: String, agent_address: address, clock: &Clock, ctx: &mut TxContext)
 *
 * @param name            Human-readable trust name.
 * @param description     Trust purpose / description.
 * @param agentAddress    Sui address authorised to propose distributions.
 * @param packageId       Trustea package ID (defaults to testnet).
 */
export function buildCreateTrustTx(
  name: string,
  description: string,
  agentAddress: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "create_trust"),
    arguments: [
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.address(agentAddress),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 2. deposit
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::deposit`.
 *
 * Signature:
 *   deposit(trust: &mut Trust, payment: Coin<SUI>, ctx: &mut TxContext)
 *
 * The payment coin is split from the gas coin when `coinObjectId` is not
 * provided. When a specific coin object is given it is used directly.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param amount         Amount to deposit in MIST.
 * @param coinObjectId   Optional existing Coin<SUI> object ID. When omitted
 *                       the gas coin is split for the exact amount.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildDepositTx(
  trustObjectId: string,
  amount: bigint,
  coinObjectId?: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  let paymentCoin;
  if (coinObjectId) {
    paymentCoin = tx.object(coinObjectId);
  } else {
    // Split the exact amount from the gas coin.
    [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  }

  tx.moveCall({
    target: target(packageId, "deposit"),
    arguments: [tx.object(trustObjectId), paymentCoin],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 3. add_beneficiary
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::add_beneficiary`.
 *
 * Signature:
 *   add_beneficiary(trust: &mut Trust, beneficiary: address, beneficiary_name: String,
 *                   conditions_summary: String, allocation_amount: u64,
 *                   is_percentage: bool, clock: &Clock, ctx: &mut TxContext)
 *
 * @param trustObjectId      Shared Trust object ID.
 * @param beneficiary        Sui address of the beneficiary.
 * @param name               Human-readable beneficiary name.
 * @param conditionsSummary  Plain text summary of conditions for the NFT.
 * @param allocationAmount   Amount in MIST, or percentage × 100 if isPercentage.
 * @param isPercentage       True when allocationAmount is a percentage.
 * @param packageId          Trustea package ID (defaults to testnet).
 */
export function buildAddBeneficiaryTx(
  trustObjectId: string,
  beneficiary: string,
  name: string,
  conditionsSummary: string,
  allocationAmount: bigint,
  isPercentage: boolean,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "add_beneficiary"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.address(beneficiary),
      tx.pure.string(name),
      tx.pure.string(conditionsSummary),
      tx.pure.u64(allocationAmount),
      tx.pure.bool(isPercentage),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 4. remove_beneficiary
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::remove_beneficiary`.
 *
 * Signature:
 *   remove_beneficiary(trust: &mut Trust, beneficiary: address,
 *                      nft: BeneficiaryNFT, ctx: &mut TxContext)
 *
 * The caller must own the beneficiary's BeneficiaryNFT object so the contract
 * can burn it, completing the soulbound lifecycle.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param beneficiary    Sui address of the beneficiary to remove.
 * @param nftObjectId    Object ID of the beneficiary's BeneficiaryNFT.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildRemoveBeneficiaryTx(
  trustObjectId: string,
  beneficiary: string,
  nftObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "remove_beneficiary"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.address(beneficiary),
      tx.object(nftObjectId),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 5. add_rule
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::add_rule`.
 *
 * Signature:
 *   add_rule(trust: &mut Trust, rule_type: u8, beneficiary: address,
 *            amount: u64, is_percentage: bool, condition_value: u64,
 *            description: String, ctx: &mut TxContext)
 *
 * @param trustObjectId   Shared Trust object ID.
 * @param ruleType        Rule type (0=age, 1=time, 2=credential, 3=periodic).
 *                        Use the exported RULE_TYPE_* constants.
 * @param beneficiary     Sui address of the target beneficiary (must already be added).
 * @param amount          Amount in MIST, or percentage × 100 if isPercentage.
 * @param isPercentage    True when amount is a percentage.
 * @param conditionValue  Unlock timestamp (ms) for age/time; period (ms) for periodic; 0 for credential.
 * @param description     Human-readable rule description.
 * @param packageId       Trustea package ID (defaults to testnet).
 */
export function buildAddRuleTx(
  trustObjectId: string,
  ruleType: number,
  beneficiary: string,
  amount: bigint,
  isPercentage: boolean,
  conditionValue: bigint,
  description: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "add_rule"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.u8(ruleType),
      tx.pure.address(beneficiary),
      tx.pure.u64(amount),
      tx.pure.bool(isPercentage),
      tx.pure.u64(conditionValue),
      tx.pure.string(description),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 6. buildAddRuleFromTranslation — AI bridge
// ---------------------------------------------------------------------------

/**
 * Build a PTB from an AI-translated TrustRule — the bridge from plain English
 * to on-chain distribution rules.
 *
 * This function maps the structured output of the rule-translator agent into
 * the exact arguments expected by `trustea::trust::add_rule`.
 *
 * Amount conversion:
 *   - isPercentage=true  → amount is stored as (percentage * 100) on-chain
 *                          e.g. 10% → 1000  (contract stores × 100 precision)
 *   - isPercentage=false → amount treated as MIST directly
 *     (caller should pre-convert USD→MIST; this function passes it verbatim)
 *
 * @param trustObjectId    Shared Trust object ID.
 * @param translatedRule   Structured TrustRule from the AI rule translator.
 * @param beneficiaryAddr  On-chain Sui address for the named beneficiary.
 * @param packageId        Trustea package ID (defaults to testnet).
 */
export function buildAddRuleFromTranslation(
  trustObjectId: string,
  translatedRule: TrustRule,
  beneficiaryAddr: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const onChainRuleType = ruleTypeToU8(translatedRule.ruleType);

  // Convert percentage to on-chain representation (× 100 precision).
  // Fixed amounts are passed through as-is (caller converts USD → MIST).
  const onChainAmount = translatedRule.isPercentage
    ? BigInt(Math.round(translatedRule.amount * 100))
    : BigInt(Math.round(translatedRule.amount));

  const conditionValue = conditionValueFromRule(translatedRule);

  return buildAddRuleTx(
    trustObjectId,
    onChainRuleType,
    beneficiaryAddr,
    onChainAmount,
    translatedRule.isPercentage,
    conditionValue,
    translatedRule.conditionDescription,
    packageId
  );
}

// ---------------------------------------------------------------------------
// 7. propose_distribution
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::propose_distribution`.
 *
 * Signature:
 *   propose_distribution(trust: &mut Trust, rule_index: u64, beneficiary: address,
 *                        amount: u64, reason: String, clock: &Clock,
 *                        ctx: &mut TxContext): ID
 *
 * Only the AI agent address configured on the trust may call this.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param ruleIndex      Index of the triggering rule in trust.rules.
 * @param beneficiary    Sui address of the recipient.
 * @param amount         Amount to distribute in MIST.
 * @param reason         Human-readable justification from the agent.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildProposeDistributionTx(
  trustObjectId: string,
  ruleIndex: bigint,
  beneficiary: string,
  amount: bigint,
  reason: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "propose_distribution"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.u64(ruleIndex),
      tx.pure.address(beneficiary),
      tx.pure.u64(amount),
      tx.pure.string(reason),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 8. execute_distribution
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::execute_distribution`.
 *
 * Signature:
 *   execute_distribution(trust: &mut Trust, dist: &mut PendingDistribution,
 *                        clock: &Clock, ctx: &mut TxContext)
 *
 * Can only be called after the override period has elapsed and the
 * distribution has not been cancelled or already executed.
 *
 * @param trustObjectId        Shared Trust object ID.
 * @param distributionObjectId Shared PendingDistribution object ID.
 * @param packageId            Trustea package ID (defaults to testnet).
 */
export function buildExecuteDistributionTx(
  trustObjectId: string,
  distributionObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "execute_distribution"),
    arguments: [
      tx.object(trustObjectId),
      tx.object(distributionObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 9. cancel_distribution
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::cancel_distribution`.
 *
 * Signature:
 *   cancel_distribution(trust: &Trust, dist: &mut PendingDistribution, ctx: &mut TxContext)
 *
 * Only the grantor may call this, and only within the override window.
 *
 * @param trustObjectId        Shared Trust object ID.
 * @param distributionObjectId Shared PendingDistribution object ID.
 * @param packageId            Trustea package ID (defaults to testnet).
 */
export function buildCancelDistributionTx(
  trustObjectId: string,
  distributionObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "cancel_distribution"),
    arguments: [
      tx.object(trustObjectId),
      tx.object(distributionObjectId),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 10. add_walrus_ref
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::add_walrus_ref`.
 *
 * Signature:
 *   add_walrus_ref(trust: &mut Trust, blob_id: String, ctx: &mut TxContext)
 *
 * Can be called by the grantor or the agent address.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param blobId         Walrus blob ID string referencing an encrypted document.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildAddWalrusRefTx(
  trustObjectId: string,
  blobId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "add_walrus_ref"),
    arguments: [tx.object(trustObjectId), tx.pure.string(blobId)],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 11. pause_trust
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::pause_trust`.
 *
 * Signature:
 *   pause_trust(trust: &mut Trust, ctx: &mut TxContext)
 *
 * Only the grantor may call this. Trust must be ACTIVE.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildPauseTrustTx(
  trustObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "pause_trust"),
    arguments: [tx.object(trustObjectId)],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 12. resume_trust
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::resume_trust`.
 *
 * Signature:
 *   resume_trust(trust: &mut Trust, ctx: &mut TxContext)
 *
 * Only the grantor may call this. Trust must be PAUSED.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildResumeTrustTx(
  trustObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "resume_trust"),
    arguments: [tx.object(trustObjectId)],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 13. close_trust
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::close_trust`.
 *
 * Signature:
 *   close_trust(trust: &mut Trust, ctx: &mut TxContext)
 *
 * Permanently closes the trust and returns any remaining balance to the grantor.
 * Only the grantor may call this. Irreversible.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildCloseTrustTx(
  trustObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "close_trust"),
    arguments: [tx.object(trustObjectId)],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 14. amend_trust
// ---------------------------------------------------------------------------

/**
 * Options for amending a trust. All fields are optional; supply only those
 * you want to change. `ruleIndex` and `setRuleActive` must be supplied together.
 */
export interface AmendTrustOptions {
  /** New trust name, or omit to leave unchanged. */
  newName?: string;
  /** New trust description, or omit to leave unchanged. */
  newDescription?: string;
  /** Index of the rule to toggle. Must be provided together with setRuleActive. */
  ruleIndex?: bigint;
  /** Whether to activate (true) or deactivate (false) the rule at ruleIndex. */
  setRuleActive?: boolean;
}

/**
 * Build a PTB that calls `trustea::trust::amend_trust`.
 *
 * Signature:
 *   amend_trust(trust: &mut Trust, new_name: Option<String>,
 *               new_description: Option<String>, rule_index: Option<u64>,
 *               set_rule_active: Option<bool>, ctx: &mut TxContext)
 *
 * Only the grantor may call this. Trust must be ACTIVE.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param opts           Fields to amend (all optional).
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildAmendTrustTx(
  trustObjectId: string,
  opts: AmendTrustOptions,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  // Encode Move Option<String> — vector of 0 or 1 element.
  const newName =
    opts.newName !== undefined
      ? tx.pure(
          new Uint8Array([
            1,
            ...encodeStringOption(opts.newName),
          ])
        )
      : tx.pure(new Uint8Array([0]));

  const newDescription =
    opts.newDescription !== undefined
      ? tx.pure(
          new Uint8Array([
            1,
            ...encodeStringOption(opts.newDescription),
          ])
        )
      : tx.pure(new Uint8Array([0]));

  const ruleIndex =
    opts.ruleIndex !== undefined
      ? tx.pure(encodeOptionU64(opts.ruleIndex))
      : tx.pure(new Uint8Array([0]));

  const setRuleActive =
    opts.setRuleActive !== undefined
      ? tx.pure(new Uint8Array([1, opts.setRuleActive ? 1 : 0]))
      : tx.pure(new Uint8Array([0]));

  tx.moveCall({
    target: target(packageId, "amend_trust"),
    arguments: [
      tx.object(trustObjectId),
      newName,
      newDescription,
      ruleIndex,
      setRuleActive,
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// BCS helpers for Option<T> encoding
// ---------------------------------------------------------------------------

/**
 * BCS-encode a UTF-8 string as bytes (length-prefixed ULEB128 + content).
 * Used for Option<String> argument construction.
 */
function encodeStringOption(value: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const lenBytes = ulebEncode(strBytes.length);
  const result = new Uint8Array(lenBytes.length + strBytes.length);
  result.set(lenBytes, 0);
  result.set(strBytes, lenBytes.length);
  return result;
}

/**
 * BCS-encode Option<u64>: 0x00 for None, 0x01 followed by 8 LE bytes for Some.
 */
function encodeOptionU64(value: bigint): Uint8Array {
  const result = new Uint8Array(9);
  result[0] = 1; // Some
  const view = new DataView(result.buffer);
  view.setBigUint64(1, value, true /* little-endian */);
  return result;
}

/**
 * ULEB128-encode a non-negative integer.
 */
function ulebEncode(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}
