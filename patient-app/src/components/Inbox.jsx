import { useState, useEffect } from 'react';
import { pastMessages, addPointer, MSG_POINTER_HANDOFF, MSG_ACCESS_REQUEST } from '../contract.js';
import { eciesDecrypt, hexToBytes, bytesToHex } from '../crypto.js';

export default function Inbox({ provider, signer, patientId, identity, liveMessages }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadPast(); }, [patientId]);

  useEffect(() => {
    if (!liveMessages.length) return;
    processMessages(liveMessages).then(decoded => {
      setItems(prev => [...decoded, ...prev]);
    });
  }, [liveMessages]);

  async function loadPast() {
    setLoading(true);
    try {
      const events = await pastMessages(provider, patientId);
      const payloads = events.map(e => ({
        messageType: e.args.messageType,
        payload: e.args.payload,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      }));
      const decoded = await processMessages(payloads);
      setItems(decoded);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function processMessages(msgs) {
    const results = await Promise.all(
      msgs.map(async (m) => {
        try {
          const raw = m.payload;
          const payloadBytes = typeof raw === 'string' ? hexToBytes(raw) : Uint8Array.from(raw);
          const json = await eciesDecrypt(identity.privateKey, payloadBytes);
          const data = JSON.parse(json);
          return {
            id: m.txHash ?? String(Math.random()),
            type: m.messageType,
            data,
          };
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean);
  }

  async function acceptHandoff(item) {
    const key = item.id;
    setActing(key);
    try {
      const encPointerBytes = hexToBytes(item.data.encryptedPointer);
      await addPointer(signer, encPointerBytes);
      setStatuses(s => ({ ...s, [key]: 'Accepted — record added to your list.' }));
    } catch (e) {
      setStatuses(s => ({ ...s, [key]: `Error: ${e.message}` }));
    } finally {
      setActing(null);
    }
  }

  function renderItem(item) {
    const isHandoff = item.type === MSG_POINTER_HANDOFF;
    const isRequest = item.type === MSG_ACCESS_REQUEST;
    const status = statuses[item.id];

    return (
      <div key={item.id} className="inbox-item">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h4>
            {isHandoff ? 'New Record Available' : isRequest ? 'Access Request' : 'Encrypted Message'}
          </h4>
          {isHandoff && <span className="badge badge-blue">Handoff</span>}
          {isRequest && <span className="badge badge-yellow">Request</span>}
        </div>

        {isHandoff && (
          <div style={{ fontSize: '0.8rem', color: '#374151', marginBottom: 12 }}>
            <p><strong>Type:</strong> {item.data.recordTypePreview}</p>
            <p><strong>Hospital:</strong>{' '}
              <span className="mono">{item.data.hospitalId?.slice(0, 22)}…</span>
            </p>
            <p><strong>Date:</strong> {new Date(item.data.createdAtPreview).toLocaleDateString()}</p>
          </div>
        )}

        {isRequest && (
          <div style={{ fontSize: '0.8rem', color: '#374151', marginBottom: 12 }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>Doctor:</strong>{' '}
              <span className="mono">{item.data.doctorId?.slice(0, 22)}…</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => {
                  navigator.clipboard.writeText(item.data.doctorId);
                  setCopied(item.id);
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === item.id ? 'Copied!' : 'Copy ID'}
              </button>
            </p>
            <p><strong>Justification:</strong> {item.data.justification}</p>
            <p><strong>Requested types:</strong> {item.data.requestedRecordTypes?.join(', ')}</p>
          </div>
        )}

        {status && <div className="alert alert-success" style={{ marginBottom: 8 }}>{status}</div>}

        {!status && isHandoff && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.8rem' }}
              onClick={() => acceptHandoff(item)}
              disabled={acting === item.id}
            >
              {acting === item.id ? 'Accepting…' : 'Accept'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
              onClick={() => setStatuses(s => ({ ...s, [item.id]: 'Rejected.' }))}
            >
              Reject
            </button>
          </div>
        )}

        {!status && isRequest && (
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Go to the <strong>Grants</strong> tab to create a grant for this doctor.
          </p>
        )}
      </div>
    );
  }

  if (loading) return <div className="card empty">Loading inbox…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="section-title" style={{ margin: 0 }}>Inbox</p>
        <button className="btn btn-secondary" onClick={loadPast}>Refresh</button>
      </div>
      {!items.length && <div className="card empty">No messages yet.</div>}
      {items.map(renderItem)}
    </div>
  );
}
