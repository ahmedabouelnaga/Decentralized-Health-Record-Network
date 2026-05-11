import { useState, useEffect } from 'react';
import {
  queryGrantsForDoctor,
  getGrant,
  signFetchRequest,
  waitForAccessLogged,
} from '../contract.js';
import { eciesDecrypt, hexToBytes } from '../crypto.js';

const HOSPITAL_SERVER = import.meta.env.VITE_HOSPITAL_SERVER || 'http://localhost:4000';

export default function GrantList({ provider, signer, doctorId, identity }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decryptedPointers, setDecryptedPointers] = useState({});
  const [decrypting, setDecrypting] = useState(null);
  const [records, setRecords] = useState({});
  const [fetching, setFetching] = useState(null);
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

  async function handleDecrypt(grant) {
    const grantKey = grant.grantId;
    setDecrypting(grantKey);
    setErrors(e => ({ ...e, [grantKey]: null }));
    try {
      const pointers = await Promise.all(
        grant.encryptedPointersForDoctor.map(async (encPtr, i) => {
          const ptrBytes = hexToBytes(encPtr);
          const pointerJson = await eciesDecrypt(identity.privateKey, ptrBytes);
          const pointer = JSON.parse(pointerJson);
          return { pointer, index: i };
        })
      );
      setDecryptedPointers(p => ({ ...p, [grantKey]: pointers }));
    } catch (e) {
      setErrors(err => ({ ...err, [grantKey]: e.message }));
    } finally {
      setDecrypting(null);
    }
  }

  async function handleFetch(grant, pointer) {
    const recKey = `${grant.grantId}:${pointer.recordKey}`;
    setFetching(recKey);
    setErrors(e => ({ ...e, [recKey]: null }));
    try {
      const hospitalUrl = pointer.hospitalEndpoint || HOSPITAL_SERVER;
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

      setRecords(r => ({ ...r, [recKey]: record }));
    } catch (e) {
      setErrors(err => ({ ...err, [recKey]: e.message }));
    } finally {
      setFetching(null);
    }
  }

  function grantStatus(g) {
    if (g.revoked) return <span className="badge badge-red">Revoked</span>;
    if (BigInt(Math.floor(Date.now() / 1000)) > g.expiry) return <span className="badge badge-red">Expired</span>;
    return <span className="badge badge-green">Active</span>;
  }

  function canAccess(g) {
    return !g.revoked && BigInt(Math.floor(Date.now() / 1000)) <= g.expiry;
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
        const grantKey = g.grantId;
        const ptrs = decryptedPointers[grantKey];
        const grantErr = errors[grantKey];

        return (
          <div key={grantKey} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: '0.8rem' }}>
                {g.grantId.slice(0, 20)}…
              </span>
              {grantStatus(g)}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#374151', marginBottom: 12 }}>
              <p><strong>Patient:</strong> <span className="mono">{g.patientId.slice(0, 20)}…</span></p>
              <p><strong>Records:</strong> {g.encryptedPointersForDoctor.length}</p>
              <p><strong>Expires:</strong> {new Date(Number(g.expiry) * 1000).toLocaleString()}</p>
            </div>

            {grantErr && <div className="alert alert-error">{grantErr}</div>}

            {canAccess(g) && !ptrs && (
              <button
                className="btn btn-secondary"
                onClick={() => handleDecrypt(g)}
                disabled={decrypting === grantKey}
              >
                {decrypting === grantKey
                  ? <><span className="spinner" />Decrypting…</>
                  : 'View Records'}
              </button>
            )}

            {ptrs && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>Available Records</p>
                {ptrs.map(({ pointer, index }) => {
                  const recKey = `${grantKey}:${pointer.recordKey}`;
                  const record = records[recKey];
                  const recErr = errors[recKey];

                  return (
                    <div key={index} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8 }}>
                      <p style={{ fontSize: '0.8rem', color: '#374151', marginBottom: 6 }}>
                        <strong>Type:</strong> {pointer.recordType ?? '—'} &nbsp;
                        <strong>Key:</strong> <span className="mono">{pointer.recordKey}</span> &nbsp;
                        <strong>Date:</strong> {pointer.createdAt ?? '—'}
                      </p>
                      {recErr && <div className="alert alert-error">{recErr}</div>}
                      {record ? (
                        <div className="record-view">
                          <p style={{ fontWeight: 600, marginBottom: 8 }}>Record Content</p>
                          <pre>{JSON.stringify(record, null, 2)}</pre>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          onClick={() => handleFetch(g, pointer)}
                          disabled={fetching === recKey}
                        >
                          {fetching === recKey
                            ? <><span className="spinner" />Fetching…</>
                            : 'Fetch Record'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
