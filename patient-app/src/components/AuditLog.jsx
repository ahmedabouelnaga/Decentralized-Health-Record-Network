import { useState, useEffect } from 'react';
import { queryAccessLogs, queryGrantsForPatient, getGrant } from '../contract.js';

export default function AuditLog({ provider, patientId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [patientId]);

  async function load() {
    setLoading(true);
    try {
      const [accessEvents, grantEvents] = await Promise.all([
        queryAccessLogs(provider, patientId),
        queryGrantsForPatient(provider, patientId),
      ]);

      const tier1 = await Promise.all(
        grantEvents.map(async (e) => {
          const block = await provider.getBlock(e.blockNumber);
          return {
            ts: block.timestamp,
            tier: 1,
            label: 'Metadata disclosed (grant created)',
            grantId: e.args.grantId,
            doctorId: e.args.doctorId,
            hospitalId: e.args.hospitalId,
            txHash: e.transactionHash,
          };
        })
      );

      const tier2 = await Promise.all(
        accessEvents.map(async (e) => {
          const block = await provider.getBlock(e.blockNumber);
          return {
            ts: block.timestamp,
            tier: 2,
            label: 'Record fetched (content access)',
            grantId: e.args.grantId,
            hospitalId: e.args.hospitalId,
            recordHash: e.args.recordHash,
            txHash: e.transactionHash,
          };
        })
      );

      const combined = [...tier1, ...tier2].sort((a, b) => b.ts - a.ts);
      setEvents(combined);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="card empty">Loading audit log…</div>;
  if (!events.length) return <div className="card empty">No activity yet.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="section-title" style={{ margin: 0 }}>Audit Log</p>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>
      <div className="card">
        {events.map((e, i) => (
          <div key={i} className="timeline-item">
            <div
              className="timeline-dot"
              style={{ background: e.tier === 1 ? '#f59e0b' : '#1a56db' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {e.tier === 1 ? 'Tier 1' : 'Tier 2'} — {e.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {new Date(Number(e.ts) * 1000).toLocaleString()}
                </span>
              </div>
              <p className="mono" style={{ fontSize: '0.75rem', color: '#374151' }}>
                Grant: {e.grantId?.slice(0, 20)}…
              </p>
              {e.doctorId && (
                <p className="mono" style={{ fontSize: '0.75rem', color: '#374151' }}>
                  Doctor: {e.doctorId.slice(0, 20)}…
                </p>
              )}
              {e.recordHash && (
                <p className="mono" style={{ fontSize: '0.75rem', color: '#374151' }}>
                  Record hash: {e.recordHash.slice(0, 20)}…
                </p>
              )}
              <a
                href={`#tx-${e.txHash}`}
                className="mono"
                style={{ fontSize: '0.7rem', color: '#1a56db' }}
              >
                tx: {e.txHash?.slice(0, 16)}…
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
