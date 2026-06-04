/**
 * Trustea — MemWal agent memory client.
 *
 * Wraps @mysten-incubation/memwal to give the Trustea AI agent persistent,
 * semantic memory that lives on Walrus. All embeddings and encryption are
 * handled server-side by the MemWal relayer; this client only signs requests
 * with an Ed25519 delegate key.
 *
 * Agent decisions, trust events, and conversation summaries are stored as
 * distinct namespaces so recall queries stay focused.
 *
 * @module @trustea/lib/memwal
 */

import { MemWal } from "@mysten-incubation/memwal";
import { TESTNET_CONFIG } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemWalClientConfig {
  /** Ed25519 delegate private key (hex string) registered on the MemWal account. */
  privateKey: string;
  /** Walrus Memory account object ID (on-chain). */
  accountId: string;
  /**
   * Default namespace for memories.
   * Namespaces allow segmenting recall queries (e.g. "decisions" vs "events").
   * Default: "trustea-agent"
   */
  namespace?: string;
  /** Override the MemWal relayer URL (default: staging). */
  serverUrl?: string;
}

export interface RecalledMemory {
  text: string;
  /** Cosine distance from query (lower = more relevant). */
  distance: number;
}

export interface TrusteaMemWalClient {
  /** The underlying MemWal SDK instance (for advanced use). */
  inner: MemWal;
  /**
   * Store an agent decision and wait until it is durably committed to Walrus.
   *
   * @param decision  - Natural-language description of what the agent decided.
   * @param namespace - Optional namespace override (default: client namespace).
   */
  storeAgentDecision(decision: string, namespace?: string): Promise<{ blobId: string }>;
  /**
   * Recall memories semantically similar to `query`.
   *
   * @param query     - Natural-language query.
   * @param limit     - Maximum number of results (default: 5).
   * @param namespace - Optional namespace filter.
   */
  recallHistory(
    query: string,
    limit?: number,
    namespace?: string,
  ): Promise<RecalledMemory[]>;
  /**
   * Extract key facts from `text` and store each as a separate memory.
   * The relayer analyses the text, extracts atomic facts, and commits them.
   *
   * @param text      - Free-form text (e.g. a trust event summary, meeting notes).
   * @param namespace - Optional namespace override.
   */
  analyzeAndStore(text: string, namespace?: string): Promise<{ jobIds: string[] }>;
  /**
   * Check the MemWal relayer health endpoint.
   */
  health(): Promise<{ status: string }>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a MemWal client for the Trustea AI agent.
 *
 * The client uses the MemWal staging relayer by default (suitable for testnet
 * development). Override `config.serverUrl` for production.
 *
 * @example
 * ```ts
 * const memwal = createMemWalClient({
 *   privateKey: process.env.MEMWAL_PRIVATE_KEY!,
 *   accountId: process.env.MEMWAL_ACCOUNT_ID!,
 * });
 * await memwal.storeAgentDecision("Approved disbursement of 500 USDC to Alice");
 * const history = await memwal.recallHistory("disbursements", 5);
 * ```
 */
export function createMemWalClient(config: MemWalClientConfig): TrusteaMemWalClient {
  const {
    privateKey,
    accountId,
    namespace = "trustea-agent",
    serverUrl = TESTNET_CONFIG.memwal.serverUrl,
  } = config;

  const inner = MemWal.create({
    key: privateKey,
    accountId,
    serverUrl,
    namespace,
  });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Store an agent decision and block until Walrus confirms durability.
   */
  async function storeAgentDecision(
    decision: string,
    ns?: string,
  ): Promise<{ blobId: string }> {
    // rememberAndWait blocks until the job reaches the "done" terminal state,
    // giving us a stable blob_id for cross-referencing in logs.
    const result = await inner.rememberAndWait(decision, ns ?? namespace);
    return { blobId: result.blob_id };
  }

  /**
   * Recall memories semantically similar to `query`.
   *
   * A `maxDistance` filter of 0.8 is applied to drop low-relevance results.
   * Adjust this threshold if recall feels too narrow or too broad.
   */
  async function recallHistory(
    query: string,
    limit = 5,
    ns?: string,
  ): Promise<RecalledMemory[]> {
    const result = await inner.recall({
      query,
      limit,
      namespace: ns ?? namespace,
      // Filter out semantically distant memories (cosine distance ≥ 0.8)
      maxDistance: 0.8,
    });

    return result.results.map((m) => ({
      text: m.text,
      distance: m.distance,
    }));
  }

  /**
   * Extract facts from `text` and commit each atomically to MemWal.
   * Returns immediately after the relayer accepts the analysis job.
   */
  async function analyzeAndStore(
    text: string,
    ns?: string,
  ): Promise<{ jobIds: string[] }> {
    const result = await inner.analyze(text, ns ?? namespace);
    return { jobIds: result.job_ids };
  }

  /**
   * Ping the MemWal relayer health endpoint.
   */
  async function health(): Promise<{ status: string }> {
    const result = await inner.health();
    // The HealthResult type has a `status` field.
    return { status: (result as unknown as { status: string }).status ?? "ok" };
  }

  return {
    inner,
    storeAgentDecision,
    recallHistory,
    analyzeAndStore,
    health,
  };
}

// ---------------------------------------------------------------------------
// Namespace constants — use these for consistent segmentation across the app
// ---------------------------------------------------------------------------

/** Default namespace for agent decision logs. */
export const NS_DECISIONS = "trustea-decisions";
/** Namespace for trust lifecycle events (creation, amendments, distributions). */
export const NS_EVENTS = "trustea-events";
/** Namespace for beneficiary communication summaries. */
export const NS_COMMS = "trustea-comms";
