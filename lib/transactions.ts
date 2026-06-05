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
 *   create_trust(name: String, description: String, agent_address: address,
 *                override_period_ms: u64, is_revocable: bool,
 *                successor_grantor: Option<address>, trust_protector: Option<address>,
 *                clock: &Clock, ctx: &mut TxContext)
 *
 * @param name               Human-readable trust name.
 * @param description        Trust purpose / description.
 * @param agentAddress       Sui address authorised to propose distributions.
 * @param overridePeriodMs   Override period in ms (0 = use 48hr default).
 * @param isRevocable        Whether grantor can close/withdraw.
 * @param successorGrantor   Optional successor grantor address (null = none).
 * @param trustProtector     Optional trust protector address (null = none).
 * @param packageId          Trustea package ID (defaults to testnet).
 */
export function buildCreateTrustTx(
  name: string,
  description: string,
  agentAddress: string,
  overridePeriodMs: bigint = 0n,
  isRevocable: boolean = true,
  successorGrantor: string | null = null,
  trustProtector: string | null = null,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "create_trust"),
    arguments: [
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.address(agentAddress),
      tx.pure.u64(overridePeriodMs),
      tx.pure.bool(isRevocable),
      tx.pure.option("address", successorGrantor ?? undefined),
      tx.pure.option("address", trustProtector ?? undefined),
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

// ---------------------------------------------------------------------------
// 15. request_distribution (beneficiary self-service)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::request_distribution`.
 *
 * Signature:
 *   request_distribution(trust: &Trust, amount: u64, reason: String,
 *                        category: String, clock: &Clock, ctx: &mut TxContext)
 *
 * Must be called by a registered beneficiary of the trust.
 *
 * @param trustObjectId  Shared Trust object ID.
 * @param amount         Requested amount in MIST.
 * @param reason         Human-readable reason for the request.
 * @param category       HEMS category: "health" | "education" | "maintenance" | "support" | "other".
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildRequestDistributionTx(
  trustObjectId: string,
  amount: bigint,
  reason: string,
  category: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "request_distribution"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.u64(amount),
      tx.pure.string(reason),
      tx.pure.string(category),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 16. approve_request (grantor/agent approves beneficiary request)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::approve_request`.
 *
 * Signature:
 *   approve_request(trust: &mut Trust, request: &mut DistributionRequest,
 *                   clock: &Clock, ctx: &mut TxContext): ID
 *
 * Creates a PendingDistribution that goes through the normal override flow.
 *
 * @param trustObjectId    Shared Trust object ID.
 * @param requestObjectId  Shared DistributionRequest object ID.
 * @param packageId        Trustea package ID (defaults to testnet).
 */
export function buildApproveRequestTx(
  trustObjectId: string,
  requestObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "approve_request"),
    arguments: [
      tx.object(trustObjectId),
      tx.object(requestObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 17. deny_request (grantor denies beneficiary request)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::deny_request`.
 *
 * Signature:
 *   deny_request(trust: &Trust, request: &mut DistributionRequest, ctx: &mut TxContext)
 *
 * @param trustObjectId    Shared Trust object ID.
 * @param requestObjectId  Shared DistributionRequest object ID.
 * @param packageId        Trustea package ID (defaults to testnet).
 */
export function buildDenyRequestTx(
  trustObjectId: string,
  requestObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "deny_request"),
    arguments: [
      tx.object(trustObjectId),
      tx.object(requestObjectId),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 18. set_agent_address (rotate agent — grantor or trust protector)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::set_agent_address`.
 *
 * Signature:
 *   set_agent_address(trust: &mut Trust, new_agent: address, ctx: &mut TxContext)
 *
 * Can be called by the grantor or the trust protector.
 *
 * @param trustObjectId   Shared Trust object ID.
 * @param newAgentAddress New AI agent Sui address.
 * @param packageId       Trustea package ID (defaults to testnet).
 */
export function buildSetAgentAddressTx(
  trustObjectId: string,
  newAgentAddress: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "set_agent_address"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.address(newAgentAddress),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 19. set_successor_grantor
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::trust::set_successor_grantor`.
 *
 * Signature:
 *   set_successor_grantor(trust: &mut Trust, new_successor: Option<address>, ctx: &mut TxContext)
 *
 * Only the grantor may call this. Pass null to clear the successor.
 *
 * @param trustObjectId    Shared Trust object ID.
 * @param successorAddress New successor address, or null to clear.
 * @param packageId        Trustea package ID (defaults to testnet).
 */
export function buildSetSuccessorGrantorTx(
  trustObjectId: string,
  successorAddress: string | null,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target(packageId, "set_successor_grantor"),
    arguments: [
      tx.object(trustObjectId),
      tx.pure.option("address", successorAddress ?? undefined),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 20. mint_rwa_token (RWA token module)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::rwa_token::mint_rwa_token`.
 *
 * Signature:
 *   mint_rwa_token(trust_id: ID, asset_type: String, description: String,
 *                  estimated_value_usd: u64, documentation_blob_id: String,
 *                  clock: &Clock, ctx: &mut TxContext)
 *
 * Mints a soulbound RWA token transferred to the caller (grantor).
 *
 * @param trustId               Trust object ID this RWA belongs to.
 * @param assetType             Asset category: "real_estate" | "securities" | "vehicle" | "business_interest" | "other".
 * @param description           Human-readable description of the asset.
 * @param estimatedValueUsd     Estimated USD value (u64).
 * @param documentationBlobId  Walrus blob ID for encrypted asset docs.
 * @param packageId             Trustea package ID (defaults to testnet).
 */
export function buildMintRWATokenTx(
  trustId: string,
  assetType: string,
  description: string,
  estimatedValueUsd: bigint,
  documentationBlobId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::rwa_token::mint_rwa_token`,
    arguments: [
      tx.pure.id(trustId),
      tx.pure.string(assetType),
      tx.pure.string(description),
      tx.pure.u64(estimatedValueUsd),
      tx.pure.string(documentationBlobId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 21. update_valuation (RWA token module)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::rwa_token::update_valuation`.
 *
 * Signature:
 *   update_valuation(token: &mut RWAToken, new_value: u64, clock: &Clock, ctx: &mut TxContext)
 *
 * Can be called by the holder (grantor). Token must be owned by the caller.
 *
 * @param tokenObjectId  RWAToken object ID (owned by caller).
 * @param newValueUsd    New estimated USD value.
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildUpdateRWAValuationTx(
  tokenObjectId: string,
  newValueUsd: bigint,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::rwa_token::update_valuation`,
    arguments: [
      tx.object(tokenObjectId),
      tx.pure.u64(newValueUsd),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// 22. burn_rwa_token (RWA token module)
// ---------------------------------------------------------------------------

/**
 * Build a PTB that calls `trustea::rwa_token::burn_rwa_token`.
 *
 * Signature:
 *   burn_rwa_token(token: RWAToken, ctx: &TxContext)
 *
 * Burns the soulbound RWA token. Caller must be the holder (grantor).
 *
 * @param tokenObjectId  RWAToken object ID (owned by caller).
 * @param packageId      Trustea package ID (defaults to testnet).
 */
export function buildBurnRWATokenTx(
  tokenObjectId: string,
  packageId: string = DEFAULT_PACKAGE_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::rwa_token::burn_rwa_token`,
    arguments: [
      tx.object(tokenObjectId),
    ],
  });

  return tx;
}

// ---------------------------------------------------------------------------
// Full deploy — compose entire wizard into a single PTB
// ---------------------------------------------------------------------------

/** A beneficiary to add during trust deployment. */
export interface DeployBeneficiary {
  address: string;
  name: string;
  conditionsSummary: string;
  allocationAmount: bigint;
  isPercentage: boolean;
}

/** Parameters for deploying a full trust in one transaction. */
export interface FullDeployParams {
  name: string;
  description: string;
  agentAddress: string;
  depositAmount: bigint;
  beneficiaries: DeployBeneficiary[];
  rules: { beneficiaryAddress: string; rule: TrustRule }[];
  walrusBlobId?: string;
  packageId?: string;
  /** Override period in ms (0 = use 48hr default). */
  overridePeriodMs?: bigint;
  /** Whether grantor can close/withdraw (default true). */
  isRevocable?: boolean;
  /** Optional successor grantor address. */
  successorGrantor?: string | null;
  /** Optional trust protector address. */
  trustProtector?: string | null;
}

/**
 * Compose the entire create-trust wizard into a single PTB.
 *
 * Executes in order:
 *   1. create_trust → returns shared Trust object
 *   2. deposit (split from gas)
 *   3. add_beneficiary for each beneficiary (mints NFTs)
 *   4. add_rule for each rule
 *   5. add_walrus_ref if a document blobId is provided
 *
 * The user signs ONCE for the entire deployment.
 *
 * Note: Because `create_trust` shares the Trust object, subsequent calls
 * in the same PTB can reference it via the transaction result. However,
 * Sui requires shared objects to be passed by ID (not by result) in the
 * same PTB. So we use a two-transaction approach:
 *   - Tx 1: create_trust (returns trust ID)
 *   - Tx 2: deposit + add beneficiaries + add rules + add walrus ref
 *
 * For hackathon simplicity, this function returns TWO transactions:
 *   [0] = create_trust
 *   [1] = everything else (caller must extract trustId from tx1 result)
 *
 * In production, a custom Move function would batch all of this.
 */
export function buildFullDeployTxs(
  params: FullDeployParams,
): { createTx: Transaction; setupTx: (trustObjectId: string) => Transaction } {
  const pkg = params.packageId ?? DEFAULT_PACKAGE_ID;

  // Transaction 1: Create the trust
  const createTx = buildCreateTrustTx(
    params.name,
    params.description,
    params.agentAddress,
    params.overridePeriodMs ?? 0n,
    params.isRevocable ?? true,
    params.successorGrantor ?? null,
    params.trustProtector ?? null,
    pkg,
  );

  // Transaction 2: Setup function — called after trust ID is known
  function setupTx(trustObjectId: string): Transaction {
    const tx = new Transaction();

    // Deposit
    if (params.depositAmount > 0n) {
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.depositAmount)]);
      tx.moveCall({
        target: target(pkg, "deposit"),
        arguments: [tx.object(trustObjectId), coin],
      });
    }

    // Add beneficiaries
    for (const ben of params.beneficiaries) {
      tx.moveCall({
        target: target(pkg, "add_beneficiary"),
        arguments: [
          tx.object(trustObjectId),
          tx.pure.address(ben.address),
          tx.pure.string(ben.name),
          tx.pure.string(ben.conditionsSummary),
          tx.pure.u64(ben.allocationAmount),
          tx.pure.bool(ben.isPercentage),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });
    }

    // Add rules
    for (const { beneficiaryAddress, rule } of params.rules) {
      const ruleType = ruleTypeToU8(rule.ruleType);
      const amount = rule.isPercentage
        ? BigInt(Math.round(rule.amount * 100))
        : BigInt(Math.round(rule.amount * 1_000_000_000));
      const condValue = conditionValueFromRule(rule);

      tx.moveCall({
        target: target(pkg, "add_rule"),
        arguments: [
          tx.object(trustObjectId),
          tx.pure.u8(ruleType),
          tx.pure.address(beneficiaryAddress),
          tx.pure.u64(amount),
          tx.pure.bool(rule.isPercentage),
          tx.pure.u64(condValue),
          tx.pure.string(rule.conditionDescription),
        ],
      });
    }

    // Walrus document reference
    if (params.walrusBlobId) {
      tx.moveCall({
        target: target(pkg, "add_walrus_ref"),
        arguments: [
          tx.object(trustObjectId),
          tx.pure.string(params.walrusBlobId),
        ],
      });
    }

    return tx;
  }

  return { createTx, setupTx };
}
