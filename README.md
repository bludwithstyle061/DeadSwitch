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

1. **Create a backup plan** — Set a destination wallet, pick a check-in timer (2 days to 365), and deposit USDC into the vault
2. **Check in regularly** — One tap resets the clock. As long as you check in, nothing happens
3. **Go silent — it activates** — If you stop checking in, the contract automatically sends your USDC to your backup address
4. **Get warned before it fires** — Add your email and DeadSwitch warns you 7 days before your timer expires

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
| `createSwitch(backup, amount, days)` | Deposits USDC and creates a timed vault |
| `checkIn(id, days)` | Resets the timer — proves you're still alive |
| `execute(id)` | Releases USDC to backup wallet after timer expires |
| `cancel(id)` | Owner withdraws USDC and cancels the plan |
| `checkUpkeep()` | Chainlink Automation compatible — checks for expired switches |
| `performUpkeep()` | Chainlink Automation compatible — executes expired switches |

The contract is fully **Chainlink Automation ready**. Once Chainlink deploys on Arc mainnet, upkeep registration will replace the current cron-based execution with fully decentralized automation.

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
NEXT_PUBLIC_CONTRACT_ADDRESS=0xCfc32d97124275422112D62bF55f4e72D0D88572
RESEND_API_KEY=
CRON_SECRET=
EXECUTOR_PRIVATE_KEY=
```

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
npx hardhat verify --network arcTestnet YOUR_CONTRACT_ADDRESS "0x3600000000000000000000000000000000000000"
```

---

## Roadmap

- [x] Smart contract deployed on Arc Testnet
- [x] USDC vault with approve + transferFrom flow
- [x] Frontend with wallet connection
- [x] Email alerts at 7 days remaining
- [x] Supabase auth — each user sees only their own switches
- [x] Chainlink-ready contract (checkUpkeep / performUpkeep)
- [x] Vercel cron job for automated execution
- [ ] Chainlink Automation registration (pending Arc support)
- [ ] Multiple switches per user with staggered timers
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
