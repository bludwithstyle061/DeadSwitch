import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, base, polygon } from "wagmi/chains";

const kiteMainnet = {
  id: 2366,
  name: "KiteAI Mainnet",
  nativeCurrency: { name: "Kite", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.gokite.ai"] },
    public: { http: ["https://rpc.gokite.ai"] },
  },
  blockExplorers: {
    default: { name: "KiteScan", url: "https://kitescan.ai" },
  },
};

export const config = getDefaultConfig({
  appName: "DeadSwitch",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [kiteMainnet, mainnet, base, polygon],
  ssr: true,
});