import { useState, useEffect } from 'react';
import { queryGrantsForPatient, getGrant, revokeGrant } from '../contract.js';
import { ethers } from 'ethers';

export default function GrantList({ provider, signer, patientId }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [patientId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const events = await queryGrantsForPatient(provider, patientId);
      const details = await Promise.all(
        events.map(async (e) => {
          const g = await getGrant(provider, e.args.grantId);
          return g;
        })
      );
      setGrants(details);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(grantId) {
    setRevoking(grantId);
    try {
      await revokeGrant(signer, grantId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRevoking(null);
    }
  }

  function grantStatus(g) {
    if (g.revoked) return <span className="badge badge-red">Revoked</span>;
    if (BigInt(Math.floor(Date.now() / 1000)) > g.expiry) return <span className="badge badge-red">Expired</span>;
    return <span className="badge badge-green">Active</span>;
  }

  if (loading) return <div className="card empty">Loading grants…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!grants.length) return <div className="card empty">No grants issued yet.</div>;

  return (
    <div>
      <p className="section-title">Active Grants</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Grant ID</th>
              <th>Doctor</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.grantId}>
                <td className="mono" style={{ maxWidth: 140 }}>{g.grantId.slice(0, 14)}…</td>
                <td className="mono" style={{ maxWidth: 140 }}>{g.doctorId.slice(0, 14)}…</td>
                <td>{new Date(Number(g.expiry) * 1000).toLocaleDateString()}</td>
                <td>{grantStatus(g)}</td>
                <td>
                  {!g.revoked && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => handleRevoke(g.grantId)}
                      disabled={revoking === g.grantId}
                    >
                      {revoking === g.grantId ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-secondary" onClick={load} style={{ marginTop: 8 }}>
        Refresh
      </button>
    </div>
  );
}
