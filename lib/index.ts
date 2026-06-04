/**
 * @trustea/lib — Walrus + Seal integration layer for Trustea.
 *
 * Re-exports all public interfaces, factory functions, and constants.
 *
 * Quick-start:
 * ```ts
 * import {
 *   createWalrusClient,
 *   createSealClient,
 *   createMemWalClient,
 *   encryptAndStore,
 *   fetchAndDecrypt,
 *   TESTNET_CONFIG,
 * } from "@trustea/lib";
 *
 * const walrus = createWalrusClient("testnet");
 * const seal   = createSealClient(suiClient, "testnet");
 * const memwal = createMemWalClient({ privateKey, accountId });
 *
 * const { blobId } = await encryptAndStore({
 *   data, trustObjectId, packageId, sealClient: seal, walrusClient: walrus,
 * });
 * ```
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export {
  TESTNET_CONFIG,
  MAINNET_CONFIG,
  getConfig,
} from "./config.js";
export type {
  TrusteaConfig,
  SuiConfig,
  WalrusConfig,
  SealConfig,
  MemWalConfig,
} from "./config.js";

// ---------------------------------------------------------------------------
// Walrus
// ---------------------------------------------------------------------------
export { createWalrusClient } from "./walrus/client.js";
export type {
  TrusteaWalrusClient,
  WalrusBlobInfo,
} from "./walrus/client.js";

// ---------------------------------------------------------------------------
// Seal
// ---------------------------------------------------------------------------
export { createSealClient, createSessionKey } from "./seal/client.js";
export type {
  TrusteaSealClient,
  SealApproveConstructor,
  SessionKey,
} from "./seal/client.js";

export {
  encryptAndStore,
  fetchAndDecrypt,
  batchEncryptAndStore,
} from "./seal/encrypt-store.js";
export type {
  EncryptAndStoreParams,
  EncryptAndStoreResult,
  FetchAndDecryptParams,
  BatchEncryptAndStoreResult,
} from "./seal/encrypt-store.js";

// ---------------------------------------------------------------------------
// Trust reader (on-chain object fetcher/parser)
// ---------------------------------------------------------------------------
export {
  fetchTrust,
  fetchPendingDistributions,
  fetchPendingDistribution,
  fetchBeneficiaryNFTs,
  fetchTrustsCreatedBy,
  fetchAgentActivity,
  trustStatusLabel,
  TRUSTEA_PACKAGE_ID,
} from "./trust-reader.js";
export type {
  TrustState,
  RuleState,
  PendingDistributionState,
  AgentActivityEntry,
} from "./trust-reader.js";

// ---------------------------------------------------------------------------
// MemWal
// ---------------------------------------------------------------------------
export {
  createMemWalClient,
  NS_DECISIONS,
  NS_EVENTS,
  NS_COMMS,
} from "./memwal/client.js";
export type {
  TrusteaMemWalClient,
  MemWalClientConfig,
  RecalledMemory,
} from "./memwal/client.js";

// ---------------------------------------------------------------------------
// Helpers (formatting, progress, stats)
// ---------------------------------------------------------------------------
export {
  formatSui,
  formatUsd,
  formatAddress,
  formatRelativeTime,
  formatDate,
  computeMilestoneProgress,
  computeVetoCountdown,
  computeDashboardStats,
  createDocumentManifest,
  serializeManifest,
  deserializeManifest,
} from "./helpers.js";
export type {
  MilestoneProgress,
  VetoCountdown,
  DashboardStats,
  TrustDocumentManifest,
  TrustDocumentEntry,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------
export {
  buildCreateTrustTx,
  buildDepositTx,
  buildAddBeneficiaryTx,
  buildRemoveBeneficiaryTx,
  buildAddRuleTx,
  buildAddRuleFromTranslation,
  buildProposeDistributionTx,
  buildExecuteDistributionTx,
  buildCancelDistributionTx,
  buildAddWalrusRefTx,
  buildPauseTrustTx,
  buildResumeTrustTx,
  buildCloseTrustTx,
  buildAmendTrustTx,
  buildFullDeployTxs,
  RULE_TYPE_AGE,
  RULE_TYPE_TIME,
  RULE_TYPE_CREDENTIAL,
  RULE_TYPE_PERIODIC,
} from "./transactions.js";
export type {
  TrustRule,
  DeployBeneficiary,
  FullDeployParams,
} from "./transactions.js";
