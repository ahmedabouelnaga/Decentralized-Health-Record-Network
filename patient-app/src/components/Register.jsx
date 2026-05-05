export default function Register({ onRegister, loading, error, identity }) {
  return (
    <div className="connect-screen">
      <h2>Create Patient Account</h2>
      <p>
        Register your encryption key on-chain to start managing medical records.
        Your MetaMask wallet will be your identity.
      </p>
      {identity && (
        <div className="card" style={{ width: '100%', maxWidth: 500 }}>
          <p className="section-title">Your Encryption Key</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8 }}>
            Public key (stored on-chain):
          </p>
          <p className="mono truncate" style={{ color: '#374151' }}>{identity.publicKey}</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 12 }}>
            Private key (stored in browser only — never leaves this device):
          </p>
          <p className="mono truncate" style={{ color: '#374151' }}>
            {identity.privateKey.slice(0, 18)}…
          </p>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" onClick={onRegister} disabled={loading}>
        {loading && <span className="spinner" />}
        Register as Patient
      </button>
    </div>
  );
}
