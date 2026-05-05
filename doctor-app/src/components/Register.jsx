export default function Register({ onRegister, loading, error, identity }) {
  return (
    <div className="connect-screen">
      <h2>Create Doctor Account</h2>
      <p>
        Register your encryption key on-chain to receive patient record grants.
      </p>
      {identity && (
        <div className="card" style={{ width: '100%', maxWidth: 500 }}>
          <p className="section-title">Your Encryption Key</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8 }}>
            Public key (stored on-chain):
          </p>
          <p className="mono truncate" style={{ color: '#374151' }}>{identity.publicKey}</p>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" onClick={onRegister} disabled={loading}>
        {loading && <span className="spinner" />}
        Register as Doctor
      </button>
    </div>
  );
}
