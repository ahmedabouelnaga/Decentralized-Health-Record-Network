import { useState, useEffect } from 'react';
import {
  queryGrantsForDoctor,
  getGrant,
  getHospitalInfo,
  signFetchRequest,
  waitForAccessLogged,
} from '../contract.js';
import { eciesDecrypt, hexToBytes } from '../crypto.js';
import { ethers } from 'ethers';

const HOSPITAL_SERVER = import.meta.env.VITE_HOSPITAL_SERVER || 'http://localhost:4000';

export default function GrantList({ provider, signer, doctorId, identity }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(null);
  const [records, setRecords] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => { load(); }, [doctorId]);

  async function load() {
    setLoading(true);
    try {
      const events = await queryGrantsForDoctor(provider, doctorId);
      const details = await Promise.all(
        events.map(async (e) => {
          const g = await getGrant(provider, e.args.grantId);
          return g;
        })
      );
      setGrants(details);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleFetch(grant) {
    const key = grant.grantId;
    setFetching(key);
    setErrors(e => ({ ...e, [key]: null }));
    try {
      const ptrBytes = hexToBytes(grant.encryptedPointerForDoctor);
      const pointerJson = await eciesDecrypt(identity.privateKey, ptrBytes);
      const pointer = JSON.parse(pointerJson);

      const { endpoint } = await getHospitalInfo(provider, grant.hospitalId);
      const hospitalUrl = pointer.hospitalEndpoint || endpoint || HOSPITAL_SERVER;

      const doctorSig = await signFetchRequest(signer, grant.grantId, pointer.recordKey);

      const waitPromise = waitForAccessLogged(provider, grant.grantId);

      const resp = await fetch(`${hospitalUrl}/records/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantId: grant.grantId,
          recordPointer: pointer,
          patientSignature: grant.patientSig,
          doctorSignature: doctorSig,
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(body.error || resp.statusText);
      }

      const { record, logTxHash } = await resp.json();

      try {
        await waitPromise;
      } catch (eventErr) {
        if (!logTxHash) throw eventErr;
        await provider.waitForTransaction(logTxHash);
      }

      setRecords(r => ({ ...r, [key]: record }));
    } catch (e) {
      setErrors(err => ({ ...err, [key]: e.message }));
    } finally {
      setFetching(null);
    }
  }

  function grantStatus(g) {
    if (g.revoked) return <span className="badge badge-red">Revoked</span>;
    if (g.used) return <span className="badge badge-yellow">Used</span>;
    if (BigInt(Math.floor(Date.now() / 1000)) > g.expiry) return <span className="badge badge-red">Expired</span>;
    return <span className="badge badge-green">Active</span>;
  }

  function canFetch(g) {
    return !g.revoked && !g.used && BigInt(Math.floor(Date.now() / 1000)) <= g.expiry;
  }

  if (loading) return <div className="card empty">Loading grants…</div>;
  if (!grants.length) return <div className="card empty">No grants assigned to you yet.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="section-title" style={{ margin: 0 }}>Grants Assigned to Me</p>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      {grants.map((g) => {
        const key = g.grantId;
        const record = records[key];
        const err = errors[key];

        return (
          <div key={key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span className="mono" style={{ fontSize: '0.8rem' }}>
                  {g.grantId.slice(0, 20)}…
                </span>
              </div>
              {grantStatus(g)}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#374151', marginBottom: 12 }}>
              <p><strong>Patient:</strong> <span className="mono">{g.patientId.slice(0, 20)}…</span></p>
              <p><strong>Hospital:</strong> <span className="mono">{g.hospitalId.slice(0, 20)}…</span></p>
              <p><strong>Expires:</strong> {new Date(Number(g.expiry) * 1000).toLocaleString()}</p>
            </div>

            {err && <div className="alert alert-error">{err}</div>}

            {record ? (
              <div className="record-view">
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Record Content</p>
                <pre>{JSON.stringify(record, null, 2)}</pre>
              </div>
            ) : canFetch(g) && (
              <button
                className="btn btn-primary"
                onClick={() => handleFetch(g)}
                disabled={fetching === key}
              >
                {fetching === key ? (
                  <><span className="spinner" />Fetching (waiting for on-chain log)…</>
                ) : 'Fetch Record'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
