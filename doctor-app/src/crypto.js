import { secp256k1 } from '@noble/curves/secp256k1';
import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

const IDENTITY_KEY = 'health_doctor_identity';

function toHex(bytes) {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const clean = hex.replace('0x', '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function hexToBytes(hex) { return fromHex(hex); }
export function bytesToHex(bytes) { return toHex(bytes); }

export function loadOrCreateIdentity() {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (stored) return JSON.parse(stored);

  const privKeyBytes = secp256k1.utils.randomPrivateKey();
  const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false);
  const identity = {
    privateKey: toHex(privKeyBytes),
    publicKey: toHex(pubKeyBytes),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function eciesEncrypt(recipientPubKeyHex, plaintext) {
  const recipientPub = fromHex(recipientPubKeyHex);
  const ephPriv = secp256k1.utils.randomPrivateKey();
  const ephPub = secp256k1.getPublicKey(ephPriv, false);

  const sharedPoint = secp256k1.getSharedSecret(ephPriv, recipientPub);
  const key = hkdf(sha256, sharedPoint, undefined, undefined, 32);
  const iv = randomBytes(12);

  const data = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(data);

  const result = new Uint8Array(65 + 12 + ciphertext.length);
  result.set(ephPub, 0);
  result.set(iv, 65);
  result.set(ciphertext, 77);
  return result;
}

export async function eciesDecrypt(privateKeyHex, encryptedBytes) {
  const privBytes = fromHex(privateKeyHex);
  const ephPub = encryptedBytes.slice(0, 65);
  const iv = encryptedBytes.slice(65, 77);
  const ciphertext = encryptedBytes.slice(77);

  const sharedPoint = secp256k1.getSharedSecret(privBytes, ephPub);
  const key = hkdf(sha256, sharedPoint, undefined, undefined, 32);
  const cipher = gcm(key, iv);
  const plaintext = cipher.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}
