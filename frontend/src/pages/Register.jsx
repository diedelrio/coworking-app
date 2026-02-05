import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

export default function Register() {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== password2) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', {
        name,
        lastName,
        phone,
        email,
        password,
      });

      setSuccessMsg('Cuenta creada correctamente. Ahora puedes iniciar sesión.');
      // Opcional: redirigir automáticamente al login después de 1–2 segundos:
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-center">
      <div className="card">
              {/* Logo centrado */}
        <img
          src="/logoCoworking.png"
          alt="Coworking Sinergia"
          style={{ height: 64, width: 'auto', margin: '0 auto 12px', display: 'block' }}
        />
        <h1>Crear cuenta</h1>
        <p>Regístrate para reservar espacios en el coworking.</p>

        {error && <div className="error">{error}</div>}
        {successMsg && (
          <div
            style={{
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
              color: '#166534',
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              required
            />
          </div>

          <div className="form-group">
            <label>Apellidos</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Apellidos"
              required
            />
          </div>

          <div className="form-group">
            <label>Teléfono (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 600 123 123"
            />
          </div>

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

          <div className="form-group">
            <label>Repetir contraseña</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <Link className="link" to="/login">
            Ya tengo cuenta
          </Link>
        </div>
        
      </div>
    </div>
  );
}
