import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

export default function Register() {
  const [name, setName]           = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    if (password !== password2) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', { name, lastName, phone, email, password });
      setSuccessMsg('Cuenta creada. Redirigiendo al login…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sn-auth-shell">
      <div className="sn-auth-panel" style={{ maxWidth: 480 }}>
        <div className="sn-auth-card">
          <img src="/logoCoworking.png" alt="Coworking Sinergia" className="sn-auth-logo" />
          <h1>Crear cuenta</h1>
          <p>Regístrate para reservar espacios en el coworking.</p>

          {error      && <div className="sn-alert sn-alert--error"   style={{ marginBottom: '1rem' }}>{error}</div>}
          {successMsg && <div className="sn-alert sn-alert--success" style={{ marginBottom: '1rem' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="sn-field">
              <label className="sn-label">Nombre *</label>
              <input className="sn-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan" required />
            </div>
            <div className="sn-field">
              <label className="sn-label">Apellidos *</label>
              <input className="sn-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="García" required />
            </div>
            <div className="sn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sn-label">Teléfono <span style={{ fontWeight: 400, color: 'var(--sn-muted)' }}>(opcional)</span></label>
              <input className="sn-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 123 456" />
            </div>
            <div className="sn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sn-label">Email *</label>
              <input className="sn-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tuemail@ejemplo.com" required autoComplete="email" />
            </div>
            <div className="sn-field">
              <label className="sn-label">Contraseña *</label>
              <input className="sn-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <div className="sn-field">
              <label className="sn-label">Repetir contraseña *</label>
              <input className="sn-input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" required />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="sn-auth-btn" type="submit" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </div>
          </form>

          <div className="sn-auth-links" style={{ justifyContent: 'center' }}>
            <Link className="sn-auth-link" to="/login">Ya tengo cuenta → Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
