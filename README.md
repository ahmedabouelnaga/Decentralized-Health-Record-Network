# Decentralized Health Record Network

A mock system for locating and accessing patient medical records across hospitals. Records stay at hospitals; only encrypted pointers appear in a global on-chain registry. The patient controls who can decrypt those pointers. Every successful record access is recorded on-chain.

---

## Live Demo (Sepolia Testnet)

The web apps are deployed and live. No local setup needed to use them (although if you would like to do that, steps are provided separately further below):

| App | URL |
|---|---|
| Patient Portal | https://dhrn-patient-portal.vercel.app/ |
| Doctor Portal | https://dhrn-doctor-portal.vercel.app/ |
| Smart Contract | https://sepolia.etherscan.io/address/0x31C8AA1b256F8ccc69dd114A6D0332Fc114520ED |

**You will need to download the Metamask extension on your browser of choice for both the online and local demos. Follow instructions in https://metamask.io/.**


> **Requirements to use the live apps:**
> - MetaMask browser extension installed
> - MetaMask switched to the **Sepolia** network
> - A wallet funded with a small amount of Sepolia ETH (free from a faucet — see below)


---

## Components

| Component | Description | URL / Port |
|---|---|---|
| `contracts/` | Solidity smart contract + Foundry tests | Deployed on Sepolia |
| `hospital-server/` | Node/Express server; stores records, serves fetch requests | https://decentralized-health-record-network.onrender.com |
| `patient-app/` | React app; patient registration, inbox, grants, audit log | https://dhrn-patient-portal.vercel.app/ |
| `doctor-app/` | React app; doctor registration, grant list, record fetching | https://dhrn-doctor-portal.vercel.app/ |
| `shared/` | Shared contract ABI used by all three runtime components | — |

---

## Prerequisites


### 0. nvm — Node Version Manager (recommended first step) --> kinda works like a python virtual environment but for Node.

**macOS / Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc        # or ~/.bashrc
nvm --version          # confirm install
```


Then install and activate the correct Node version for this project:
```bash
nvm install 20
nvm use 20
node --version   # should print v20.x.x
```

To make this version the default for all new terminals:
```bash
nvm alias default 20
```

---

### 1. Node.js (v18+)
If you installed via `nvm` above you already have this. Otherwise:
```bash
node --version   # must be >= 18
```

### 2. Foundry (Solidity toolchain)
```bash
curl -L https://foundry.paradigm.xyz | bash
```

After the installer finishes, **add Foundry to your PATH** (this step is required — without it `forge` won't be found):
```bash
echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
foundryup
forge --version        # should print forge version
```

> If `forge` is still not found in a new terminal, run `source ~/.zshrc` again or open a fresh terminal window.

### 3. MetaMask browser extension
Install from https://metamask.io. You will need to add a custom network pointing to your local Anvil node (see Step 2 below).

---

## Installation (if you are running locally)

Install npm dependencies for each component:

```bash
# Hospital server
cd hospital-server && npm install && cd ..

# Patient app
cd patient-app && npm install && cd ..

# Doctor app
cd doctor-app && npm install && cd ..
```

The contract also requires the `forge-std` library. Install it once:
```bash
cd contracts
forge install foundry-rs/forge-std
cd ..
```

This creates `contracts/lib/forge-std/` which the deploy script and tests depend on.

---

## Environment Setup

Each component needs a `.env` file. Copy the examples and fill in the contract address after deployment (Step 3).

```bash
cp hospital-server/.env.example hospital-server/.env
cp patient-app/.env.example     patient-app/.env
cp doctor-app/.env.example      doctor-app/.env
```

### `hospital-server/.env`
```
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=<deployed contract address>
CHAIN_ID=31337
HOSPITAL_PRIVATE_KEY=<anvil private key — use key index 2>
PORT=4000
HOSPITAL_ENDPOINT=http://localhost:4000
```

### `patient-app/.env`
```
VITE_CONTRACT_ADDRESS=<deployed contract address>
VITE_CHAIN_ID=31337
```

### `doctor-app/.env`
```
VITE_CONTRACT_ADDRESS=<deployed contract address>
VITE_CHAIN_ID=31337
VITE_HOSPITAL_SERVER=http://localhost:4000
```

---

## Running the Hospital Server for Live Demo

The patient and doctor apps are already deployed on Vercel and talk to the Sepolia contract automatically. The only thing you need to run locally is the **hospital server**, since it holds the hospital private key and record store.

### Step 1 — Configure `hospital-server/.env` for Sepolia

```
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
CONTRACT_ADDRESS=0x632Fe22aE32AdD385D2297B32714bB7F1f86D486
CHAIN_ID=11155111
HOSPITAL_PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY
PORT=4000
HOSPITAL_ENDPOINT=http://localhost:4000
```

> The hospital wallet must have Sepolia ETH. Get some free from https://cloud.google.com/application/web3/faucet/ethereum/sepolia

### Step 2 — Start the hospital server

```bash
cd hospital-server
npm install   # first time only
npm start
```

You should see:
```
Registering hospital with pubKey: 0x04...
Hospital registered, id: 0x...
Hospital server running on port 4000
```

### Step 3 — Set up MetaMask for Sepolia

1. Open MetaMask → click the network selector → select **Sepolia**
2. If you don't have Sepolia ETH, go to https://cloud.google.com/application/web3/faucet/ethereum/sepolia and paste your wallet address
3. You need **two separate accounts** in MetaMask — one for patient, one for doctor (they must be different wallets)

### Step 4 — Use the live apps

- Open https://dhrn-patient-portal.vercel.app/ with your **Patient** MetaMask account active
- Open https://dhrn-doctor-portal.vercel.app/ in another tab with your **Doctor** MetaMask account active
- Follow the [End-to-End User Guide](#end-to-end-user-guide) below

---

## Running the Stack Locally (Anvil)

Open five terminals.

### Terminal 1 — Local Ethereum node
```bash
anvil
```
Anvil prints 10 funded accounts with private keys. The keys are always the same on a fresh start — use the assignment below.

| Role | Key index | Private key |
|---|---|---|
| Deployer (forge script) | 0 | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Patient (MetaMask) | 1 | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Hospital server | 2 | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Doctor (MetaMask) | 3 | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

### Terminal 2 — Deploy the contract
```bash
cd contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

The output will include a line like:
```
Deployed HealthRegistry at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

Copy that address into all three `.env` files:
```bash
# Replace 0xYOUR_ADDRESS with the printed address
sed -i '' 's|<deployed contract address>|0xYOUR_ADDRESS|g' \
  ../hospital-server/.env ../patient-app/.env ../doctor-app/.env
```
Or edit the three `.env` files manually.

> On a fresh local Anvil node the address is always `0x5FbDB2315678afecb367f032d93F642f64180aa3` because the deployer account and nonce are deterministic.

### Terminal 3 — Hospital server
```bash
cd hospital-server
npm start
```

### Terminal 4 — Patient app
```bash
cd patient-app
npm run dev
# → http://localhost:5173
```

### Terminal 5 — Doctor app
```bash
cd doctor-app
npm run dev
# → http://localhost:5174
```

### MetaMask — Add Anvil network
- Network name: `Anvil`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: `ETH`

### MetaMask — Step-by-step setup

**Add the Anvil network:**
1. Click the network selector at the top of MetaMask (usually says "Ethereum Mainnet")
2. Click **"Add a custom network"** (or "Add network manually" at the bottom)
3. Fill in:
   - Network name: `Anvil`
   - New RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
4. Click **Save** — MetaMask will switch to the Anvil network

**Import the Patient account (key index 1):**
1. Click the round account icon in the top-right corner of MetaMask
2. Click **"Add account or hardware wallet"**
3. Click **"Import account"**
4. Make sure **"Private Key"** is selected, then paste:
   ```
   0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
   ```
5. Click **Import**
6. Rename it `Patient`: click the three dots → Account details → pencil icon

**Import the Doctor account (key index 3):**
1. Click the round account icon → **"Add account or hardware wallet"** → **"Import account"**
2. Paste:
   ```
   0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
   ```
3. Click **Import** and rename it `Doctor`

> Do **not** import the hospital key (index 2) into MetaMask — it is used by the server only.

---

## Running the Contract Tests

```bash
cd contracts
forge test -vv
```

Expected output: **19 tests pass**.

> Make sure you have run `forge install foundry-rs/forge-std` inside `contracts/` first (see Installation above), otherwise the tests will fail with a "file not found" error.

---

## End-to-End User Guide

Follow these steps in order to navigate and test all features of the system.

### Before You Start

**Using the live deployment (recommended):**
- Hospital server running locally (`npm start` in `hospital-server/`)
- MetaMask on **Sepolia** with two funded accounts (patient + doctor)
- Patient app: https://dhrn-patient-portal.vercel.app/
- Doctor app: https://dhrn-doctor-portal.vercel.app/

**Using local Anvil instead:**
- All five terminals running (see [Running the Stack Locally](#running-the-stack-locally-anvil) above)
- MetaMask on **Anvil** network with patient (key 1) and doctor (key 3) accounts imported

---

### Phase 1 — Register as Patient

1. Open **https://dhrn-patient-portal.vercel.app/** in your browser (or http://localhost:5173 if running locally)
2. Make sure MetaMask is on the **Sepolia** network (or Anvil if running locally) and the **Patient** account is selected
3. Click **Connect Wallet** → approve in MetaMask
4. Click **Register** → approve the transaction in MetaMask
5. Your **Patient ID** (`0x...`) appears on screen — **copy and save it**, you'll need it later

---

### Phase 2 — Register as Doctor

1. Open **https://dhrn-doctor-portal.vercel.app/** in a new tab (or http://localhost:5174 if running locally)
2. Switch MetaMask to the **Doctor** account
3. Click **Connect Wallet** → approve
4. Click **Register** → approve the transaction
5. Your **Doctor ID** (`0x...`) appears — **copy and save it**

---

### Phase 3 — Hospital Adds a Record

Run this in a terminal (replace `PATIENT_ID` with the ID you saved in Phase 1):

```bash
curl -X POST https://decentralized-health-record-network.onrender.com/records/admin/add \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "PATIENT_ID",
    "recordType": "Blood Test",
    "recordContent": { "hemoglobin": 14.2, "glucose": 95 }
  }'
```
If running locally, run

```bash
curl -X POST http://localhost:4000/records/admin/add \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "PATIENT_ID",
    "recordType": "Blood Test",
    "recordContent": { "hemoglobin": 14.2, "glucose": 95 }
  }'
```

Expected response:
```json
{ "success": true, "recordKey": "rec_..." }
```

---

### Phase 4 — Patient Receives the Record

1. Go to **patient app** (https://dhrn-patient-portal.vercel.app/), switch MetaMask to **Patient**
2. Click the **Inbox** tab
3. A **POINTER_HANDOFF** message appears showing record type and timestamp
4. Click **Accept** → approve the transaction in MetaMask
5. Click the **Records** tab — the Blood Test entry should now appear with hospital info and date

---

### Phase 5 — Doctor Requests Access

1. Go to **doctor app** (https://dhrn-doctor-portal.vercel.app/), switch MetaMask to **Doctor**
2. Click the **Request Access** tab
3. Fill in:
   - **Patient ID:** paste the patient ID from Phase 1
   - **Justification:** e.g. `Annual checkup review`
   - **Record types:** `Blood Test`
   - **Expiry:** `7` (days)
4. Click **Send Request** → approve in MetaMask

---

### Phase 6 — Patient Creates a Grant

1. Go to **patient app** (https://dhrn-patient-portal.vercel.app/), switch MetaMask to **Patient**
2. Click **Inbox** — an **ACCESS_REQUEST** from the doctor appears showing their justification
3. Go to the **Grants** tab → click **Create Grant**
4. Fill in:
   - **Doctor ID:** paste the doctor ID from Phase 2
   - **Pointer index:** `0` (the first record)
   - **Expiry (days):** `7`
5. Click **Create Grant** → approve in MetaMask
6. The grant appears in the Grants tab with status **Active**

---

### Phase 7 — Doctor Fetches the Record

1. Go to **doctor app** (https://dhrn-doctor-portal.vercel.app/), switch MetaMask to **Doctor**
2. Click **My Grants** → click **Refresh**
3. The grant appears with status **Active**
4. Click **Fetch Record** → approve the MetaMask signature prompt
5. The button shows **"Fetching (waiting for on-chain log)…"** — this is expected; the app waits for the hospital to write the audit entry on-chain before showing the record. On Sepolia this takes ~15 seconds; on local Anvil it's near-instant.
6. After confirmation the record content appears:
   ```json
   { "hemoglobin": 14.2, "glucose": 95 }
   ```
7. Grant status changes to **Used**

---

### Phase 8 — Check the Audit Log

1. Go to **patient app** (https://dhrn-patient-portal.vercel.app/) → click **Audit Log** tab
2. You should see two entries:
   - 🟠 **Tier 1** (orange) — "Metadata disclosed (grant created)" — logged when you created the grant
   - 🔵 **Tier 2** (blue) — "Record fetched (content access)" — logged when the doctor fetched the record

---

### Phase 9 — Test Revocation

1. Add a second record via curl (same command as Phase 3, change `recordType` to `"X-Ray"`)
2. Accept it in the patient **Inbox**, then create a new grant for the doctor (pointer index `1`)
3. **Before** the doctor fetches — go to patient app → **Grants** → click **Revoke** on the new grant
4. Go to doctor app → **My Grants** → Refresh → click **Fetch Record** on the revoked grant
5. You should see the error: **"grant revoked"**

---

### What a Passing Test Looks Like

| Phase | Expected Result |
|---|---|
| Patient registers | Patient ID appears on screen |
| Doctor registers | Doctor ID appears on screen |
| Hospital adds record | `{ "success": true, "recordKey": "rec_..." }` |
| Patient inbox | POINTER_HANDOFF message appears |
| Patient accepts handoff | Record shows in Records tab |
| Doctor sends request | ACCESS_REQUEST appears in patient inbox |
| Patient creates grant | Grant appears as Active |
| Doctor fetches record | Record displays after on-chain log confirmation |
| Audit log | Tier 1 (orange) + Tier 2 (blue) entries both present |
| Revocation test | Fetch returns "grant revoked" error |

---

| Item | Note |
|---|---|
| Hospital misbehavior commitments / `accuse` function | Explicitly descoped as future work |
| ERC-2771 meta-tx relayer for `postMessage` sender privacy | Noted as acceptable for this milestone |
| Passphrase-encrypted private key in browser storage | Security recommendation only |

---

## Sepolia Testnet Deployment

This section walks you through deploying the contract to Sepolia and running the full stack against a public testnet instead of a local Anvil node.

---

### Step 1 — Get a Sepolia RPC URL (Alchemy)

1. Go to https://alchemy.com and create a free account
2. Click **"Create new app"**
3. Select **Ethereum** → **Ethereum Sepolia**
4. Give it any name (e.g. `HealthRegistry`)
5. Click your app → click **"API Key"**
6. Copy the **HTTPS** URL — it looks like:
   ```
   https://eth-sepolia.g.alchemy.com/v2/your-api-key-here
   ```

> You only need the RPC URL from Alchemy. Do not enter your private key anywhere on their site.

---

### Step 2 — Get a deployer wallet private key

You need a wallet with Sepolia ETH to pay for gas.

1. Open MetaMask → click the round account icon → **"Add account or hardware wallet"** → **"Add a new account"**
2. Name it `Sepolia Deployer`
3. Click the three dots on that account → **Account details** → **Show private key** → enter your MetaMask password
4. Copy the private key (starts with `0x`)

> Use a dedicated account — never use a wallet that holds real ETH.

---

### Step 3 — Fund the deployer wallet with Sepolia ETH

1. Copy your deployer wallet address from MetaMask
2. Go to https://cloud.google.com/application/web3/faucet/ethereum/sepolia
3. Paste your address and click **Send** — you'll receive free Sepolia ETH
4. Alternative faucet: https://sepoliafaucet.com

Wait ~30 seconds for the ETH to arrive before deploying.

---

### Step 4 — Deploy the contract

```bash
cd contracts
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY --broadcast
```

> **Important:** Write this as a single line with no line breaks.

The output will print:
```
HealthRegistry deployed at: 0xABC123...
```

Copy that contract address — you'll need it in the next step.

---

### Step 5 — Update all three `.env` files

**`hospital-server/.env`:**
```
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
CHAIN_ID=11155111
HOSPITAL_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
PORT=4000
HOSPITAL_ENDPOINT=http://localhost:4000
```

**`patient-app/.env`:**
```
VITE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_CHAIN_ID=11155111
```

**`doctor-app/.env`:**
```
VITE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_CHAIN_ID=11155111
VITE_HOSPITAL_SERVER=http://localhost:4000
```

> Sepolia chain ID is `11155111` — not `31337` (that's Anvil).

---

### Step 6 — Switch MetaMask to Sepolia

1. Click the network selector in MetaMask
2. Select **Sepolia** from the list (it's built-in, no need to add it manually)
3. Make sure you're using the wallet that has Sepolia ETH for patient and doctor accounts
4. Go to a faucet and fund your patient and doctor wallet addresses separately if needed

---

### Step 7 — Restart everything

Stop all running servers and restart:

```bash
# Terminal 1 — hospital server
cd hospital-server && npm start

# Terminal 2 — patient app
cd patient-app && npm run dev

# Terminal 3 — doctor app
cd doctor-app && npm run dev
```

---

### Step 8 — Re-register on Sepolia

Since this is a new contract on a new network, all registrations start fresh:

1. Patient app → Connect Wallet (make sure MetaMask is on Sepolia) → Register
2. Doctor app → Connect Wallet → Register
3. Hospital server registers itself automatically on startup

Then follow the full **End-to-End User Guide** above (Phases 3–9).

---

### Differences from local Anvil

| | Anvil (local) | Sepolia (testnet) |
|---|---|---|
| Transaction speed | Instant | ~12 seconds per block |
| ETH needed | Free (pre-funded) | Free from faucet |
| Block explorer | None | https://sepolia.etherscan.io |
| Chain ID | 31337 | 11155111 |
| "Waiting for on-chain log" | ~1 second | ~15 seconds |

You can view all your contract transactions at:
```
https://sepolia.etherscan.io/address/0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

---

## Package Reference

### `hospital-server`
| Package | Purpose |
|---|---|
| `express` | HTTP server framework |
| `cors` | Cross-origin request headers |
| `ethers` ^6 | Chain reads/writes, EIP-712 verification |
| `dotenv` | `.env` loading |
| `@noble/curves` | secp256k1 key operations (ECIES) |
| `@noble/ciphers` | AES-GCM encryption |
| `@noble/hashes` | SHA-256, HKDF |

### `patient-app` / `doctor-app`
| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `ethers` ^6 | MetaMask integration, contract calls, EIP-712 signing |
| `@noble/curves` | secp256k1 keypair generation + ECIES |
| `@noble/ciphers` | AES-GCM encryption |
| `@noble/hashes` | SHA-256, HKDF |
| `vite` + `@vitejs/plugin-react` | Dev server + build tooling |

### `contracts`
| Tool | Purpose |
|---|---|
| Foundry (`forge`) | Compile, test, deploy Solidity contracts |
| Solidity `^0.8.24` | Contract language (managed by Foundry) |
