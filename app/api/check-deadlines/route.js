import { createClient } from "@supabase/supabase-js";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizePrivateKey(value) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function timerUnit(sw) {
  return sw?.timer_unit || "days";
}

function remainingFromSeconds(seconds, sw) {
  if (seconds <= 0n) return 0;
  return timerUnit(sw) === "minutes"
    ? Math.ceil(Number(seconds) / 60)
    : Math.ceil(Number(seconds) / 86400);
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );

    const account = privateKeyToAccount(normalizePrivateKey(requiredEnv("EXECUTOR_PRIVATE_KEY")));
    const client = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http("https://rpc.testnet.arc.network"),
    }).extend(publicActions);

    const { data: switches, error } = await supabase
  .from("switches")
  .select("*");

if (error) throw error;
console.log("Found switches:", JSON.stringify(switches?.map(s => ({ id: s.id, contract_id: s.contract_id, status: s.status, timer_unit: s.timer_unit }))));

    let executed = 0;
    let synced = 0;
    const failures = [];

    for (const sw of switches || []) {
      try {
        const secondsRemaining = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "timeRemaining",
          args: [BigInt(sw.contract_id)],
        });

        const remaining = remainingFromSeconds(secondsRemaining, sw);

        if (Number(secondsRemaining) > 10) {
          const nextStatus = Number(secondsRemaining) <= 120 ? "warning" : "active";
          await supabase
            .from("switches")
            .update({ remaining, status: nextStatus })
            .eq("id", sw.id);
          synced++;
          continue;
        }

        const hash = await client.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "execute",
          args: [BigInt(sw.contract_id)],
        });

        await client.waitForTransactionReceipt({ hash });

        await supabase
          .from("switches")
          .update({ status: "triggered", remaining: 0, tx_hash: hash })
          .eq("id", sw.id);

        executed++;
      } catch (err) {
        failures.push({ id: sw.id, contract_id: sw.contract_id, error: err.message });
      }
    }

    return Response.json({
      message: "Deadline check complete",
      checked: switches?.length || 0,
      synced,
      executed,
      failures,
    });
  } catch (err) {
    console.error("Cron error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
