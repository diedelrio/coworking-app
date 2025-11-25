import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
      <div className="card">
        <h1>Coworking Sinergia</h1>
        <p>Inicia sesión para gestionar tus reservas.</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
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

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <Link className="link" to="/register">
            Crear cuenta
          </Link>
          <span className="link" style={{ cursor: 'pointer', opacity: 0.7 }}>
            Olvidé mi contraseña
          </span>
        </div>
      </div>
    </div>
  );
}
