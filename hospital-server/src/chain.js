import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ABI = JSON.parse(readFileSync(join(__dir, '../../shared/abi.json'), 'utf8'));

let provider, signer, contract;

export function initChain(rpcUrl, contractAddress, privateKey) {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  signer = new ethers.Wallet(privateKey, provider);
  contract = new ethers.Contract(contractAddress, ABI, signer);
}

export function getContract() {
  return contract;
}

export function getProvider() {
  return provider;
}

export async function getPatient(patientId) {
  const [id, pubKey, wallet] = await contract.getPatient(patientId);
  return { id, pubKey, wallet };
}

export async function getDoctor(doctorId) {
  const [id, pubKey, wallet] = await contract.getDoctor(doctorId);
  return { id, pubKey, wallet };
}

export async function getGrant(grantId) {
  return contract.getGrant(grantId);
}

export async function logAccessOnChain(grantId, recordBodyHex) {
  const recordHash = ethers.keccak256(ethers.toUtf8Bytes(recordBodyHex));
  const tx = await contract.logAccess(grantId, recordHash);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function postMessageOnChain(recipientId, messageType, payloadBytes) {
  const tx = await contract.postMessage(recipientId, messageType, payloadBytes);
  await tx.wait();
}

export async function registerHospitalOnChain(pubKeyBytes, endpoint) {
  const tx = await contract.registerHospital(pubKeyBytes, endpoint);
  const receipt = await tx.wait();
  return receipt;
}

export async function getHospitalIdForSigner() {
  return contract.walletToHospitalId(signer.address);
}

export function getSignerAddress() {
  return signer.address;
}

export function getChainId() {
  return provider.getNetwork().then(n => n.chainId);
}

export function getContractAddress() {
  return contract.target;
}

export { ethers };
