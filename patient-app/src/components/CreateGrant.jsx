import { useState } from 'react';
import { getPointers, getDoctorInfo, createGrant } from '../contract.js';
import { eciesDecrypt, eciesEncrypt, hexToBytes } from '../crypto.js';

export default function CreateGrant({ provider, signer, patientId, identity }) {
  const [doctorIdInput, setDoctorIdInput] = useState('');
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
      if (rawPointers.length === 0) throw new Error('No records found to share');

      const doctorId = doctorIdInput.trim();
      if (!doctorId.startsWith('0x') || doctorId.length !== 66) {
        throw new Error('Invalid doctor ID (must be bytes32 hex)');
      }

      const { pubKey: doctorPubKey } = await getDoctorInfo(provider, doctorId);
      if (!doctorPubKey || doctorPubKey === '0x') throw new Error('Doctor not found on chain');

      const encryptedPointersForDoctor = await Promise.all(
        rawPointers.map(async (rawPtr) => {
          const ptrBytes = hexToBytes(rawPtr);
          const pointerJson = await eciesDecrypt(identity.privateKey, ptrBytes);
          return eciesEncrypt(doctorPubKey, pointerJson);
        })
      );

      const expiry = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryDays, 10) * 86400);

      const grantId = await createGrant(signer, {
        doctorId,
        encryptedPointersForDoctor,
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
        Grants the doctor access to all your records. Revocation stops future fetches but does not retract disclosed metadata.
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
