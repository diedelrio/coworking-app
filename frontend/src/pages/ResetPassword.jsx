import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import { Link } from 'react-router-dom';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const q = useQuery();
  const navigate = useNavigate();

  const token = q.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!token) {
      setError('Token faltante o inválido.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setMsg('Contraseña actualizada. Ya podés iniciar sesión.');
      setTimeout(() => navigate('/login'), 800);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo restablecer la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#f5f7fb',
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        background: '#ffffff',
        borderRadius: 20,
        padding: 28,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        border: '1px solid rgba(15, 23, 42, 0.06)',
      }}
    >
      {/* Logo centrado */}
        <img
          src="/logoCoworking.png"
          alt="Coworking Sinergia"
          style={{ height: 64, width: 'auto', margin: '0 auto 12px', display: 'block' }}
        />
      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.3px',
        }}
      >
        Restablecer contraseña
      </h1>

      <p
        style={{
          marginTop: 10,
          marginBottom: 22,
          color: '#64748b',
          fontSize: 14,
          lineHeight: 1.45,
        }}
      >
        Escribí tu nueva contraseña (mínimo 8 caracteres) y confirmala para finalizar.
      </p>

      {!token ? (
        <>
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: 14,
              padding: 14,
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 18,
            }}
          >
            Token faltante o inválido. Volvé a solicitar el restablecimiento de contraseña.
          </div>

          <Link
            to="/forgot-password"
            style={{
              display: 'inline-block',
              width: '100%',
              textDecoration: 'none',
            }}
          >
            <button
              type="button"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 15,
                color: '#ffffff',
                background: '#4f46e5',
                boxShadow: '0 8px 18px rgba(79, 70, 229, 0.25)',
              }}
            >
              Volver a solicitar enlace
            </button>
          </Link>

          <div style={{ marginTop: 14, fontSize: 13, color: '#64748b' }}>
            <Link
              to="/login"
              style={{
                color: '#4f46e5',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Volver al login
            </Link>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={submit}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                color: '#0f172a',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Nueva contraseña
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              minLength={8}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                padding: '0 14px',
                outline: 'none',
                fontSize: 14,
                color: '#0f172a',
                background: '#ffffff',
                boxShadow: '0 1px 0 rgba(15, 23, 42, 0.02)',
              }}
            />

            <label
              style={{
                display: 'block',
                fontSize: 13,
                color: '#0f172a',
                fontWeight: 600,
                marginTop: 14,
                marginBottom: 8,
              }}
            >
              Confirmar contraseña
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="********"
              required
              minLength={8}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                padding: '0 14px',
                outline: 'none',
                fontSize: 14,
                color: '#0f172a',
                background: '#ffffff',
                boxShadow: '0 1px 0 rgba(15, 23, 42, 0.02)',
              }}
            />

            {error && (
              <div
                style={{
                  marginTop: 12,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {msg && (
              <div
                style={{
                  marginTop: 12,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                }}
              >
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 18,
                width: '100%',
                height: 48,
                borderRadius: 999,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: 15,
                color: '#ffffff',
                opacity: saving ? 0.75 : 1,
                background: '#4f46e5',
                boxShadow: '0 8px 18px rgba(79, 70, 229, 0.25)',
              }}
            >
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>

          <div style={{ marginTop: 14, fontSize: 13, color: '#64748b' }}>
            <Link
              to="/login"
              style={{
                color: '#4f46e5',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Volver al login
            </Link>
          </div>
        </>
      )}
    </div>
  </div>
);
}