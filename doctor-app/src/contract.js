import { ethers } from 'ethers';
import ABI from './abi.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const DEPLOYMENT_BLOCK = Number(import.meta.env.VITE_DEPLOYMENT_BLOCK ?? 0);
const LOG_QUERY_BLOCK_SPAN = Number(import.meta.env.VITE_LOG_QUERY_BLOCK_SPAN ?? 10);

const EIP712_DOMAIN = {
  name: 'HealthRegistry',
  version: '1',
};

const DOCTOR_FETCH_TYPES = {
  DoctorFetchAuth: [
    { name: 'grantId', type: 'bytes32' },
    { name: 'recordKey', type: 'string' },
  ],
};

export const MSG_ACCESS_REQUEST = ethers.encodeBytes32String('ACCESS_REQUEST');

export function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
}

async function queryFilterInChunks(provider, contract, filter) {
  const latest = await provider.getBlockNumber();
  const from = Math.min(DEPLOYMENT_BLOCK, latest);
  const span = Math.max(1, LOG_QUERY_BLOCK_SPAN);
  const events = [];

  for (let start = from; start <= latest; start += span) {
    const end = Math.min(start + span - 1, latest);
    events.push(...await contract.queryFilter(filter, start, end));
  }

  return events;
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not found');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return { provider, signer };
}

export async function getDoctorId(signer) {
  const contract = getContract(signer);
  const id = await contract.walletToDoctorId(await signer.getAddress());
  return id === ethers.ZeroHash ? null : id;
}

export async function registerDoctor(signer, pubKeyHex) {
  const contract = getContract(signer);
  const tx = await contract.registerDoctor(pubKeyHex);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === 'DoctorRegistered');
  return event?.args?.doctorId;
}

export async function queryGrantsForDoctor(provider, doctorId) {
  const contract = getContract(provider);
  const filter = contract.filters.GrantCreated(null, null, doctorId);
  return queryFilterInChunks(provider, contract, filter);
}

export async function getGrant(provider, grantId) {
  const contract = getContract(provider);
  return contract.getGrant(grantId);
}

export async function getPatientInfo(provider, patientId) {
  const contract = getContract(provider);
  const [id, pubKey, wallet] = await contract.getPatient(patientId);
  return { id, pubKey, wallet };
}

export async function getDoctorInfo(provider, doctorId) {
  const contract = getContract(provider);
  const [id, pubKey, wallet] = await contract.getDoctor(doctorId);
  return { id, pubKey, wallet };
}

export async function getHospitalInfo(provider, hospitalId) {
  const contract = getContract(provider);
  const [id, pubKey, wallet, endpoint] = await contract.getHospital(hospitalId);
  return { id, pubKey, wallet, endpoint };
}

export async function signFetchRequest(signer, grantId, recordKey) {
  const network = await signer.provider.getNetwork();
  const domain = {
    ...EIP712_DOMAIN,
    chainId: Number(network.chainId),
    verifyingContract: CONTRACT_ADDRESS,
  };
  return signer.signTypedData(domain, DOCTOR_FETCH_TYPES, { grantId, recordKey });
}

export async function postAccessRequest(signer, patientId, payload) {
  const contract = getContract(signer);
  const tx = await contract.postMessage(patientId, MSG_ACCESS_REQUEST, payload);
  return tx.wait();
}

export async function waitForAccessLogged(provider, grantId, timeoutMs = 30000) {
  const contract = getContract(provider);
  const filter = contract.filters.AccessLogged(grantId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      contract.off(filter);
      reject(new Error('Timed out waiting for AccessLogged event'));
    }, timeoutMs);

    contract.once(filter, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}
