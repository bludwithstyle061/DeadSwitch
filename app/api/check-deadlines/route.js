import { createClient } from "@supabase/supabase-js";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public:  { http: ["https://rpc.testnet.arc.network"] },
  },
};

export async function GET(request) {
  // Verify cron secret so only Vercel can call this
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active switches that have expired
    const now = new Date().toISOString();
    const { data: switches, error } = await supabase
      .from("switches")
      .select("*")
      .eq("status", "active")
      .lte("remaining", 0)
      .not("contract_id", "is", null);

    if (error) throw error;
    if (!switches || switches.length === 0) {
      return Response.json({ message: "No expired switches", executed: 0 });
    }

    // Set up wallet to call execute()
    const account = privateKeyToAccount(`0x${process.env.EXECUTOR_PRIVATE_KEY}`);
    const client = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http("https://rpc.testnet.arc.network"),
    }).extend(publicActions);

    let executed = 0;

    for (const sw of switches) {
      try {
        const hash = await client.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "execute",
          args: [BigInt(sw.contract_id)],
        });

        await client.waitForTransactionReceipt({ hash });

        // Update Supabase status
        await supabase
          .from("switches")
          .update({ status: "triggered", tx_hash: hash })
          .eq("id", sw.id);

        executed++;
        console.log(`Executed switch ${sw.id}, contract_id ${sw.contract_id}`);
      } catch (err) {
        console.error(`Failed to execute switch ${sw.id}:`, err.message);
      }
    }

    return Response.json({ message: "Done", executed });
  } catch (err) {
    console.error("Cron error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}