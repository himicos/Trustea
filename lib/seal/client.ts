/**
 * Trustea — Seal encryption client.
 *
 * Wraps @mysten/seal to provide trust-scoped encryption and decryption.
 * The encrypt flow:
 *   1. Generate a random 5-byte nonce.
 *   2. Concatenate trustObjectId bytes + nonce to form the Seal encryption ID.
 *   3. Call SealClient.encrypt({ threshold: 1, packageId, id, data }).
 *
 * The decrypt flow:
 *   1. Parse the EncryptedObject to extract the full ID.
 *   2. Build a Sui transaction that calls `<module>::seal_approve(id, trustObject)`.
 *   3. Call SealClient.fetchKeys() then SealClient.decrypt().
 *
 * @module @trustea/lib/seal
 */

import {
  SealClient,
  SessionKey,
  EncryptedObject,
  NoAccessError,
} from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";

import { TESTNET_CONFIG, MAINNET_CONFIG } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Re-export for convenience so callers only need to import from here. */
export type { SessionKey };

/**
 * A function that constructs the Move call for `seal_approve` on a transaction.
 * The Move signature is:
 *   `public fun seal_approve(id: vector<u8>, trust: &TrustObject, ctx: &TxContext)`
 */
export type SealApproveConstructor = (tx: Transaction, encryptedId: string) => void;

export interface TrusteaSealClient {
  /** The underlying @mysten/seal SealClient instance. */
  inner: SealClient;
  /** Encrypt raw bytes using the trust object's Seal policy. */
  encryptForTrust(
    data: Uint8Array,
    trustObjectId: string,
    packageId: string,
  ): Promise<{ encryptedData: Uint8Array; id: string }>;
  /** Fetch decryption keys and decrypt a Seal-encrypted blob. */
  decryptForBeneficiary(
    encryptedData: Uint8Array,
    trustObjectId: string,
    sessionKey: SessionKey,
    suiClient: SuiClient,
    packageId: string,
    /** Optional module name override (default: "trust") */
    moduleName?: string,
  ): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Seal client configured for the given network.
 *
 * @param suiClient - An initialised @mysten/sui SuiClient.
 * @param network   - Target network ("testnet" | "mainnet").
 *
 * @example
 * ```ts
 * const suiClient = new SuiClient({ url: TESTNET_CONFIG.sui.rpcUrl });
 * const sealClient = createSealClient(suiClient, "testnet");
 * const { encryptedData } = await sealClient.encryptForTrust(data, trustId, pkgId);
 * ```
 */
export function createSealClient(
  suiClient: SuiClient,
  network: "testnet" | "mainnet" = "testnet",
): TrusteaSealClient {
  const cfg = network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;

  const inner = new SealClient({
    suiClient,
    serverConfigs: [
      {
        objectId: cfg.seal.keyServerObjectId,
        weight: 1,
        // aggregatorUrl is required for the decentralised key server
        aggregatorUrl: cfg.seal.aggregatorUrl,
      },
    ],
    // Disable key-server TLS cert pinning in non-production setups.
    // Set to true when running against audited mainnet key servers.
    verifyKeyServers: network === "mainnet",
  });

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Derive the Seal encryption ID from the trust object bytes and a fresh nonce.
   *
   * The convention (matching the reference frontend) is:
   *   id = toHex(trustObjectIdBytes ++ 5-byte-nonce)
   */
  function deriveEncryptionId(trustObjectId: string): { id: string; nonce: Uint8Array } {
    const policyBytes = fromHex(trustObjectId);
    const nonce = crypto.getRandomValues(new Uint8Array(5));
    const id = toHex(new Uint8Array([...policyBytes, ...nonce]));
    return { id, nonce };
  }

  /**
   * Build a Move transaction that calls `<packageId>::<module>::seal_approve`.
   * The Seal key servers simulate this transaction to verify access before
   * releasing decryption keys.
   */
  function buildSealApproveTransaction(
    packageId: string,
    moduleName: string,
    trustObjectId: string,
    encryptedId: string,
  ): SealApproveConstructor {
    return (tx: Transaction, id: string) => {
      tx.moveCall({
        target: `${packageId}::${moduleName}::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(id)),
          tx.object(trustObjectId),
        ],
      });
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Encrypt `data` using the trust object's Seal access policy.
   *
   * @param data          - Plaintext bytes to encrypt.
   * @param trustObjectId - Sui object ID of the on-chain trust.
   * @param packageId     - Move package ID that owns the trust module.
   * @returns Encrypted bytes and the Seal encryption ID (needed for decrypt).
   */
  async function encryptForTrust(
    data: Uint8Array,
    trustObjectId: string,
    packageId: string,
  ): Promise<{ encryptedData: Uint8Array; id: string }> {
    const { id } = deriveEncryptionId(trustObjectId);

    const { encryptedObject } = await inner.encrypt({
      threshold: 1,
      packageId,
      id,
      data,
    });

    return { encryptedData: encryptedObject, id };
  }

  /**
   * Fetch Seal decryption keys for `encryptedData` and return the plaintext.
   *
   * This follows the two-step pattern from the reference implementation:
   *   1. `fetchKeys` — asks the key servers to verify access and cache keys.
   *   2. `decrypt`   — performs local decryption using the cached keys.
   *
   * @param encryptedData  - Raw encrypted bytes (as stored on Walrus).
   * @param trustObjectId  - Sui object ID of the on-chain trust.
   * @param sessionKey     - Active Seal session key for the calling wallet.
   * @param suiClient      - SuiClient used to build the approval transaction.
   * @param packageId      - Move package ID.
   * @param moduleName     - Move module name containing seal_approve (default: "trust").
   * @returns Decrypted plaintext bytes.
   *
   * @throws NoAccessError if the session key's address is not an authorised beneficiary.
   */
  async function decryptForBeneficiary(
    encryptedData: Uint8Array,
    trustObjectId: string,
    sessionKey: SessionKey,
    suiClient: SuiClient,
    packageId: string,
    moduleName = "trust",
  ): Promise<Uint8Array> {
    // Parse the encrypted object to recover the full Seal ID
    const encryptedId = EncryptedObject.parse(encryptedData).id;
    const moveCallConstructor = buildSealApproveTransaction(
      packageId,
      moduleName,
      trustObjectId,
      encryptedId,
    );

    // Build the seal_approve PTB used for key-server verification
    const tx = new Transaction();
    moveCallConstructor(tx, encryptedId);
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

    // Step 1: Fetch & cache decryption keys from the key server
    try {
      await inner.fetchKeys({
        ids: [encryptedId],
        txBytes,
        sessionKey,
        threshold: 1,
      });
    } catch (err) {
      if (err instanceof NoAccessError) {
        throw new Error(
          "Seal access denied: the session key address is not an authorised trust beneficiary.",
          { cause: err },
        );
      }
      throw err;
    }

    // Step 2: Local decryption using the fetched keys
    const plaintext = await inner.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes,
    });

    return plaintext;
  }

  return { inner, encryptForTrust, decryptForBeneficiary };
}

// ---------------------------------------------------------------------------
// Session key helpers
// ---------------------------------------------------------------------------

/**
 * Create a time-limited Seal session key for the calling wallet address.
 *
 * The returned SessionKey must be signed via `setPersonalMessageSignature`
 * with the wallet's signer before it can be used for decryption. In a
 * browser context this is done by calling `signPersonalMessage` from
 * @mysten/dapp-kit and passing the result to `sessionKey.setPersonalMessageSignature`.
 *
 * @param address   - The wallet Sui address that will decrypt.
 * @param packageId - The Move package ID the session is scoped to.
 * @param suiClient - An active SuiClient instance.
 * @param ttlMin    - Session TTL in minutes (default: 10).
 *
 * @example
 * ```ts
 * const sessionKey = await createSessionKey(address, packageId, suiClient);
 * const { signature } = await walletSigner.signPersonalMessage(sessionKey.getPersonalMessage());
 * await sessionKey.setPersonalMessageSignature(signature);
 * // sessionKey is now ready to use with decryptForBeneficiary
 * ```
 */
export async function createSessionKey(
  address: string,
  packageId: string,
  suiClient: SuiClient,
  ttlMin = 10,
): Promise<SessionKey> {
  const sessionKey = await SessionKey.create({
    address,
    packageId,
    ttlMin,
    suiClient,
  });
  return sessionKey;
}
