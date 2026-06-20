/**
 * Browser-side Seal document pipeline:
 *   encrypt (Seal, trust-scoped policy) → store (Walrus publisher HTTP)
 *   fetch (Walrus aggregator) → decrypt (Seal key server via seal_approve)
 *
 * Mirrors lib/seal + lib/walrus, inlined here because Turbopack cannot
 * resolve the lib package's Node-style ".js" imports.
 */

import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex, fromBase64, toBase64 } from "@mysten/sui/utils";
import { PACKAGE_ID } from "@/hooks/use-trustea";

const SEAL_KEY_SERVER_OBJECT_ID =
  "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98";
const SEAL_AGGREGATOR_URL = "https://seal-aggregator-testnet.mystenlabs.com";
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const DEFAULT_EPOCHS = 10;

// SuiClient types vary across @mysten/sui entry points; the Seal SDK only
// needs the rpc surface, so accept anything client-shaped.
type AnySuiClient = any;

let sealClient: SealClient | null = null;

function getSealClient(suiClient: AnySuiClient): SealClient {
  if (!sealClient) {
    sealClient = new SealClient({
      suiClient,
      serverConfigs: [
        {
          objectId: SEAL_KEY_SERVER_OBJECT_ID,
          weight: 1,
          aggregatorUrl: SEAL_AGGREGATOR_URL,
        },
      ],
      verifyKeyServers: false,
    });
  }
  return sealClient;
}

/** Wrap file bytes + name so the filename survives the encrypt/store cycle. */
function packDocument(name: string, mimeType: string, bytes: Uint8Array): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ name, mimeType, data: toBase64(bytes) }),
  );
}

function unpackDocument(plaintext: Uint8Array): {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
} {
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as {
    name: string;
    mimeType: string;
    data: string;
  };
  return {
    name: parsed.name,
    mimeType: parsed.mimeType || "application/octet-stream",
    bytes: fromBase64(parsed.data),
  };
}

export async function encryptAndStoreDocument(params: {
  suiClient: AnySuiClient;
  trustId: string;
  fileName: string;
  mimeType: string;
  fileBytes: Uint8Array;
}): Promise<{ blobId: string; encryptedSize: number }> {
  const { suiClient, trustId, fileName, mimeType, fileBytes } = params;
  const client = getSealClient(suiClient);

  // seal_policy::parse_suffix requires exactly 32 bytes (plain whitelist)
  // or 32+8 (time-locked) — no nonce suffix allowed.
  const id = toHex(fromHex(trustId));

  const { encryptedObject } = await client.encrypt({
    threshold: 1,
    packageId: PACKAGE_ID,
    id,
    data: packDocument(fileName, mimeType, fileBytes),
  });

  const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${DEFAULT_EPOCHS}`, {
    method: "PUT",
    body: encryptedObject as BodyInit,
  });
  if (!response.ok) {
    throw new Error(`Walrus publisher error ${response.status}: ${await response.text()}`);
  }
  const result = (await response.json()) as {
    newlyCreated?: { blobObject: { blobId: string } };
    alreadyCertified?: { blobId: string };
  };
  const blobId =
    result.newlyCreated?.blobObject.blobId ?? result.alreadyCertified?.blobId;
  if (!blobId) throw new Error("Walrus publisher returned no blobId");

  return { blobId, encryptedSize: encryptedObject.byteLength };
}

export async function createDocumentSessionKey(
  address: string,
  suiClient: AnySuiClient,
): Promise<SessionKey> {
  return SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient,
  });
}

export async function fetchAndDecryptDocument(params: {
  suiClient: AnySuiClient;
  trustId: string;
  blobId: string;
  sessionKey: SessionKey;
}): Promise<{ name: string; mimeType: string; bytes: Uint8Array }> {
  const { suiClient, trustId, blobId, sessionKey } = params;
  const client = getSealClient(suiClient);

  const blobRes = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!blobRes.ok) {
    throw new Error(`Walrus aggregator error ${blobRes.status}`);
  }
  const encryptedData = new Uint8Array(await blobRes.arrayBuffer());

  const encryptedId = EncryptedObject.parse(encryptedData).id;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [
      tx.pure.vector("u8", fromHex(encryptedId)),
      tx.object(trustId),
      tx.object("0x6"),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  await client.fetchKeys({
    ids: [encryptedId],
    txBytes,
    sessionKey,
    threshold: 1,
  });
  const plaintext = await client.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });

  return unpackDocument(plaintext);
}
