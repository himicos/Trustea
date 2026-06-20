"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { useEffect, useState } from "react";

const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io:443", network: "testnet" },
  mainnet: { url: "https://fullnode.mainnet.sui.io:443", network: "mainnet" },
});

// Register Enoki zkLogin wallets (Google social login).
// This makes them appear in dapp-kit's ConnectButton alongside Slush, etc.
function useEnokiRegistration() {
  const [registered, setRegistered] = useState(false);
  useEffect(() => {
    if (registered) return;
    const apiKey = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!apiKey || !googleClientId) return;

    Promise.all([
      import("@mysten/enoki"),
      import("@mysten/sui/jsonRpc"),
    ])
      .then(([{ registerEnokiWallets }, { SuiJsonRpcClient }]) => {
        const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
        registerEnokiWallets({
          apiKey,
          client,
          network: "testnet",
          providers: { google: { clientId: googleClientId } },
        });
        setRegistered(true);
      })
      .catch(() => {
        // Enoki not installed or failed — fall back to regular wallets only.
      });
  }, [registered]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEnokiRegistration();

  useEffect(() => {
    import("@/lib/burner-wallet").then((m) => m.maybeRegisterBurnerWallet());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
