import { useState } from 'react';
import { connectWallet, getDoctorId, registerDoctor } from './contract.js';
import { loadOrCreateIdentity } from './crypto.js';
import Register from './components/Register.jsx';
import GrantList from './components/GrantList.jsx';
import AccessRequest from './components/AccessRequest.jsx';

const TABS = ['My Grants', 'Request Access'];

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [tab, setTab] = useState('My Grants');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setError('');
    setLoading(true);
    try {
      const { provider, signer } = await connectWallet();
      const addr = await signer.getAddress();
      const did = await getDoctorId(signer);
      const id = loadOrCreateIdentity();
      setWallet({ provider, signer, address: addr });
      setDoctorId(did);
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
      const did = await registerDoctor(wallet.signer, identity.publicKey);
      setDoctorId(did);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div>
        <div className="header"><h1>Doctor Portal</h1></div>
        <div className="container">
          <div className="connect-screen">
            <h2>Health Record Network</h2>
            <p>Connect your MetaMask wallet to access patient records you've been granted.</p>
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

  if (!doctorId) {
    return (
      <div>
        <div className="header">
          <h1>Doctor Portal</h1>
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
        <h1>Doctor Portal</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span className="wallet-info">{wallet.address}</span>
          <span className="wallet-info" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
            Doctor ID: {doctorId}
          </span>
        </div>
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

        {tab === 'My Grants' && (
          <GrantList
            provider={wallet.provider}
            signer={wallet.signer}
            doctorId={doctorId}
            identity={identity}
          />
        )}
        {tab === 'Request Access' && (
          <AccessRequest
            provider={wallet.provider}
            signer={wallet.signer}
            doctorId={doctorId}
            identity={identity}
          />
        )}
      </div>
    </div>
  );
}
