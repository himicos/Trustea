/**
 * Trustea — Walrus storage client wrapper.
 *
 * Provides typed helpers to store and retrieve encrypted blobs on Walrus.
 * For server-side / Node.js usage call storeDocument / readDocument directly.
 * For browser usage the same functions work via the Walrus REST publisher /
 * aggregator endpoints.
 *
 * @module @trustea/lib/walrus
 */

import { TESTNET_CONFIG, MAINNET_CONFIG, type TrusteaConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response returned by the Walrus publisher REST API on a successful PUT. */
export interface WalrusBlobInfo {
  blobId: string;
  endEpoch: number;
  /** Sui object ID of the blob registration transaction */
  suiRef?: string;
  status: "newlyCreated" | "alreadyCertified";
}

/** Internal raw response from the publisher (may contain either variant). */
interface WalrusPublisherResponse {
  newlyCreated?: {
    blobObject: {
      blobId: string;
      storage: { endEpoch: number };
      id: string;
    };
  };
  alreadyCertified?: {
    blobId: string;
    endEpoch: number;
    event: { txDigest: string };
  };
}

export interface TrusteaWalrusClient {
  /** Walrus publisher REST base URL */
  publisherUrl: string;
  /** Walrus aggregator REST base URL */
  aggregatorUrl: string;
  /** Default storage duration in epochs */
  defaultEpochs: number;
  /** Store a raw byte array as a Walrus blob; returns the blob ID. */
  storeDocument(data: Uint8Array, epochs?: number): Promise<{ blobId: string; info: WalrusBlobInfo }>;
  /** Read a blob by its Walrus blob ID. */
  readDocument(blobId: string): Promise<Uint8Array>;
  /** Upload multiple named documents to Walrus in parallel; returns a map of name → blobId. */
  storeTrustDocuments(
    files: { name: string; data: Uint8Array }[],
    epochs?: number,
  ): Promise<Map<string, string>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Walrus client configured for the given network.
 *
 * @example
 * ```ts
 * const walrus = createWalrusClient("testnet");
 * const { blobId } = await walrus.storeDocument(encryptedBytes);
 * ```
 */
export function createWalrusClient(
  network: "testnet" | "mainnet" = "testnet",
  overrides?: { publisherUrl?: string; aggregatorUrl?: string; defaultEpochs?: number },
): TrusteaWalrusClient {
  const cfg: TrusteaConfig = network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;

  const publisherUrl = overrides?.publisherUrl ?? cfg.walrus.publisher;
  const aggregatorUrl = overrides?.aggregatorUrl ?? cfg.walrus.aggregator;
  const defaultEpochs = overrides?.defaultEpochs ?? 1;

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * PUT encrypted bytes to the Walrus publisher REST endpoint.
   * Returns parsed blob metadata on success.
   */
  async function putBlob(data: Uint8Array, epochs: number): Promise<WalrusBlobInfo> {
    const url = `${publisherUrl}/v1/blobs?epochs=${epochs}`;
    const response = await fetch(url, {
      method: "PUT",
      body: data.slice(), // ensure we're sending a fresh copy
      headers: { "Content-Type": "application/octet-stream" },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(unreadable body)");
      throw new Error(
        `Walrus publisher returned ${response.status} for PUT /v1/blobs: ${text}`,
      );
    }

    const raw: WalrusPublisherResponse = await response.json();
    return parsePublisherResponse(raw);
  }

  /** Normalise the two possible publisher response shapes into WalrusBlobInfo. */
  function parsePublisherResponse(raw: WalrusPublisherResponse): WalrusBlobInfo {
    if (raw.newlyCreated) {
      const { blobObject } = raw.newlyCreated;
      return {
        status: "newlyCreated",
        blobId: blobObject.blobId,
        endEpoch: blobObject.storage.endEpoch,
        suiRef: blobObject.id,
      };
    }
    if (raw.alreadyCertified) {
      const { alreadyCertified } = raw;
      return {
        status: "alreadyCertified",
        blobId: alreadyCertified.blobId,
        endEpoch: alreadyCertified.endEpoch,
        suiRef: alreadyCertified.event.txDigest,
      };
    }
    throw new Error("Unrecognised Walrus publisher response shape");
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Store a raw byte array on Walrus.
   *
   * @param data   - The bytes to store (typically already Seal-encrypted).
   * @param epochs - Number of Walrus storage epochs (default: 1).
   * @returns Blob ID and metadata.
   */
  async function storeDocument(
    data: Uint8Array,
    epochs = defaultEpochs,
  ): Promise<{ blobId: string; info: WalrusBlobInfo }> {
    const info = await putBlob(data, epochs);
    return { blobId: info.blobId, info };
  }

  /**
   * Download a blob from Walrus by its ID.
   *
   * @param blobId - The Walrus blob ID to fetch.
   * @returns Raw bytes of the stored blob.
   */
  async function readDocument(blobId: string): Promise<Uint8Array> {
    const url = `${aggregatorUrl}/v1/blobs/${blobId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `Walrus aggregator returned ${response.status} for GET /v1/blobs/${blobId}`,
        );
      }
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Upload multiple named documents to Walrus in parallel.
   * Mirrors the Walrus "quilt" multi-upload pattern.
   *
   * @param files  - Array of { name, data } objects.
   * @param epochs - Storage duration in epochs (default: client default).
   * @returns Map of document name → blob ID.
   */
  async function storeTrustDocuments(
    files: { name: string; data: Uint8Array }[],
    epochs = defaultEpochs,
  ): Promise<Map<string, string>> {
    const results = await Promise.allSettled(
      files.map(async ({ name, data }) => {
        const { blobId } = await storeDocument(data, epochs);
        return { name, blobId } as const;
      }),
    );

    const blobMap = new Map<string, string>();
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        blobMap.set(result.value.name, result.value.blobId);
      } else {
        errors.push(String(result.reason));
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `storeTrustDocuments: ${errors.length} upload(s) failed:\n${errors.join("\n")}`,
      );
    }

    return blobMap;
  }

  return {
    publisherUrl,
    aggregatorUrl,
    defaultEpochs,
    storeDocument,
    readDocument,
    storeTrustDocuments,
  };
}
