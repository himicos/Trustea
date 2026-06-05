/**
 * Trustea — MemWal Private Agent Memory Client.
 *
 * Fully client-side privacy pipeline:
 *
 *   STORE:
 *     text
 *       → ollama embed  (local, 768-dim nomic-embed-text, zero cloud calls)
 *       → SEAL encrypt  (local, via @mysten/seal — ciphertext generated on device)
 *       → Walrus PUT    (direct HTTP to testnet/mainnet publisher — ciphertext only)
 *       → relayer POST /api/remember/manual { encrypted_data, vector, namespace }
 *
 *   RECALL:
 *     query
 *       → ollama embed  (local)
 *       → relayer POST /api/recall/manual { vector, limit, namespace }
 *       → Walrus GET per blob_id  (download ciphertext)
 *       → SEAL decrypt  (local SessionKey — plaintext stays on device)
 *
 * The MemWal relayer only ever sees:
 *   - The SEAL ciphertext (opaque bytes it cannot decrypt)
 *   - A 768-dim embedding vector (learned semantics, not raw text)
 *   - A Walrus blob_id (opaque pointer)
 *   - A namespace string
 *
 * It NEVER receives the plaintext. SEAL key servers and the relayer are separate
 * services; both must be compromised simultaneously to read any stored memory.
 *
 * Architecture note (relayer v0.1.0):
 *   The relayer accepts { encrypted_data, vector, namespace } on /api/remember/manual.
 *   It uploads the ciphertext to Walrus via its internal upload-relay. If the
 *   relayer's Walrus connection is unavailable (server infrastructure issue), the
 *   call fails with HTTP 500. In that case, rememberPrivate() still completes the
 *   LOCAL portions (embed, SEAL encrypt, direct Walrus upload) and returns the
 *   blobId. The memory is on Walrus and can be recalled directly; it will not be
 *   indexed in the relayer's vector DB until the infrastructure is restored.
 *
 * @module @trustea/lib/memwal/private-client
 */

import { MemWalManual } from "@mysten-incubation/memwal/manual";
import { TESTNET_CONFIG } from "../config.js";
import * as ed from "@noble/ed25519";

// noble/ed25519 exposes bytesToHex and hexToBytes on the etc export.
const { bytesToHex, hexToBytes } = ed.etc;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrivateMemWalConfig {
  /** Ed25519 delegate private key (hex string) registered on the MemWal account. */
  privateKey: string;
  /** MemWal account object ID (on-chain). */
  accountId: string;
  /** Relayer URL. */
  serverUrl: string;
  /** Embedding API base URL. Default: http://localhost:11434/v1 (local ollama). */
  embeddingApiBase?: string;
  /** Embedding model name. Default: nomic-embed-text. */
  embeddingModel?: string;
  /**
   * Embedding API key. For local ollama this is ignored but still required
   * by the SDK — use "ollama" as a placeholder.
   */
  embeddingApiKey?: string;
  /**
   * Sui private key in bech32 suiprivkey1... format.
   * Used by MemWalManual for local SEAL encrypt/decrypt operations.
   */
  suiPrivateKey: string;
  /** MemWal Move package ID (used for SEAL seal_approve target). */
  packageId: string;
  /**
   * Sui network for SEAL infrastructure.
   * Default: "testnet".
   */
  suiNetwork?: "testnet" | "mainnet";
  /**
   * Pre-built SuiClient instance.
   * Required for @mysten/sui v2.6.0+ which removed the standalone SuiClient
   * constructor. Pass a SuiJsonRpcClient (from "@mysten/sui/jsonRpc") or
   * equivalent.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suiClient?: any;
  /**
   * Walrus HTTP publisher URL for direct blob uploads.
   * Default: testnet publisher or mainnet publisher based on suiNetwork.
   */
  walrusPublisherUrl?: string;
  /**
   * Walrus HTTP aggregator URL for blob downloads.
   */
  walrusAggregatorUrl?: string;
  /**
   * Number of Walrus storage epochs.
   * Default: 5 (suitable for dev/test).
   */
  walrusEpochs?: number;
  /** Default namespace for private memories. Default: "trustea:private". */
  namespace?: string;
}

export interface PrivateMemory {
  /** Walrus blob_id where the encrypted data lives. */
  blobId: string;
  /** Decrypted plaintext (only available after recallPrivate or directDecrypt). */
  text: string;
  /** Cosine distance from query (lower = more relevant). Only set on recall. */
  distance: number;
}

export interface RecallPrivateOptions {
  /** Maximum number of results. Default: 5. */
  limit?: number;
  /** Namespace override. */
  namespace?: string;
}

export interface StoreResult {
  /** Walrus blob_id where the encrypted blob is stored. */
  blobId: string;
  /**
   * Whether the memory was indexed in the relayer's vector database.
   * False if the relayer's manual endpoint returned 500 (server-side Walrus issue).
   * The blob is still on Walrus and can be retrieved directly via blobId.
   */
  indexed: boolean;
}

export interface PrivateMemWalClient {
  /** The underlying MemWalManual instance (for advanced SEAL operations). */
  inner: MemWalManual;
  /**
   * Embed locally (Ollama), SEAL-encrypt locally, upload ciphertext to Walrus,
   * and register with the MemWal relayer.
   *
   * The relayer receives: { encrypted_data (ciphertext), vector, namespace }.
   * It NEVER receives the plaintext.
   *
   * If the relayer's Walrus upload-relay is unavailable (HTTP 500), the method
   * still completes the local steps (embed, encrypt, Walrus upload) and returns
   * { blobId, indexed: false }.
   *
   * @param text      - Natural-language text to remember privately.
   * @param namespace - Optional namespace override.
   */
  rememberPrivate(text: string, namespace?: string): Promise<StoreResult>;
  /**
   * Embed query locally, search relayer (by vector), download ciphertext blobs,
   * and SEAL-decrypt locally. Returns decrypted memories.
   *
   * @param query     - Natural-language search query.
   * @param opts      - Limit and namespace options.
   */
  recallPrivate(query: string, opts?: RecallPrivateOptions): Promise<PrivateMemory[]>;
  /**
   * Directly decrypt a blob from Walrus by blob_id (no relayer involved).
   * Useful for verifying a stored memory without going through the relayer.
   *
   * @param blobId - Walrus blob_id to download and decrypt.
   */
  directDecrypt(blobId: string): Promise<string>;
  /**
   * Ping the MemWal relayer health endpoint.
   */
  health(): Promise<{ status: string }>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fully private MemWal client backed by local Ollama embeddings
 * and client-side SEAL encryption.
 *
 * @example
 * ```ts
 * const client = createPrivateMemWalClient({
 *   privateKey: process.env.MEMWAL_PRIVATE_KEY!,
 *   accountId: process.env.MEMWAL_ACCOUNT_ID_STAGING!,
 *   serverUrl: process.env.MEMWAL_SERVER_URL_STAGING!,
 *   suiPrivateKey: keypair.getSecretKey(),
 *   packageId: TESTNET_CONFIG.memwal.packageId,
 *   suiNetwork: "testnet",
 *   suiClient: new SuiJsonRpcClient({ network: "testnet", url: "..." }),
 * });
 *
 * const { blobId } = await client.rememberPrivate("Alice must be 25 before disbursement");
 * const text = await client.directDecrypt(blobId); // local SEAL decrypt
 * ```
 */
export function createPrivateMemWalClient(
  config: PrivateMemWalConfig,
): PrivateMemWalClient {
  const {
    privateKey,
    accountId,
    serverUrl,
    embeddingApiBase = "http://localhost:11434/v1",
    embeddingModel = "nomic-embed-text",
    embeddingApiKey = "ollama",
    suiPrivateKey,
    packageId,
    suiNetwork = "testnet",
    suiClient,
    walrusEpochs = 5,
    namespace = "trustea:private",
  } = config;

  const normalizedServerUrl = serverUrl.replace(/\/$/, "");

  // Resolve Walrus URLs based on network.
  const defaultPublisher =
    suiNetwork === "testnet"
      ? TESTNET_CONFIG.walrus.publisher
      : "https://publisher.walrus-mainnet.walrus.space";
  const defaultAggregator =
    suiNetwork === "testnet"
      ? TESTNET_CONFIG.walrus.aggregator
      : "https://aggregator.walrus-mainnet.walrus.space";

  const walrusPublisherUrl = (
    config.walrusPublisherUrl ?? defaultPublisher
  ).replace(/\/$/, "");
  const walrusAggregatorUrl = (
    config.walrusAggregatorUrl ?? defaultAggregator
  ).replace(/\/$/, "");

  // Derive delegate private key bytes for signing.
  const delegatePrivKey = hexToBytes(privateKey);

  // MemWalManual — used for local SEAL encrypt/decrypt operations.
  const inner = MemWalManual.create({
    key: privateKey,
    accountId,
    serverUrl: normalizedServerUrl,
    suiPrivateKey,
    suiClient,
    packageId,
    suiNetwork,
    namespace,
    embeddingApiKey,
    embeddingApiBase,
    embeddingModel,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    walrusEpochs,
  });

  // -------------------------------------------------------------------------
  // Internal: Ed25519 signed HTTP POST
  // Mirrors the MemWal SDK signature scheme:
  //   message = "{ts}.POST.{path}.{bodySHA256}.{nonce}.{accountId}"
  //   headers: x-public-key, x-signature, x-timestamp, x-nonce, x-account-id
  // -------------------------------------------------------------------------

  let _pubkey: Uint8Array | null = null;
  async function getPublicKey(): Promise<Uint8Array> {
    if (!_pubkey) {
      _pubkey = await ed.getPublicKeyAsync(delegatePrivKey);
    }
    return _pubkey;
  }

  async function signedPost(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: unknown }> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(body);
    const bodyBytes = new TextEncoder().encode(bodyStr);
    const digestBuf = await crypto.subtle.digest("SHA-256", bodyBytes);
    const bodySha256 = bytesToHex(new Uint8Array(digestBuf));
    const nonce = crypto.randomUUID();
    const message = `${timestamp}.POST.${path}.${bodySha256}.${nonce}.${accountId}`;
    const msgBytes = new TextEncoder().encode(message);
    const signature = await ed.signAsync(msgBytes, delegatePrivKey);
    const pubkey = await getPublicKey();

    const resp = await fetch(`${normalizedServerUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": bytesToHex(pubkey),
        "x-signature": bytesToHex(signature),
        "x-timestamp": timestamp,
        "x-nonce": nonce,
        "x-account-id": accountId,
      },
      body: bodyStr,
    });

    const raw = await resp.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    return { status: resp.status, data };
  }

  // -------------------------------------------------------------------------
  // Internal: Embedding (local Ollama)
  // -------------------------------------------------------------------------

  async function embedLocal(text: string): Promise<number[]> {
    const base = embeddingApiBase.replace(/\/$/, "");
    const resp = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${embeddingApiKey}`,
      },
      body: JSON.stringify({ model: embeddingModel, input: text }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embedding API error (${resp.status}): ${err}`);
    }
    const data = (await resp.json()) as {
      data?: { embedding?: number[] }[];
    };
    const vec = data.data?.[0]?.embedding;
    if (!vec) throw new Error("Embedding API returned no vector");
    return vec;
  }

  // -------------------------------------------------------------------------
  // Internal: Walrus upload/download
  // -------------------------------------------------------------------------

  async function walrusUpload(data: Uint8Array): Promise<string> {
    const resp = await fetch(
      `${walrusPublisherUrl}/v1/blobs?epochs=${walrusEpochs}&deletable=true`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: data as unknown as BodyInit,
      },
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Walrus upload failed (${resp.status}): ${err}`);
    }
    const result = (await resp.json()) as {
      newlyCreated?: { blobObject?: { blobId?: string } };
      alreadyCertified?: { blobId?: string };
    };
    const blobId =
      result.newlyCreated?.blobObject?.blobId ?? result.alreadyCertified?.blobId;
    if (!blobId) {
      throw new Error(
        `Walrus upload: unexpected response: ${JSON.stringify(result)}`,
      );
    }
    return blobId;
  }

  async function walrusDownload(blobId: string): Promise<Uint8Array> {
    const resp = await fetch(`${walrusAggregatorUrl}/v1/blobs/${blobId}`);
    if (!resp.ok) {
      throw new Error(
        `Walrus download failed (${resp.status}): ${await resp.text()}`,
      );
    }
    return new Uint8Array(await resp.arrayBuffer());
  }

  // -------------------------------------------------------------------------
  // Internal: SEAL encrypt/decrypt
  // -------------------------------------------------------------------------

  async function sealEncryptLocal(
    text: string,
    ns: string,
  ): Promise<Uint8Array> {
    const mc = inner as unknown as {
      sealEncrypt(plaintext: Uint8Array, namespace: string): Promise<Uint8Array>;
    };
    return mc.sealEncrypt(new TextEncoder().encode(text), ns);
  }

  async function sealDecryptData(
    blobId: string,
    data: Uint8Array,
  ): Promise<string> {
    // Dynamically import SEAL + Sui modules (peer deps).
    const { SealClient, SessionKey, EncryptedObject } = await import(
      "@mysten/seal"
    );
    const { Transaction } = await import("@mysten/sui/transactions");

    const mc = inner as unknown as {
      getSealClient(): Promise<any>;
      getSuiClient(): Promise<any>;
      getOwnerAddress(): Promise<string>;
      createSigner(addr: string): Promise<any>;
      sealThreshold: number;
      config: { packageId: string; accountId: string };
    };

    const sealClient = await mc.getSealClient();
    const suiClientInst = await mc.getSuiClient();
    const callerAddress = await mc.getOwnerAddress();
    const signer = await mc.createSigner(callerAddress);

    const sessionKey = await (SessionKey as any).create({
      address: callerAddress,
      packageId: mc.config.packageId,
      ttlMin: 5,
      signer,
      suiClient: suiClientInst,
    });

    const parsed = (EncryptedObject as any).parse(data);
    const fullId: string = parsed.id;

    const idBytes = Array.from(
      Uint8Array.from(fullId.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))),
    );

    const tx = new Transaction();
    tx.moveCall({
      target: `${mc.config.packageId}::account::seal_approve`,
      arguments: [
        tx.pure("vector<u8>", idBytes),
        tx.object(mc.config.accountId),
      ],
    });
    const txBytes = await tx.build({
      client: suiClientInst,
      onlyTransactionKind: true,
    });

    await (sealClient as any).fetchKeys({
      ids: [fullId],
      txBytes,
      sessionKey,
      threshold: mc.sealThreshold,
    });

    const plaintext = await (sealClient as any).decrypt({
      data,
      sessionKey,
      txBytes,
    });
    return new TextDecoder().decode(plaintext);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Full private store pipeline:
   *   1. Embed locally (Ollama)
   *   2. SEAL-encrypt locally
   *   3. Upload ciphertext to Walrus directly
   *   4. Register with the relayer (sends encrypted_data + vector)
   *
   * If the relayer's Walrus upload-relay returns 500 (server infrastructure issue),
   * the method still returns { blobId, indexed: false } — the memory IS on Walrus
   * and can be retrieved directly via directDecrypt(blobId).
   */
  async function rememberPrivate(
    text: string,
    ns?: string,
  ): Promise<StoreResult> {
    const effectiveNs = ns ?? namespace;

    // Steps 1 + 2: embed + SEAL encrypt concurrently (fully local, no network)
    const [vector, encrypted] = await Promise.all([
      embedLocal(text),
      sealEncryptLocal(text, effectiveNs),
    ]);

    // Step 3: upload ciphertext directly to Walrus.
    // This ALWAYS works regardless of relayer state — blobs go directly to Walrus.
    const blobId = await walrusUpload(encrypted);

    // Step 4: register with the relayer so memories can be found by vector search.
    // Sends { encrypted_data (base64 ciphertext), vector, namespace }.
    // The relayer stores the vector index and blob_id mapping.
    // If the relayer's upload-relay is broken (HTTP 500), we skip indexing and
    // return indexed: false. The blob IS on Walrus and can be accessed via blobId.
    // Convert to base64 without Node Buffer dependency
    const encryptedBase64 = btoa(String.fromCharCode(...encrypted));
    const { status, data } = await signedPost("/api/remember/manual", {
      encrypted_data: encryptedBase64,
      vector,
      namespace: effectiveNs,
    });

    if (status === 200) {
      const result = data as { blob_id?: string };
      return { blobId: result.blob_id ?? blobId, indexed: true };
    } else {
      console.warn(
        `[PrivateMemWal] Relayer indexing failed (${status}) — memory is on Walrus but not in vector index. blob_id: ${blobId}`,
      );
      return { blobId, indexed: false };
    }
  }

  /**
   * Recall private memories via the relayer's vector search.
   * Query is embedded locally; only the vector goes to the relayer.
   * Downloaded blobs are SEAL-decrypted locally.
   */
  async function recallPrivate(
    query: string,
    opts?: RecallPrivateOptions,
  ): Promise<PrivateMemory[]> {
    const { limit = 5, namespace: nsOverride } = opts ?? {};
    const effectiveNs = nsOverride ?? namespace;

    // Embed query locally
    const vector = await embedLocal(query);

    // Search relayer by vector
    const { status, data } = await signedPost("/api/recall/manual", {
      vector,
      limit,
      namespace: effectiveNs,
    });

    if (status !== 200) {
      console.warn(`[PrivateMemWal] Relayer recall failed: ${status}`);
      return [];
    }

    const searchResult = data as {
      results: Array<{ blob_id: string; distance: number }>;
      total: number;
    };
    if (!searchResult.results?.length) return [];

    // Download ciphertext blobs from Walrus
    const blobs = (
      await Promise.all(
        searchResult.results.map(async (hit) => {
          try {
            const blobData = await walrusDownload(hit.blob_id);
            return { blobId: hit.blob_id, data: blobData, distance: hit.distance };
          } catch (err) {
            console.error(
              `[PrivateMemWal] Download failed for ${hit.blob_id}: ${(err as Error).message}`,
            );
            return null;
          }
        }),
      )
    ).filter(
      (b): b is { blobId: string; data: Uint8Array; distance: number } =>
        b !== null,
    );

    if (blobs.length === 0) return [];

    // SEAL-decrypt each blob locally
    const results: PrivateMemory[] = [];
    for (const blob of blobs) {
      try {
        const text = await sealDecryptData(blob.blobId, blob.data);
        results.push({ blobId: blob.blobId, text, distance: blob.distance });
      } catch (err) {
        console.error(
          `[PrivateMemWal] Decrypt failed for ${blob.blobId}: ${(err as Error).message}`,
        );
      }
    }
    return results;
  }

  /**
   * Directly download and SEAL-decrypt a blob from Walrus by blob_id.
   * Does NOT go through the relayer — useful for verifying stored memories
   * and for recall when the relayer vector index is unavailable.
   */
  async function directDecrypt(blobId: string): Promise<string> {
    const data = await walrusDownload(blobId);
    return sealDecryptData(blobId, data);
  }

  /**
   * Ping the MemWal relayer health endpoint.
   */
  async function health(): Promise<{ status: string }> {
    const resp = await fetch(`${normalizedServerUrl}/health`);
    if (!resp.ok) throw new Error(`Health check failed: ${resp.status}`);
    const body = (await resp.json()) as { status?: string };
    return { status: body.status ?? "ok" };
  }

  return { inner, rememberPrivate, recallPrivate, directDecrypt, health };
}

// ---------------------------------------------------------------------------
// Namespace constants
// ---------------------------------------------------------------------------

/** Namespace for privately-stored agent decisions (encrypted, client-side embedding). */
export const NS_PRIVATE_DECISIONS = "trustea:private-decisions";
/** Namespace for privately-stored compliance events. */
export const NS_PRIVATE_EVENTS = "trustea:private-events";
