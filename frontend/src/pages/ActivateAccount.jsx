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
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    const run = async () => {
      setMessage('');
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

  const resend = async (e) => {
    e?.preventDefault?.();
    setLoadingAction(true);
    setMessage('');
    try {
      await api.post('/auth/activate/resend', { email });
      setMessage('Te enviamos un nuevo enlace de activación. Revisá tu email.');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'No se pudo reenviar. Intentá nuevamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  const complete = async (e) => {
    e?.preventDefault?.();
    setMessage('');

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
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'TOKEN_EXPIRED') {
        setStatus('expired');
        setMessage('El enlace expiró. Podés generar uno nuevo.');
      } else {
        setMessage(err?.response?.data?.message || 'No se pudo activar la cuenta.');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="app-center">
      <div className="card">
        <h1>Coworking Sinergia</h1>
        <p style={{ marginTop: 6 }}>
          {status === 'loading' && 'Validando enlace...'}
          {status === 'invalid' && 'El enlace no es válido.'}
          {status === 'already_active' && 'Tu cuenta ya está activa.'}
          {status === 'expired' && 'Tu enlace expiró.'}
          {status === 'ok' && 'Activación de cuenta'}
          {status === 'done' && 'Cuenta activada'}
        </p>

        {status === 'invalid' && (
          <div style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigate('/login')}>
              Ir al login
            </button>
          </div>
        )}

        {status === 'already_active' && (
          <div style={{ marginTop: 12 }}>
            <p>
              La cuenta {email ? <b>{email}</b> : ''} ya está activa.
            </p>
            <button className="button" onClick={() => navigate('/login')} style={{ marginTop: 10 }}>
              Ir al login
            </button>
          </div>
        )}

        {status === 'expired' && (
          <form onSubmit={resend} style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 10 }}>
              Podés generar uno nuevo para {email ? <b>{email}</b> : 'tu email'}.
            </p>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@ejemplo.com"
                required
              />
            </div>

            {message && <div className="info" style={{ marginBottom: 10 }}>{message}</div>}

            <button className="button" type="submit" disabled={loadingAction || !email}>
              {loadingAction ? 'Enviando...' : 'Reenviar enlace'}
            </button>
          </form>
        )}

        {status === 'ok' && (
          <form onSubmit={complete} style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}>
              Hola {name ? <b>{name}</b> : ''}. Creá tu contraseña para activar{' '}
              {email ? <b>{email}</b> : ''}.
            </p>

            <div className="form-group">
              <label>Nueva contraseña</label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  // evita submits raros mientras escribís
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>

            <div className="form-group">
              <label>Repetir contraseña</label>
              <input
                type="password"
                name="repeat-password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="Repetí la contraseña"
                required
              />
            </div>

            {message && <div className="error" style={{ marginBottom: 10 }}>{message}</div>}

            <button className="button" type="submit" disabled={loadingAction}>
              {loadingAction ? 'Activando...' : 'Activar cuenta'}
            </button>
          </form>
        )}

        {status === 'done' && (
          <div style={{ marginTop: 12 }}>
            <div className="success" style={{ marginBottom: 12 }}>
              ¡Listo! Tu cuenta fue activada.
            </div>
            <button className="button" onClick={() => navigate('/login')}>
              Ir al login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
