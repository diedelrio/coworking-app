import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

export default function ActivateAccount() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token') || '', [params]);

  const [status, setStatus] = useState('loading'); // loading | ok | expired | already_active | invalid | done
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }
      try {
        const res = await api.get('/auth/activate/validate', { params: { token } });
        if (res.data?.status === 'already_active') {
          setStatus('already_active');
          setEmail(res.data?.email || '');
        } else {
          setStatus('ok');
          setEmail(res.data?.email || '');
          setName(res.data?.name || '');
        }
      } catch (e) {
        const code = e?.response?.data?.code;
        if (code === 'TOKEN_EXPIRED') {
          setStatus('expired');
          setEmail(e?.response?.data?.email || '');
        } else {
          setStatus('invalid');
        }
      }
    };
    run();
  }, [token]);

  const resend = async () => {
    setLoadingAction(true);
    setMessage(null);
    try {
      await api.post('/auth/activate/resend', { email });
      setMessage('Te enviamos un nuevo enlace de activación. Revisá tu email.');
    } catch (e) {
      setMessage(e?.response?.data?.message || 'No se pudo reenviar. Intenta nuevamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  const complete = async () => {
    setMessage(null);
    if (!password || password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoadingAction(true);
    try {
      await api.post('/auth/activate/complete', { token, password });
      setStatus('done');
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === 'TOKEN_EXPIRED') {
        setStatus('expired');
      } else {
        setMessage(e?.response?.data?.message || 'No se pudo activar la cuenta.');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const Card = ({ children }) => (
    <div style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 16, minHeight: '100vh', background: '#f3f4f6' }}>
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Activación de cuenta</h1>

        {status === 'loading' && <p>Cargando...</p>}

        {status === 'invalid' && (
          <>
            <p style={{ marginBottom: 12 }}>El enlace no es válido.</p>
            <button onClick={() => navigate('/login')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#111827', color: '#fff' }}>
              Ir al login
            </button>
          </>
        )}

        {status === 'already_active' && (
          <>
            <p style={{ marginBottom: 12 }}>La cuenta {email ? <b>{email}</b> : ''} ya está activa.</p>
            <button onClick={() => navigate('/login')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#111827', color: '#fff' }}>
              Ir al login
            </button>
          </>
        )}

        {status === 'expired' && (
          <>
            <p style={{ marginBottom: 12 }}>Tu enlace expiró. Podés generar uno nuevo para {email ? <b>{email}</b> : 'tu email'}.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              />
              <button
                disabled={loadingAction || !email}
                onClick={resend}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#111827', color: '#fff', opacity: loadingAction || !email ? 0.6 : 1 }}
              >
                Reenviar
              </button>
            </div>
            {message && <div style={{ padding: 10, borderRadius: 10, background: '#ecfeff', border: '1px solid #a5f3fc' }}>{message}</div>}
          </>
        )}

        {status === 'ok' && (
          <>
            <p style={{ marginBottom: 12 }}>Hola {name ? <b>{name}</b> : ''}. Creá tu contraseña para activar la cuenta {email ? <b>{email}</b> : ''}.</p>

            <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              />
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repetir contraseña"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              />
              <button
                disabled={loadingAction}
                onClick={complete}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#111827', color: '#fff', opacity: loadingAction ? 0.6 : 1 }}
              >
                Activar cuenta
              </button>
            </div>

            {message && <div style={{ padding: 10, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>{message}</div>}
          </>
        )}

        {status === 'done' && (
          <>
            <p style={{ marginBottom: 12 }}>¡Listo! Tu cuenta fue activada.</p>
            <button onClick={() => navigate('/login')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#111827', color: '#fff' }}>
              Ir al login
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
