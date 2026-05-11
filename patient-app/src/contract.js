import { ethers } from 'ethers';
import ABI from '../../shared/abi.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const DEPLOYMENT_BLOCK = Number(import.meta.env.VITE_DEPLOYMENT_BLOCK ?? 0);
const LOG_QUERY_BLOCK_SPAN = Number(import.meta.env.VITE_LOG_QUERY_BLOCK_SPAN ?? 10);

const EIP712_DOMAIN = {
  name: 'HealthRegistry',
  version: '1',
};

const PATIENT_GRANT_TYPES = {
  PatientGrantAuth: [
    { name: 'doctorId', type: 'bytes32' },
    { name: 'expiry', type: 'uint256' },
  ],
};

export const MSG_POINTER_HANDOFF = ethers.encodeBytes32String('POINTER_HANDOFF');
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

export async function getPatientId(signer) {
  const contract = getContract(signer);
  const id = await contract.walletToPatientId(await signer.getAddress());
  return id === ethers.ZeroHash ? null : id;
}

export async function registerPatient(signer, pubKeyHex) {
  const contract = getContract(signer);
  const tx = await contract.registerPatient(pubKeyHex);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === 'PatientRegistered');
  return event?.args?.patientId;
}

export async function addPointer(signer, encryptedPointerBytes) {
  const contract = getContract(signer);
  const tx = await contract.addPointer(encryptedPointerBytes);
  return tx.wait();
}

export async function getPointers(provider, patientId) {
  const contract = getContract(provider);
  return contract.getPointers(patientId);
}

export async function createGrant(signer, { doctorId, encryptedPointersForDoctor, expiry }) {
  const contract = getContract(signer);
  const network = await signer.provider.getNetwork();

  const domain = {
    ...EIP712_DOMAIN,
    chainId: Number(network.chainId),
    verifyingContract: CONTRACT_ADDRESS,
  };

  const patientSig = await signer.signTypedData(domain, PATIENT_GRANT_TYPES, {
    doctorId,
    expiry,
  });

  const tx = await contract.createGrant(
    doctorId,
    encryptedPointersForDoctor,
    expiry,
    patientSig
  );
  const receipt = await tx.wait();
  const event = receipt.logs
    .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === 'GrantCreated');
  return event?.args?.grantId;
}

export async function revokeGrant(signer, grantId) {
  const contract = getContract(signer);
  const tx = await contract.revokeGrant(grantId);
  return tx.wait();
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

export async function queryGrantsForPatient(provider, patientId) {
  const contract = getContract(provider);
  const filter = contract.filters.GrantCreated(null, patientId);
  return queryFilterInChunks(provider, contract, filter);
}

export async function queryAccessLogs(provider, patientId) {
  const contract = getContract(provider);
  const filter = contract.filters.AccessLogged(null, patientId);
  return queryFilterInChunks(provider, contract, filter);
}

export async function subscribeToMessages(provider, patientId, onMessage) {
  const contract = getContract(provider);
  const filter = contract.filters.EncryptedMessage(patientId);
  contract.on(filter, (recipientId, messageType, payload, event) => {
    onMessage({ recipientId, messageType, payload, event });
  });
  return () => contract.off(filter);
}

export async function pastMessages(provider, patientId) {
  const contract = getContract(provider);
  const filter = contract.filters.EncryptedMessage(patientId);
  return queryFilterInChunks(provider, contract, filter);
}
