import { useState, useEffect } from 'react';
import { getPointers } from '../contract.js';
import { eciesDecrypt, hexToBytes } from '../crypto.js';

export default function PointerList({ provider, patientId, identity }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId || !identity) return;
    load();
  }, [patientId, identity]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rawPointers = await getPointers(provider, patientId);
      const decoded = await Promise.all(
        rawPointers.map(async (hexPtr, i) => {
          try {
            const bytes = hexToBytes(hexPtr);
            const json = await eciesDecrypt(identity.privateKey, bytes);
            const pointer = JSON.parse(json);
            return { index: i, pointer, raw: hexPtr, error: null };
          } catch {
            return { index: i, pointer: null, raw: hexPtr, error: 'decryption failed' };
          }
        })
      );
      setRecords(decoded);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="card empty">Loading records…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!records.length) return (
    <div className="card empty">
      No records yet. A hospital must add a record for it to appear here.
    </div>
  );

  return (
    <div>
      <p className="section-title">My Medical Records</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Hospital</th>
              <th>Created</th>
              <th>Record Key</th>
            </tr>
          </thead>
          <tbody>
            {records.map(({ index, pointer, error: e }) => (
              <tr key={index}>
                <td>{index}</td>
                <td>
                  {e ? (
                    <span className="badge badge-red">Error</span>
                  ) : (
                    <span className="badge badge-blue">{pointer.recordType}</span>
                  )}
                </td>
                <td className="mono truncate" style={{ maxWidth: 180 }}>
                  {pointer?.hospitalId?.slice(0, 18)}…
                </td>
                <td>{pointer ? new Date(pointer.createdAt).toLocaleDateString() : '—'}</td>
                <td className="mono">{pointer?.recordKey ?? '—'}</td>
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
