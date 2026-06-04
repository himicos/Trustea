/**
 * Trustea — on-chain Trust object reader.
 *
 * Fetches and parses Trust, PendingDistribution, and BeneficiaryNFT objects
 * from the Sui blockchain into strongly-typed TypeScript interfaces.
 *
 * Usage:
 * ```ts
 * import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
 * import { fetchTrust, trustStatusLabel } from "@trustea/lib/trust-reader";
 *
 * const suiClient = new SuiJsonRpcClient({ url: TESTNET_CONFIG.sui.rpcUrl });
 * const trust = await fetchTrust(suiClient, "<trustObjectId>");
 * console.log(trustStatusLabel(trust.status)); // "active"
 * ```
 *
 * @module @trustea/lib/trust-reader
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

// ---------------------------------------------------------------------------
// Package constants
// ---------------------------------------------------------------------------

/** Trustea Move package ID (testnet). */
export const TRUSTEA_PACKAGE_ID =
  "0x6dd9f544633cc3dd119f045aa45711d1bc90158cf2059aa1bbba2967697d7079";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Parsed representation of a single distribution Rule stored inside a Trust.
 * Field names mirror the Move struct but are camelCased.
 */
export interface RuleState {
  /** 0 = age, 1 = time, 2 = credential, 3 = periodic */
  ruleType: number;
  /** Beneficiary address this rule applies to. */
  beneficiary: string;
  /**
   * Amount in MIST, or percentage × 100 (e.g. 5000 = 50%) when isPercentage
   * is true.
   */
  amount: bigint;
  /** Whether `amount` is a percentage of the trust balance. */
  isPercentage: boolean;
  /**
   * For age/time rules: unlock timestamp (ms).
   * For periodic rules: period in ms between allowed payments.
   */
  conditionValue: bigint;
  /** Human-readable description of the rule's intent. */
  description: string;
  /** Whether this rule is currently active. */
  isActive: boolean;
}

/**
 * Parsed representation of the on-chain Trust shared object.
 */
export interface TrustState {
  /** Sui object ID of the Trust shared object. */
  id: string;
  /** Human-readable trust name. */
  name: string;
  /** Description of the trust's purpose. */
  description: string;
  /** Address of the grantor who created the trust. */
  grantor: string;
  /** SUI balance held by the trust, in MIST. */
  balance: bigint;
  /** Ordered list of beneficiary addresses. */
  beneficiaries: string[];
  /** Distribution rules attached to this trust. */
  rules: RuleState[];
  /** 0 = ACTIVE, 1 = PAUSED, 2 = CLOSED */
  status: number;
  /** Walrus blob IDs referencing encrypted trust documents. */
  walrusBlobIds: string[];
  /** Timestamp (ms) when this trust was created. */
  createdAt: number;
  /** Address of the AI agent authorised to propose distributions. */
  agentAddress: string;
}

/**
 * Parsed representation of a PendingDistribution shared object.
 */
export interface PendingDistributionState {
  /** Sui object ID of the PendingDistribution. */
  id: string;
  /** Object ID of the parent Trust. */
  trustId: string;
  /** Rule index that triggered this proposal. */
  ruleIndex: number;
  /** Destination beneficiary address. */
  beneficiary: string;
  /** Amount to distribute in MIST. */
  amount: bigint;
  /** Reason / description provided by the agent. */
  reason: string;
  /** Timestamp (ms) when this proposal was created. */
  proposedAt: number;
  /** Earliest timestamp (ms) at which this can be executed. */
  executableAfter: number;
  /** True if the grantor has cancelled this proposal. */
  isCancelled: boolean;
  /** True if this proposal has already been executed. */
  isExecuted: boolean;
}

// ---------------------------------------------------------------------------
// Internal Move field shapes (raw JSON from the JSON-RPC response)
//
// On-chain Move structs are returned with snake_case field names.
// Numeric values may be strings (u64 overflow protection) or numbers.
// ---------------------------------------------------------------------------

interface MoveRuleFields {
  rule_type: number | string;
  beneficiary: string;
  amount: number | string;
  is_percentage: boolean;
  condition_value: number | string;
  description: string;
  is_active: boolean;
}

interface MoveTrustFields {
  id: { id: string };
  name: string;
  description: string;
  grantor: string;
  /** Balance<SUI> is serialised as { fields: { value: string } } by the RPC. */
  balance: { fields: { value: number | string } } | { value: number | string } | number | string;
  beneficiaries: string[];
  /** Each rule is wrapped in an extra { fields: ... } envelope by the RPC. */
  rules: Array<{ fields: MoveRuleFields } | MoveRuleFields>;
  status: number | string;
  walrus_blob_ids: string[];
  created_at: number | string;
  agent_address: string;
}

interface MovePendingDistributionFields {
  id: { id: string };
  trust_id: string;
  rule_index: number | string;
  beneficiary: string;
  amount: number | string;
  reason: string;
  proposed_at: number | string;
  executable_after: number | string;
  is_cancelled: boolean;
  is_executed: boolean;
}

// ---------------------------------------------------------------------------
// Tiny field coercion helpers
// ---------------------------------------------------------------------------

/** Convert an RPC number-or-string field to bigint. */
function toBigInt(value: number | string | bigint | null | undefined): bigint {
  if (value == null) return 0n;
  return BigInt(value);
}

/** Convert an RPC number-or-string field to number. */
function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

/**
 * Extract the MIST value from a Sui Balance<SUI> field.
 *
 * The JSON-RPC typically returns Balance<SUI> as:
 *   { fields: { value: "1000000000" } }
 *
 * But some RPC versions may inline the number directly.
 */
function parseBalance(
  raw: { fields: { value: number | string } } | { value: number | string } | number | string | null | undefined,
): bigint {
  if (raw == null) return 0n;
  if (typeof raw === "number" || typeof raw === "string") return toBigInt(raw);
  if ("fields" in raw && raw.fields != null && "value" in raw.fields) {
    return toBigInt(raw.fields.value);
  }
  if ("value" in raw) {
    return toBigInt((raw as { value: number | string }).value);
  }
  return 0n;
}

/**
 * Parse a single Rule Move struct from its RPC representation.
 * The RPC may wrap struct fields in an extra `{ fields: ... }` envelope.
 */
function parseRule(raw: { fields: MoveRuleFields } | MoveRuleFields): RuleState {
  const f: MoveRuleFields = "fields" in raw && typeof raw.fields === "object"
    ? raw.fields
    : (raw as MoveRuleFields);

  return {
    ruleType: toNumber(f.rule_type),
    beneficiary: f.beneficiary ?? "",
    amount: toBigInt(f.amount),
    isPercentage: Boolean(f.is_percentage),
    conditionValue: toBigInt(f.condition_value),
    description: f.description ?? "",
    isActive: Boolean(f.is_active),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and parse a Trust shared object from the Sui blockchain.
 *
 * @param suiClient     - Initialised SuiJsonRpcClient.
 * @param trustObjectId - The Sui object ID of the Trust shared object.
 * @returns Parsed TrustState.
 * @throws If the object does not exist, is the wrong type, or cannot be parsed.
 */
export async function fetchTrust(
  suiClient: SuiJsonRpcClient,
  trustObjectId: string,
): Promise<TrustState> {
  const response = await suiClient.getObject({
    id: trustObjectId,
    options: { showContent: true },
  });

  if (!response.data) {
    throw new Error(
      `Trust object not found or inaccessible: ${trustObjectId}` +
      (response.error ? ` (${JSON.stringify(response.error)})` : ""),
    );
  }

  const content = response.data.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(
      `Object ${trustObjectId} is not a Move object (dataType: ${content?.dataType ?? "undefined"})`,
    );
  }

  // The RPC returns Move struct fields as a plain record.
  const fields = content.fields as unknown as MoveTrustFields;

  if (!fields || typeof fields !== "object") {
    throw new Error(`Unexpected fields shape for Trust object ${trustObjectId}`);
  }

  const rules: RuleState[] = Array.isArray(fields.rules)
    ? fields.rules.map((r) => parseRule(r))
    : [];

  return {
    id: trustObjectId,
    name: fields.name ?? "",
    description: fields.description ?? "",
    grantor: fields.grantor ?? "",
    balance: parseBalance(fields.balance),
    beneficiaries: Array.isArray(fields.beneficiaries) ? fields.beneficiaries : [],
    rules,
    status: toNumber(fields.status),
    walrusBlobIds: Array.isArray(fields.walrus_blob_ids) ? fields.walrus_blob_ids : [],
    createdAt: toNumber(fields.created_at),
    agentAddress: fields.agent_address ?? "",
  };
}

/**
 * Fetch and parse all distributions ever proposed for a given trust.
 *
 * Strategy:
 *   1. Query `DistributionProposed` Move events filtered by `MoveEventType`.
 *   2. Collect distinct `distribution_id` values from events matching the
 *      provided `trustObjectId`.
 *   3. Fetch each PendingDistribution object by its ID.
 *
 * Returns objects in all states (pending, cancelled, executed). Callers can
 * filter by `isCancelled` / `isExecuted` as needed.
 *
 * @param suiClient     - Initialised SuiJsonRpcClient.
 * @param trustObjectId - The Trust object ID to query distributions for.
 * @returns Array of parsed PendingDistributionState objects.
 */
export async function fetchPendingDistributions(
  suiClient: SuiJsonRpcClient,
  trustObjectId: string,
): Promise<PendingDistributionState[]> {
  const eventType = `${TRUSTEA_PACKAGE_ID}::trust::DistributionProposed`;

  const eventsResult = await suiClient.queryEvents({
    query: { MoveEventType: eventType },
    limit: 100,
  });

  // Collect distinct distribution IDs that belong to this trust.
  const distributionIds: string[] = [];
  const seen = new Set<string>();

  for (const event of eventsResult.data) {
    const parsedJson = event.parsedJson as
      | { trust_id?: string; distribution_id?: string }
      | undefined;

    if (
      parsedJson &&
      parsedJson.trust_id === trustObjectId &&
      parsedJson.distribution_id &&
      !seen.has(parsedJson.distribution_id)
    ) {
      seen.add(parsedJson.distribution_id);
      distributionIds.push(parsedJson.distribution_id);
    }
  }

  if (distributionIds.length === 0) {
    return [];
  }

  // Fetch each PendingDistribution object in parallel; skip any that fail.
  const settled = await Promise.allSettled(
    distributionIds.map((distId) => fetchPendingDistribution(suiClient, distId)),
  );

  const distributions: PendingDistributionState[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      distributions.push(result.value);
    }
    // Objects that have been deleted/wrapped are silently skipped.
  }

  return distributions;
}

/**
 * Fetch and parse a single PendingDistribution object.
 *
 * @param suiClient - Initialised SuiJsonRpcClient.
 * @param distId    - The Sui object ID of the PendingDistribution.
 * @returns Parsed PendingDistributionState.
 * @throws If the object does not exist or is the wrong type.
 */
export async function fetchPendingDistribution(
  suiClient: SuiJsonRpcClient,
  distId: string,
): Promise<PendingDistributionState> {
  const response = await suiClient.getObject({
    id: distId,
    options: { showContent: true },
  });

  if (!response.data) {
    throw new Error(
      `PendingDistribution object not found: ${distId}` +
      (response.error ? ` (${JSON.stringify(response.error)})` : ""),
    );
  }

  const content = response.data.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`Object ${distId} is not a Move object`);
  }

  const fields = content.fields as unknown as MovePendingDistributionFields;

  return {
    id: distId,
    trustId: fields.trust_id ?? "",
    ruleIndex: toNumber(fields.rule_index),
    beneficiary: fields.beneficiary ?? "",
    amount: toBigInt(fields.amount),
    reason: fields.reason ?? "",
    proposedAt: toNumber(fields.proposed_at),
    executableAfter: toNumber(fields.executable_after),
    isCancelled: Boolean(fields.is_cancelled),
    isExecuted: Boolean(fields.is_executed),
  };
}

/**
 * Fetch BeneficiaryNFT objects owned by a given address.
 *
 * Uses `getOwnedObjects` with a `StructType` filter on the BeneficiaryNFT
 * Move type. Returns a lightweight array with the object ID and raw Move
 * fields for each NFT found.
 *
 * @param suiClient          - Initialised SuiJsonRpcClient.
 * @param beneficiaryAddress - The wallet address to query.
 * @returns Array of `{ objectId, fields }` for each BeneficiaryNFT found.
 */
export async function fetchBeneficiaryNFTs(
  suiClient: SuiJsonRpcClient,
  beneficiaryAddress: string,
): Promise<Array<{ objectId: string; fields: Record<string, unknown> }>> {
  const nftType = `${TRUSTEA_PACKAGE_ID}::beneficiary_nft::BeneficiaryNFT`;

  const response = await suiClient.getOwnedObjects({
    owner: beneficiaryAddress,
    filter: { StructType: nftType },
    options: { showContent: true },
  });

  const nfts: Array<{ objectId: string; fields: Record<string, unknown> }> = [];

  for (const item of response.data) {
    if (!item.data) continue;

    const content = item.data.content;
    if (!content || content.dataType !== "moveObject") continue;

    nfts.push({
      objectId: item.data.objectId,
      fields: content.fields as Record<string, unknown>,
    });
  }

  return nfts;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Return a human-readable label for a Trust status code.
 *
 * @param status - On-chain status byte: 0 = active, 1 = paused, 2 = closed.
 * @returns "active" | "paused" | "closed"
 */
export function trustStatusLabel(status: number): "active" | "paused" | "closed" {
  switch (status) {
    case 0:
      return "active";
    case 1:
      return "paused";
    case 2:
      return "closed";
    default:
      return "active";
  }
}

// ---------------------------------------------------------------------------
// Fetch trusts created by an address (for grantor sidebar)
// ---------------------------------------------------------------------------

/**
 * Fetch all Trust object IDs created by a given grantor address.
 *
 * Queries `TrustCreated` events emitted by the Trustea contract and filters
 * by sender. Returns an array of { trustId, name, createdAt } for sidebar
 * rendering.
 *
 * @param suiClient - Connected SuiJsonRpcClient instance.
 * @param grantorAddress - The Sui address of the grantor.
 * @param packageId - Override Trustea package ID (default: testnet).
 */
export async function fetchTrustsCreatedBy(
  suiClient: SuiJsonRpcClient,
  grantorAddress: string,
  packageId = TRUSTEA_PACKAGE_ID,
): Promise<{ trustId: string; name: string; createdAt: number }[]> {
  const events = await suiClient.queryEvents({
    query: {
      MoveEventType: `${packageId}::trust::TrustCreated`,
    },
    order: "descending",
    limit: 50,
  });

  const trusts: { trustId: string; name: string; createdAt: number }[] = [];

  for (const event of events.data) {
    const fields = event.parsedJson as Record<string, unknown> | undefined;
    if (!fields) continue;

    const grantor = String(fields.grantor ?? "");
    if (grantor !== grantorAddress) continue;

    trusts.push({
      trustId: String(fields.trust_id ?? ""),
      name: String(fields.name ?? ""),
      createdAt: Number(fields.created_at ?? 0),
    });
  }

  return trusts;
}
