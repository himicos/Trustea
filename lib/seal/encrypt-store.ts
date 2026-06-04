/**
 * Trustea — Combined encrypt-then-store pipeline.
 *
 * `encryptAndStore`:  Seal-encrypt data → upload to Walrus → return blobId.
 * `fetchAndDecrypt`:  Download from Walrus → Seal-decrypt → return plaintext.
 *
 * These are the primary entry points for all trust document persistence in
 * Trustea. Callers supply pre-built SealClient and WalrusClient instances
 * (see createSealClient / createWalrusClient) so that network choice,
 * configuration, and lifecycle management remain the caller's concern.
 *
 * @module @trustea/lib/seal/encrypt-store
 */

import { SuiJsonRpcClient as SuiClient } from "@mysten/sui/jsonRpc";
import { type TrusteaSealClient, type SessionKey } from "./client.js";
import { type TrusteaWalrusClient } from "../walrus/client.js";

// ---------------------------------------------------------------------------
// encryptAndStore
// ---------------------------------------------------------------------------

export interface EncryptAndStoreParams {
  /** Plaintext bytes to protect. */
  data: Uint8Array;
  /** On-chain Sui object ID of the trust that owns this document. */
  trustObjectId: string;
  /** Move package ID for the Trustea contract. */
  packageId: string;
  /** Pre-initialised Trustea Seal client. */
  sealClient: TrusteaSealClient;
  /** Pre-initialised Trustea Walrus client. */
  walrusClient: TrusteaWalrusClient;
  /** Storage duration in Walrus epochs (default: client default). */
  epochs?: number;
}

export interface EncryptAndStoreResult {
  /** Walrus blob ID for the stored encrypted document. */
  blobId: string;
  /** Byte length of the Seal-encrypted payload that was uploaded. */
  encryptedSize: number;
  /** The Seal encryption ID embedded in the ciphertext (useful for diagnostics). */
  sealId: string;
}

/**
 * Full Trustea data persistence pipeline:
 *   1. Seal-encrypt `data` scoped to `trustObjectId`.
 *   2. Upload the ciphertext to Walrus.
 *   3. Return the Walrus blob ID and metadata.
 *
 * @example
 * ```ts
 * const result = await encryptAndStore({
 *   data: new TextEncoder().encode(JSON.stringify(trustDocument)),
 *   trustObjectId: "0xabc...",
 *   packageId: TESTNET_CONFIG.seal.packageId,
 *   sealClient,
 *   walrusClient,
 * });
 * console.log("stored at blob:", result.blobId);
 * ```
 */
export async function encryptAndStore(
  params: EncryptAndStoreParams,
): Promise<EncryptAndStoreResult> {
  const { data, trustObjectId, packageId, sealClient, walrusClient, epochs } = params;

  // Step 1: Seal-encrypt
  const { encryptedData, id: sealId } = await sealClient.encryptForTrust(
    data,
    trustObjectId,
    packageId,
  );

  // Step 2: Upload to Walrus
  const { blobId } = await walrusClient.storeDocument(encryptedData, epochs);

  return {
    blobId,
    encryptedSize: encryptedData.byteLength,
    sealId,
  };
}

// ---------------------------------------------------------------------------
// fetchAndDecrypt
// ---------------------------------------------------------------------------

export interface FetchAndDecryptParams {
  /** Walrus blob ID of the encrypted document. */
  blobId: string;
  /** On-chain Sui object ID of the trust that owns this document. */
  trustObjectId: string;
  /** Move package ID for the Trustea contract. */
  packageId: string;
  /** Pre-initialised Trustea Seal client. */
  sealClient: TrusteaSealClient;
  /** An active, signed Seal session key for the calling address. */
  sessionKey: SessionKey;
  /** SuiClient used to build the seal_approve transaction. */
  suiClient: SuiClient;
  /** Pre-initialised Trustea Walrus client. */
  walrusClient: TrusteaWalrusClient;
  /**
   * Move module name containing seal_approve (default: "trust").
   * Override this if the trust contract uses a different module layout.
   */
  moduleName?: string;
}

/**
 * Full Trustea data retrieval pipeline (inverse of encryptAndStore):
 *   1. Download the encrypted blob from Walrus.
 *   2. Seal-decrypt it using the beneficiary's session key.
 *   3. Return plaintext bytes.
 *
 * Throws `NoAccessError` (wrapped as a plain Error with a descriptive message)
 * if the session key address is not an authorised beneficiary of the trust.
 *
 * @example
 * ```ts
 * const plaintext = await fetchAndDecrypt({
 *   blobId: "abc123...",
 *   trustObjectId: "0xabc...",
 *   packageId: TESTNET_CONFIG.seal.packageId,
 *   sealClient,
 *   sessionKey,
 *   suiClient,
 *   walrusClient,
 * });
 * const doc = JSON.parse(new TextDecoder().decode(plaintext));
 * ```
 */
export async function fetchAndDecrypt(
  params: FetchAndDecryptParams,
): Promise<Uint8Array> {
  const {
    blobId,
    trustObjectId,
    packageId,
    sealClient,
    sessionKey,
    suiClient,
    walrusClient,
    moduleName = "trust",
  } = params;

  // Step 1: Download encrypted blob from Walrus
  const encryptedData = await walrusClient.readDocument(blobId);

  // Step 2: Seal-decrypt
  const plaintext = await sealClient.decryptForBeneficiary(
    encryptedData,
    trustObjectId,
    sessionKey,
    suiClient,
    packageId,
    moduleName,
  );

  return plaintext;
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

export interface BatchEncryptAndStoreResult {
  name: string;
  blobId: string;
  encryptedSize: number;
  sealId: string;
}

/**
 * Encrypt and store multiple named documents for the same trust in parallel.
 * Useful when onboarding a new trust and uploading its founding documents.
 *
 * @param files          - Array of { name, data } document objects.
 * @param trustObjectId  - On-chain trust object ID (shared policy).
 * @param packageId      - Trustea Move package ID.
 * @param sealClient     - Pre-initialised Seal client.
 * @param walrusClient   - Pre-initialised Walrus client.
 * @param epochs         - Walrus storage epochs.
 * @returns Array of results in the same order as `files`.
 */
export async function batchEncryptAndStore(
  files: { name: string; data: Uint8Array }[],
  trustObjectId: string,
  packageId: string,
  sealClient: TrusteaSealClient,
  walrusClient: TrusteaWalrusClient,
  epochs?: number,
): Promise<BatchEncryptAndStoreResult[]> {
  const results = await Promise.allSettled(
    files.map(async ({ name, data }) => {
      const result = await encryptAndStore({
        data,
        trustObjectId,
        packageId,
        sealClient,
        walrusClient,
        epochs,
      });
      return { name, ...result } as BatchEncryptAndStoreResult;
    }),
  );

  const errors: string[] = [];
  const successful: BatchEncryptAndStoreResult[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      errors.push(String(result.reason));
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `batchEncryptAndStore: ${errors.length} file(s) failed:\n${errors.join("\n")}`,
    );
  }

  return successful;
}
