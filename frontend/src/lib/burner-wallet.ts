/**
 * Dev-only burner wallet, registered through the Wallet Standard so it goes
 * through the exact same dapp-kit signing path as Slush/Nightly.
 *
 * Enabled only when localStorage["trustea-burner"] === "1". Never enable in
 * production demos with real funds — the key lives in localStorage.
 */

import {
  registerWallet,
  ReadonlyWalletAccount,
  SUI_TESTNET_CHAIN,
  type Wallet,
  type StandardConnectFeature,
  type StandardEventsFeature,
  type StandardEventsOnMethod,
  type SuiSignTransactionFeature,
  type SuiSignPersonalMessageFeature,
} from "@mysten/wallet-standard";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { toBase64 } from "@mysten/sui/utils";

const KEY_STORAGE = "trustea-burner-key";
const ENABLE_FLAG = "trustea-burner";

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0B1210"/><path d="M16 6l8 14H8z" fill="#10B981"/></svg>',
  );

function loadOrCreateKeypair(): Ed25519Keypair {
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    try {
      return Ed25519Keypair.fromSecretKey(stored);
    } catch {
      // fall through to fresh keypair
    }
  }
  const kp = new Ed25519Keypair();
  localStorage.setItem(KEY_STORAGE, kp.getSecretKey());
  return kp;
}

class BurnerWallet implements Wallet {
  readonly version = "1.0.0" as const;
  readonly name = "Trustea Burner (Dev)";
  readonly icon = ICON as Wallet["icon"];
  readonly chains = [SUI_TESTNET_CHAIN] as const;

  #keypair: Ed25519Keypair;
  #account: ReadonlyWalletAccount;
  #client: SuiJsonRpcClient;

  constructor() {
    this.#keypair = loadOrCreateKeypair();
    this.#client = new SuiJsonRpcClient({
      url: "https://fullnode.testnet.sui.io:443",
      network: "testnet",
    });
    this.#account = new ReadonlyWalletAccount({
      address: this.#keypair.getPublicKey().toSuiAddress(),
      publicKey: this.#keypair.getPublicKey().toRawBytes(),
      chains: [SUI_TESTNET_CHAIN],
      features: ["sui:signTransaction", "sui:signPersonalMessage"],
    });
  }

  get accounts() {
    return [this.#account];
  }

  get features(): StandardConnectFeature &
    StandardEventsFeature &
    SuiSignTransactionFeature &
    SuiSignPersonalMessageFeature {
    return {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => ({ accounts: this.accounts }),
      },
      "standard:events": {
        version: "1.0.0",
        on: this.#on,
      },
      "sui:signTransaction": {
        version: "2.0.0",
        signTransaction: async ({ transaction }) => {
          const tx = Transaction.from(await transaction.toJSON());
          tx.setSenderIfNotSet(this.#account.address);
          const bytes = await tx.build({ client: this.#client });
          const { signature } = await this.#keypair.signTransaction(bytes);
          return { bytes: toBase64(bytes), signature };
        },
      },
      "sui:signPersonalMessage": {
        version: "1.1.0",
        signPersonalMessage: async ({ message }) => {
          const { signature, bytes } = await this.#keypair.signPersonalMessage(message);
          return { bytes, signature };
        },
      },
    };
  }

  #on: StandardEventsOnMethod = () => {
    return () => {};
  };
}

export function maybeRegisterBurnerWallet() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(ENABLE_FLAG) !== "1") return;
  registerWallet(new BurnerWallet());
}
