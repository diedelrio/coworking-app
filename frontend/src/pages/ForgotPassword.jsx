import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {
      // respuesta genérica para no filtrar info
      setDone(true);
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
        Olvidé mi contraseña
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
        Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      {done ? (
        <>
          <div
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 14,
              color: '#0f172a',
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 18,
            }}
          >
            Si el email existe, te enviaremos instrucciones para restablecer tu contraseña.
          </div>

          <Link
            to="/login"
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
              Volver al login
            </button>
          </Link>
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
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuemail@ejemplo.com"
              required
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
                  marginTop: 10,
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
      
            <button
              type="submit"
              style={{
                marginTop: 18,
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
              Enviar enlace
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