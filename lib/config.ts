/**
 * Trustea centralized network configuration.
 * Import the appropriate config constant for the target network.
 */

export interface SuiConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
}

export interface WalrusConfig {
  publisher: string;
  aggregator: string;
}

export interface SealConfig {
  keyServerObjectId: string;
  aggregatorUrl: string;
  /** Trustea Move package ID on the given network */
  packageId: string;
}

export interface MemWalConfig {
  serverUrl: string;
  /** MemWal Move package ID (used for on-chain account registry) */
  packageId: string;
  /** MemWalRegistry shared object ID */
  registryId: string;
}

export interface TrusteaConfig {
  sui: SuiConfig;
  walrus: WalrusConfig;
  seal: SealConfig;
  memwal: MemWalConfig;
}

// ---------------------------------------------------------------------------
// Testnet
// ---------------------------------------------------------------------------

export const TESTNET_CONFIG: TrusteaConfig = {
  sui: {
    network: "testnet",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
  },
  walrus: {
    publisher: "https://publisher.walrus-testnet.walrus.space",
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
  },
  seal: {
    keyServerObjectId:
      "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98",
    aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com",
    packageId:
      "0x99918b1c3d33c75a0f8935713f5aa2ef82d8ef63d3352dfd0d320f69a1e0408e",
  },
  memwal: {
    serverUrl: "https://relayer-staging.memory.walrus.xyz",
    packageId:
      "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
    registryId:
      "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
  },
};

// ---------------------------------------------------------------------------
// Mainnet (fill in when deployed)
// ---------------------------------------------------------------------------

export const MAINNET_CONFIG: TrusteaConfig = {
  sui: {
    network: "mainnet",
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
  },
  walrus: {
    publisher: "https://publisher.walrus.space",
    aggregator: "https://aggregator.walrus.space",
  },
  seal: {
    keyServerObjectId: "0xTODO_MAINNET_KEY_SERVER_OBJECT_ID",
    aggregatorUrl: "https://seal-aggregator.mystenlabs.com",
    packageId: "0x931739224160073d8e391c9aa6e7ade9818e9814b4907066b7efa058636c4e45",
  },
  memwal: {
    serverUrl: "https://relayer.memory.walrus.xyz",
    packageId: "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
    registryId: "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd",
  },
};

/**
 * Return the config for the specified network, defaulting to testnet.
 */
export function getConfig(network: "testnet" | "mainnet" = "testnet"): TrusteaConfig {
  return network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
}
