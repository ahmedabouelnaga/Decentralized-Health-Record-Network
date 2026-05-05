import { useState } from 'react';
import { getPointers, getDoctorInfo, getHospitalInfo, createGrant } from '../contract.js';
import { eciesDecrypt, eciesEncrypt, hexToBytes, bytesToHex } from '../crypto.js';
import { ethers } from 'ethers';

export default function CreateGrant({ provider, signer, patientId, identity }) {
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [pointerIndex, setPointerIndex] = useState('0');
  const [expiryDays, setExpiryDays] = useState('7');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const rawPointers = await getPointers(provider, patientId);
      const idx = parseInt(pointerIndex, 10);
      if (idx >= rawPointers.length) throw new Error('Pointer index out of range');

      const ptrBytes = hexToBytes(rawPointers[idx]);
      const pointerJson = await eciesDecrypt(identity.privateKey, ptrBytes);
      const pointer = JSON.parse(pointerJson);

      const doctorId = doctorIdInput.trim();
      if (!doctorId.startsWith('0x') || doctorId.length !== 66) {
        throw new Error('Invalid doctor ID (must be bytes32 hex)');
      }

      const { pubKey: doctorPubKey } = await getDoctorInfo(provider, doctorId);
      if (!doctorPubKey || doctorPubKey === '0x') throw new Error('Doctor not found on chain');

      const pointerJson2 = JSON.stringify(pointer);
      const encryptedForDoctor = await eciesEncrypt(doctorPubKey, pointerJson2);

      const expiry = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryDays, 10) * 86400);

      const grantId = await createGrant(signer, {
        doctorId,
        hospitalId: pointer.hospitalId,
        encryptedPointerForDoctor: encryptedForDoctor,
        expiry,
      });

      setStatus(`Grant created: ${grantId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <p className="section-title">Create Access Grant</p>
      <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 16 }}>
        Note: once created, the doctor can see the record type and hospital metadata immediately.
        Revocation stops future fetches but does not retract this metadata.
      </p>
      <div className="row">
        <div className="form-group">
          <label>Doctor ID (bytes32)</label>
          <input
            value={doctorIdInput}
            onChange={e => setDoctorIdInput(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 100px' }}>
          <label>Pointer #</label>
          <input
            type="number"
            min="0"
            value={pointerIndex}
            onChange={e => setPointerIndex(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 120px' }}>
          <label>Expiry (days)</label>
          <input
            type="number"
            min="1"
            value={expiryDays}
            onChange={e => setExpiryDays(e.target.value)}
          />
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}
      <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
        {loading && <span className="spinner" />}
        Create Grant
      </button>
    </div>
  );
}
