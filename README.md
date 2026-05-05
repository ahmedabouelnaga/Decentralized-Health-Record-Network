# Decentralized Health Record Network

A mock system for locating and accessing patient medical records across hospitals. Records stay at hospitals; only encrypted pointers appear in a global on-chain registry. The patient controls who can decrypt those pointers. Every successful record access is recorded on-chain.

---

## Components

| Component | Description | Port |
|---|---|---|
| `contracts/` | Solidity smart contract + Foundry tests | — |
| `hospital-server/` | Node/Express server; stores records, serves fetch requests | 4000 |
| `patient-app/` | React app; patient registration, inbox, grants, audit log | 5173 |
| `doctor-app/` | React app; doctor registration, grant list, record fetching | 5174 |
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

## Installation

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

## Running the Stack

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

## Project Verification Report

### Overall Assessment

The implementation is complete and matches the design specification. All components are wired end-to-end.

---

### Smart Contract — `contracts/src/HealthRegistry.sol`

All structs, functions, events, and authorization checks match the spec.

| Check | Status |
|---|---|
| `Patient`, `Doctor`, `Hospital`, `AccessGrant` structs | ✅ |
| `registerPatient / registerDoctor / registerHospital` | ✅ |
| `addPointer` — enforces `walletToPatientId[msg.sender]` | ✅ |
| `createGrant` — validates doctor, hospital, expiry | ✅ |
| `revokeGrant` — only the grant's patient can revoke | ✅ |
| `logAccess` — enforces `walletToHospitalId[msg.sender] == grant.hospitalId` | ✅ |
| `postMessage` — open to all callers, emits `EncryptedMessage` | ✅ |
| All 8 events emitted correctly | ✅ |
| Grant nonce uniqueness (`++_nonce` in `keccak256`) | ✅ |

**Foundry test coverage (19 tests):**

| Test | Covers |
|---|---|
| `test_RegisterPatient/Doctor/Hospital` | Registration + ID derivation |
| `test_RegisterPatientTwiceSameKey` | Duplicate registration rejected |
| `test_AddPointer` / `test_AddPointerUnregistered` | Pointer storage + auth |
| `test_CreateGrant` | Grant creation + event |
| `test_CreateGrantUnknownDoctor` / `test_CreateGrantPastExpiry` | Input validation |
| `test_RevokeGrant` / `test_RevokeGrantNotOwner` | Revocation + ownership check |
| `test_LogAccess` | Access logging + `used` flag |
| `test_LogAccessWrongHospital` | Wrong hospital rejected |
| `test_LogAccessRevoked` / `test_LogAccessExpired` / `test_LogAccessAlreadyUsed` | All invalid-grant cases |
| `test_PostMessage` | Message bus event |
| `test_GetPointerMultiple` | Multi-pointer storage |
| `test_GrantNonceUniqueness` | Identical params produce different grant IDs |

---

### Hospital Server — `hospital-server/src/`

| Check | Status |
|---|---|
| `POST /records/admin/add` — persists record, encrypts pointer, calls `postMessage` | ✅ |
| `POST /records/fetch` — validates grant (revoked / used / expired / wrong hospital) | ✅ |
| EIP-712 patient signature verification (`PatientGrantAuth`) | ✅ |
| EIP-712 doctor signature verification (`DoctorFetchAuth`) | ✅ |
| Calls `logAccess` on-chain with `keccak256(recordBody)` | ✅ |
| Returns `logTxHash` alongside record | ✅ |
| ECIES encryption of pointer under patient public key | ✅ |

---

### Patient App — `patient-app/src/`

| Feature | Component | Status |
|---|---|---|
| Connect wallet + register | `Register.jsx` | ✅ |
| List + decrypt record pointers | `PointerList.jsx` | ✅ |
| Create grant with EIP-712 signature | `CreateGrant.jsx` | ✅ |
| View + revoke active grants | `GrantList.jsx` | ✅ |
| Inbox: `POINTER_HANDOFF` + `ACCESS_REQUEST` | `Inbox.jsx` | ✅ |
| Accept handoff → calls `addPointer` | `Inbox.jsx` | ✅ |
| Two-tier audit log (Tier 1 orange / Tier 2 blue) | `AuditLog.jsx` | ✅ |

---

### Doctor App — `doctor-app/src/`

| Feature | Component | Status |
|---|---|---|
| Connect wallet + register | `Register.jsx` | ✅ |
| List grants via `GrantCreated` event filter | `GrantList.jsx` | ✅ |
| Decrypt `encryptedPointerForDoctor` locally | `GrantList.jsx` | ✅ |
| Sign fetch request (EIP-712 `DoctorFetchAuth`) | `contract.js` | ✅ |
| POST to hospital `/records/fetch` | `GrantList.jsx` | ✅ |
| Wait for `AccessLogged` before displaying record | `GrantList.jsx:55-75` | ✅ |
| Send `ACCESS_REQUEST` encrypted to patient | `AccessRequest.jsx` | ✅ |

---

### Security-Critical Invariants

**1. Doctor cannot see record until `AccessLogged` is on-chain.**
`waitForAccessLogged` is started before the HTTP fetch and awaited before `resp.json()` is consumed (`GrantList.jsx:55–75`). The hospital cannot skip logging.

**2. `logAccess` access control.**
`HealthRegistry.sol:145–148` requires `walletToHospitalId[msg.sender] == grant.hospitalId`. Anyone else calling `logAccess` is rejected.

**3. Revocation stops content access.**
Both the contract (`sol:149`) and the server (`fetch.js:49`) check the `revoked` flag independently. Revocation does not retract metadata already disclosed (by design — the grant-creation UI notes this).

**4. Expiry enforced in two places.**
On-chain in `logAccess` (`sol:151`) and off-chain in the server pre-check (`fetch.js:55`).

**5. Single-use grant.**
`used` flag set atomically in `logAccess` (`sol:152`), checked by server before calling the chain (`fetch.js:52`).

---

### Manual End-to-End Test Checklist

Walk through each flow in order after starting the stack:

- [ ] **9.1** Open patient app, connect MetaMask, click Register → patient ID appears
- [ ] **9.2** `curl -X POST http://localhost:4000/records/admin/add -H "Content-Type: application/json" -d '{"patientId":"0x...","recordType":"Blood Test","recordContent":{"value":14.2}}'` → returns `recordKey`
- [ ] **9.3** Patient app → Inbox → POINTER_HANDOFF message appears → click Accept → Records tab shows new entry
- [ ] **9.4** Doctor app → Request Access → fill patient ID + justification → send → patient Inbox shows ACCESS_REQUEST
- [ ] **9.5** Patient app → Create Grant → pick pointer index + doctor ID + expiry → submit
- [ ] **9.6** Doctor app → My Grants → click Fetch Record → spinner shows "waiting for on-chain log" → record displays
- [ ] **9.7** Patient app → Grants → Revoke → doctor Fetch now returns 403 revoked
- [ ] **9.8** Patient app → Audit Log → Tier 1 (orange) entry for grant creation + Tier 2 (blue) entry for record fetch

---

### Items Intentionally Out of Scope (per design §11)

---

## End-to-End User Guide

Follow these steps in order to navigate and test all features of the system.

### Before You Start

Make sure all five terminals are running (see [Running the Stack](#running-the-stack) above):
- Terminal 1: `anvil`
- Terminal 2: contract deployed
- Terminal 3: hospital server (`npm start`)
- Terminal 4: patient app (`npm run dev` → http://localhost:5173)
- Terminal 5: doctor app (`npm run dev` → http://localhost:5174)

---

### Phase 1 — Register as Patient

1. Open **http://localhost:5173** in your browser
2. Make sure MetaMask is on the **Anvil** network and the **Patient** account is selected
3. Click **Connect Wallet** → approve in MetaMask
4. Click **Register** → approve the transaction in MetaMask
5. Your **Patient ID** (`0x...`) appears on screen — **copy and save it**, you'll need it later

---

### Phase 2 — Register as Doctor

1. Open **http://localhost:5174** in a new tab (keep patient app open)
2. Switch MetaMask to the **Doctor** account
3. Click **Connect Wallet** → approve
4. Click **Register** → approve the transaction
5. Your **Doctor ID** (`0x...`) appears — **copy and save it**

---

### Phase 3 — Hospital Adds a Record

Run this in a terminal (replace `PATIENT_ID` with the ID you saved in Phase 1):

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

1. Go to **patient app** (http://localhost:5173), switch MetaMask to **Patient**
2. Click the **Inbox** tab
3. A **POINTER_HANDOFF** message appears showing record type and timestamp
4. Click **Accept** → approve the transaction in MetaMask
5. Click the **Records** tab — the Blood Test entry should now appear with hospital info and date

---

### Phase 5 — Doctor Requests Access

1. Go to **doctor app** (http://localhost:5174), switch MetaMask to **Doctor**
2. Click the **Request Access** tab
3. Fill in:
   - **Patient ID:** paste the patient ID from Phase 1
   - **Justification:** e.g. `Annual checkup review`
   - **Record types:** `Blood Test`
   - **Expiry:** `7` (days)
4. Click **Send Request** → approve in MetaMask

---

### Phase 6 — Patient Creates a Grant

1. Go to **patient app**, switch MetaMask to **Patient**
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

1. Go to **doctor app**, switch MetaMask to **Doctor**
2. Click **My Grants** → click **Refresh**
3. The grant appears with status **Active**
4. Click **Fetch Record** → approve the MetaMask signature prompt
5. The button shows **"Fetching (waiting for on-chain log)…"** — this is expected; the app waits for the hospital to write the audit entry on-chain before showing the record
6. After a few seconds the record content appears:
   ```json
   { "hemoglobin": 14.2, "glucose": 95 }
   ```
7. Grant status changes to **Used**

---

### Phase 8 — Check the Audit Log

1. Go to **patient app** → click **Audit Log** tab
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
