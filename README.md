# DeadSwitch 🔴

> **Your crypto backup agent. Built on Arc Testnet.**

DeadSwitch is a trustless asset recovery protocol that automatically moves your crypto to a backup wallet if you go silent — just a smart contract that fires when conditions are met.

---

## The Problem

Every day, crypto is lost forever because:

- People lose access to their wallets
- Phones get stolen or lost and seed phrases disappear
- No backup plan was set up in time

There is no reliable, trustless way to say: *"If I go silent for 30 days, send my assets here."*

DeadSwitch solves that.

---

## How It Works

1. **Create a backup plan** — Set a destination wallet, pick a check-in timer, and deposit USDC into the vault
2. **Check in regularly** — One tap resets the clock. As long as you check in, nothing happens
3. **Go silent — it activates** — If you stop checking in, the contract automatically sends your USDC to your backup address
4. **Get warned before it fires** — Add your email and DeadSwitch warns you when the deadline is close

---

## Real Use Cases

- **Lost wallet recovery** — Set a backup before disaster strikes
- **Crypto inheritance** — Ensure family or trusted contacts receive assets
- **Anti-kidnapping protection** — Assets auto-migrate if you can't check in
- **Corporate treasury guard** — Protect team funds if a key holder goes offline

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + React |
| Styling | Inline CSS with dark/light theme |
| Auth | Supabase Auth (email + magic link) |
| Database | Supabase (PostgreSQL + RLS) |
| Wallet | RainbowKit + wagmi + viem |
| Smart Contract | Solidity 0.8.19 |
| Network | Arc Testnet (Chain ID: 5042002) |
| Gas Token | USDC (native on Arc) |
| Automation | Vercel Cron + Chainlink-ready (`checkUpkeep` / `performUpkeep`) |
| Email Alerts | Resend |
| Deployment | Vercel |

---

## Smart Contract

**DeadSwitchVault.sol** — deployed on Arc Testnet

```
Contract: 0xa5c109Bfc654fC94B5714f8504a7445839C4eEe5
Network:  Arc Testnet (Chain ID: 5042002)
Explorer: https://testnet.arcscan.app/address/0xa5c109Bfc654fC94B5714f8504a7445839C4eEe5
```

### Key Functions

| Function | Description |
|---|---|
| `subscribe(tier)` | Pays USDC to activate Monthly, 6 Month, or Yearly access |
| `getSubscription(user)` | Returns tier, expiry, active switch limit, and max timer |
| `createSwitch(backup, amount, durationSeconds)` | Deposits USDC and creates a timed vault |
| `checkIn(id, durationSeconds)` | Resets the timer — proves you're still alive |
| `execute(id)` | Releases USDC to backup wallet after timer expires |
| `cancel(id)` | Owner withdraws USDC and cancels the plan |
| `checkUpkeep()` | Chainlink Automation compatible — checks for expired switches |
| `performUpkeep()` | Chainlink Automation compatible — executes expired switches |

The contract is fully **Chainlink Automation ready**. Once Chainlink deploys on Arc mainnet, upkeep registration will replace the current cron-based execution with fully decentralized automation.

---

## Subscription Tiers

Subscriptions are paid directly on-chain in USDC. The frontend opens a plan overlay on first login, from the navbar plan badge, and whenever a user hits their tier limits.

| Tier | Price | Duration | Active switches | Max timer |
|---|---:|---:|---:|---:|
| Free | 0 USDC | Forever | 1 | 30 days |
| Monthly | 15 USDC | 30 days | 2 | 90 days |
| 6 Month | 50 USDC | 180 days | 5 | 180 days |
| Yearly | 150 USDC | 365 days | Unlimited | 365 days |

`Active switches` means concurrent live switches. When a switch is executed or cancelled, that slot opens again.

There is currently **no platform fee on vault deposits**. Subscription payments are sent to the configured `platformWallet`; vaulted USDC remains in the contract until the switch is checked in, executed, or cancelled.

---

## Why Arc?

- **USDC as native gas** — Users never need to manage volatile gas tokens. One asset. Simple.
- **Circle infrastructure** — Built on the same rails as the world's most trusted stablecoin
- **EVM compatible** — Full Solidity support, familiar tooling
- **Early ecosystem** — DeadSwitch is one of the first real utility protocols on Arc

---

## Live Demo

🔗 **[deadswitch.vercel.app](https://dead-switch.vercel.app)**

To test:
1. Connect your wallet on Arc Testnet
2. Get testnet USDC from [faucet.circle.com](https://faucet.circle.com)
3. Create a backup plan
4. Check in to reset your timer

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/bludwithstyle061/DeadSwitch.git
cd DeadSwitch

# Install dependencies
npm install

# Add environment variables
cp .env.example .env.local
# Fill in your keys

# Run dev server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_CONTRACT_ADDRESS=0xa5c109Bfc654fC94B5714f8504a7445839C4eEe5
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=
CRON_SECRET=
EXECUTOR_PRIVATE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Supabase Schema Notes

The `switches` table needs the fields used by the app and cron worker, including the newer timer unit support:

```sql
alter table switches
add column if not exists timer_unit text default 'days',
add column if not exists contract_id text,
add column if not exists tx_hash text;
```

`timer_unit` is required because the app supports both day timers and minute timers for demos/testing.

---

## Deploying the Contract

```bash
# Install Hardhat dependencies
npm install --save-dev hardhat

# Compile
npx hardhat compile

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.js --network arcTestnet

# Verify on explorer
npx hardhat verify --network arcTestnet YOUR_CONTRACT_ADDRESS "0x3600000000000000000000000000000000000000" "YOUR_PLATFORM_WALLET_ADDRESS"
```

The constructor takes:

1. `USDC_ADDRESS` — Arc Testnet USDC: `0x3600000000000000000000000000000000000000`
2. `PLATFORM_WALLET` — the public wallet address that receives subscription payments

After deployment, update `NEXT_PUBLIC_CONTRACT_ADDRESS` locally and in Vercel.

---

## Roadmap

- [x] Smart contract deployed on Arc Testnet
- [x] USDC vault with approve + transferFrom flow
- [x] Subscription tiers in USDC
- [x] Free / paid tier limits for active switches and max timer length
- [x] Frontend with wallet connection
- [x] Email alerts when a switch is close to execution
- [x] Supabase auth — each user sees only their own switches
- [x] Chainlink-ready contract (checkUpkeep / performUpkeep)
- [x] Vercel cron job for automated execution
- [x] Multiple switches per user on paid tiers
- [ ] Chainlink Automation registration (pending Arc support)
- [ ] Circle Programmable Wallets / no-MetaMask onboarding
- [ ] Arc mainnet deployment
- [ ] Grant application to Arc ecosystem

---

## Builder

Built by **[@bludwithstyle](https://twitter.com/bludwithstyle)** — building in public from Lagos 

---

## Builder Notes

**Chainlink Automation:** Not yet live on Arc Testnet, which meant building a cron-based workaround instead of fully decentralized automation. This is the single biggest missing piece for a protocol like DeadSwitch — automated execution is the entire value proposition. Once Chainlink lands on Arc, DeadSwitch becomes genuinely trustless.

**Cron workaround:** Vercel's hobby plan only supports daily cron jobs, so I had to integrate cron-job.org for minute-level execution. A native Arc keeper or automation service would eliminate this friction entirely.

**Minutes timer:** Added specifically so users can verify the full execution flow in 1-2 minutes instead of waiting days. Essential for testing and demoing the automation.


## License

MIT
