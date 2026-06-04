import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/axiosClient';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [loginTextMd, setLoginTextMd] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.get('/public/content', { params: { keys: 'TEXT_LOGIN' } })
      .then((res) => { if (!cancelled) setLoginTextMd(res?.data?.content?.TEXT_LOGIN || ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate(res.data.user.role === 'ADMIN' ? '/admin' : '/user');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sn-auth-shell">
      <div className="sn-auth-panel">
        <div className="sn-auth-card">
          <img src="/logoCoworking.png" alt="Coworking Sinergia" className="sn-auth-logo" />
          <h1>Bienvenido de nuevo</h1>
          <p>Iniciá sesión para gestionar tus reservas.</p>

          {error && (
            <div className="sn-alert sn-alert--error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div className="sn-field">
              <label className="sn-label" htmlFor="sinergia-login-email">Email</label>
              <input
                id="sinergia-login-email"
                name="sinergia-login-email"
                className="sn-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@ejemplo.com"
                required
                autoComplete="username"
              />
            </div>

            <div className="sn-field">
              <label className="sn-label" htmlFor="sinergia-login-password">Contraseña</label>
              <input
                id="sinergia-login-password"
                name="sinergia-login-password"
                className="sn-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button className="sn-auth-btn" type="submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {loginTextMd && (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--sn-muted)' }}>
              <ReactMarkdown
                components={{
                  a: (props) => <a {...props} style={{ color: 'var(--sn-green)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />,
                  p: (props) => <p {...props} style={{ margin: '4px 0' }} />,
                  strong: (props) => <strong {...props} style={{ fontWeight: 700 }} />,
                }}
              >
                {loginTextMd}
              </ReactMarkdown>
            </div>
          )}

          <div className="sn-auth-links">
            <Link className="sn-auth-link" to="/register">Crear cuenta</Link>
            <Link className="sn-auth-link" to="/forgot-password">Olvidé mi contraseña</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
