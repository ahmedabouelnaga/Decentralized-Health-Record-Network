import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  initChain,
  registerHospitalOnChain,
  getHospitalIdForSigner,
  getSignerAddress,
  ethers,
} from './chain.js';
import { privateKeyToPublicKeyBytes, bytesToHex } from './crypto.js';
import adminRouter from './routes/admin.js';
import fetchRouter from './routes/fetch.js';

const {
  RPC_URL = 'http://127.0.0.1:8545',
  CONTRACT_ADDRESS,
  CHAIN_ID = '31337',
  HOSPITAL_PRIVATE_KEY,
  PORT = '4000',
  HOSPITAL_ENDPOINT,
} = process.env;

if (!CONTRACT_ADDRESS || !HOSPITAL_PRIVATE_KEY) {
  console.error('CONTRACT_ADDRESS and HOSPITAL_PRIVATE_KEY must be set in .env');
  process.exit(1);
}

initChain(RPC_URL, CONTRACT_ADDRESS, HOSPITAL_PRIVATE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/records/admin', adminRouter);
app.use('/records/fetch', fetchRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function ensureRegistered() {
  const hospitalId = await getHospitalIdForSigner();
  if (hospitalId !== ethers.ZeroHash) {
    console.log('Hospital already registered, id:', hospitalId);
    return;
  }

  const pubKeyBytes = privateKeyToPublicKeyBytes(HOSPITAL_PRIVATE_KEY);
  const pubKeyHex = bytesToHex(pubKeyBytes);
  const endpoint = HOSPITAL_ENDPOINT || `http://localhost:${PORT}`;

  console.log('Registering hospital with pubKey:', pubKeyHex.slice(0, 20) + '...');
  await registerHospitalOnChain(pubKeyBytes, endpoint);
  const newId = await getHospitalIdForSigner();
  console.log('Hospital registered, id:', newId);
}

ensureRegistered()
  .then(() => {
    app.listen(Number(PORT), () => {
      console.log(`Hospital server running on port ${PORT}`);
      console.log(`Wallet: ${getSignerAddress()}`);
    });
  })
  .catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
