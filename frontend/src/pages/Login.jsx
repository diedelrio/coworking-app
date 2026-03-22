import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/axiosClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Texto dinámico (Markdown) desde reglas de negocio
  const [loginTextMd, setLoginTextMd] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadPublicContent() {
      try {
        // Endpoint público que debe devolver: { content: { TEXT_LOGIN: "..." } }
        const res = await api.get('/public/content', {
          params: { keys: 'TEXT_LOGIN' },
        });

        const md = res?.data?.content?.TEXT_LOGIN || '';
        if (!cancelled) setLoginTextMd(md);
      } catch (e) {
        // Silencioso: si falla, no rompe la pantalla de login
        if (!cancelled) setLoginTextMd('');
      }
    }

    loadPublicContent();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-center">
      <div className="card" style={{ textAlign: 'center' }}>
        {/* Logo centrado */}
        <img
          src="/logoCoworking.png"
          alt="Coworking Sinergia"
          style={{ height: 64, width: 'auto', margin: '0 auto 12px', display: 'block' }}
        />

        <h1 style={{ marginTop: 0 }}>Coworking Sinergia</h1>

        {/* Texto fijo (si querés, lo podés eliminar y dejar solo el Markdown) */}
        <p style={{ marginTop: 6 }}>Inicia sesión para gestionar tus reservas.</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
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

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        {/* Texto dinámico desde reglas (Markdown) */}
        {loginTextMd ? (
          <div style={{ marginTop: 10, marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#555', textAlign: 'justify', marginTop: 16 }}>
            <ReactMarkdown
              components={{
                a: (props) => (
                  <a
                    {...props}
                    className="link"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline' }}
                  />
                ),
                ul: (props) => (
                  <ul {...props} style={{ textAlign: 'left', margin: '8px auto', paddingLeft: 18, maxWidth: 360 }} />
                ),
                ol: (props) => (
                  <ol {...props} style={{ textAlign: 'left', margin: '8px auto', paddingLeft: 18, maxWidth: 360 }} />
                ),
                strong: (props) => <strong {...props} style={{ fontWeight: 700 }} />,
                p: (props) => <p {...props} style={{ margin: '6px 0' }} />,
              }}
            >
              {loginTextMd}
            </ReactMarkdown>
          </div>
          </div>
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <Link className="link" to="/register">
            Crear cuenta
          </Link>
          <Link className="link" to="/forgot-password">
            Olvidé mi contraseña
          </Link>
        </div>

      </div>
    </div>
  );
}
