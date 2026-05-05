import { useState } from 'react';
import { getPatientInfo, postAccessRequest } from '../contract.js';
import { eciesEncrypt, bytesToHex } from '../crypto.js';
import { ethers } from 'ethers';

export default function AccessRequest({ provider, signer, doctorId, identity }) {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [justification, setJustification] = useState('');
  const [recordTypes, setRecordTypes] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const patientId = patientIdInput.trim();
      if (!patientId.startsWith('0x') || patientId.length !== 66) {
        throw new Error('Invalid patient ID');
      }

      const { pubKey: patientPubKey } = await getPatientInfo(provider, patientId);
      if (!patientPubKey || patientPubKey === '0x') {
        throw new Error('Patient not found on chain');
      }

      const payload = JSON.stringify({
        doctorId,
        justification,
        requestedRecordTypes: recordTypes.split(',').map(s => s.trim()).filter(Boolean),
        expiryDesired: Math.floor(Date.now() / 1000) + parseInt(expiryDays, 10) * 86400,
        doctorSig: identity.publicKey,
      });

      const encryptedBytes = await eciesEncrypt(patientPubKey, payload);
      await postAccessRequest(signer, patientId, encryptedBytes);

      setStatus('Access request sent to patient.');
      setJustification('');
      setRecordTypes('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <p className="section-title">Send Access Request</p>
      <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 16 }}>
        The patient will receive an encrypted message in their inbox and can choose to grant you access.
      </p>

      <div className="form-group">
        <label>Patient ID (bytes32)</label>
        <input
          value={patientIdInput}
          onChange={e => setPatientIdInput(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="form-group">
        <label>Justification</label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder="Reason for requesting access…"
        />
      </div>
      <div className="row">
        <div className="form-group">
          <label>Record types (comma-separated)</label>
          <input
            value={recordTypes}
            onChange={e => setRecordTypes(e.target.value)}
            placeholder="Blood Test, MRI"
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 120px' }}>
          <label>Desired expiry (days)</label>
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

      <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
        {loading && <span className="spinner" />}
        Send Request
      </button>
    </div>
  );
}
