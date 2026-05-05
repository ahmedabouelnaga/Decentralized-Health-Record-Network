import { useState, useEffect, useCallback } from 'react';
import { connectWallet, getPatientId, registerPatient, subscribeToMessages } from './contract.js';
import { loadOrCreateIdentity } from './crypto.js';
import Register from './components/Register.jsx';
import PointerList from './components/PointerList.jsx';
import GrantList from './components/GrantList.jsx';
import CreateGrant from './components/CreateGrant.jsx';
import Inbox from './components/Inbox.jsx';
import AuditLog from './components/AuditLog.jsx';

const TABS = ['Records', 'Grants', 'Inbox', 'Audit Log'];

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [patientId, setPatientId] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [tab, setTab] = useState('Records');
  const [inboxMessages, setInboxMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setError('');
    setLoading(true);
    try {
      const { provider, signer } = await connectWallet();
      const addr = await signer.getAddress();
      const pid = await getPatientId(signer);
      const id = loadOrCreateIdentity();
      setWallet({ provider, signer, address: addr });
      setPatientId(pid);
      setIdentity(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const pid = await registerPatient(wallet.signer, identity.publicKey);
      setPatientId(pid);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addInboxMessage = useCallback((msg) => {
    setInboxMessages(prev => [msg, ...prev]);
  }, []);

  useEffect(() => {
    if (!wallet?.provider || !patientId) return;
    const unsub = subscribeToMessages(wallet.provider, patientId, addInboxMessage);
    return () => { unsub.then(fn => fn()); };
  }, [wallet, patientId, addInboxMessage]);

  if (!wallet) {
    return (
      <div>
        <div className="header"><h1>Patient Portal</h1></div>
        <div className="container">
          <div className="connect-screen">
            <h2>Health Record Network</h2>
            <p>Connect your MetaMask wallet to access your medical records.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
              {loading && <span className="spinner" />}
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patientId) {
    return (
      <div>
        <div className="header">
          <h1>Patient Portal</h1>
          <span className="wallet-info">{wallet.address}</span>
        </div>
        <div className="container">
          <Register
            onRegister={handleRegister}
            loading={loading}
            error={error}
            identity={identity}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h1>Patient Portal</h1>
        <span className="wallet-info">{wallet.address}</span>
      </div>
      <div className="container">
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Records' && (
          <PointerList
            provider={wallet.provider}
            signer={wallet.signer}
            patientId={patientId}
            identity={identity}
          />
        )}
        {tab === 'Grants' && (
          <>
            <CreateGrant
              provider={wallet.provider}
              signer={wallet.signer}
              patientId={patientId}
              identity={identity}
            />
            <GrantList
              provider={wallet.provider}
              signer={wallet.signer}
              patientId={patientId}
            />
          </>
        )}
        {tab === 'Inbox' && (
          <Inbox
            provider={wallet.provider}
            signer={wallet.signer}
            patientId={patientId}
            identity={identity}
            liveMessages={inboxMessages}
          />
        )}
        {tab === 'Audit Log' && (
          <AuditLog provider={wallet.provider} patientId={patientId} />
        )}
      </div>
    </div>
  );
}
