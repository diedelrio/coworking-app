// frontend/src/pages/AdminSpaces.jsx
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import api from '../api/axiosClient';
import { getCurrentUser } from '../utils/auth';
import Layout from '../components/Layout';

const SPACE_TYPES = [
  { value: 'FIX_DESK', label: 'Puesto fijo' },
  { value: 'FLEX_DESK', label: 'Puesto flex' },
  { value: 'MEETING_ROOM', label: 'Sala de reuniones' },
];

export default function AdminSpaces() {
  const user = getCurrentUser();

  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    type: 'FLEX_DESK',
    capacity: 1,
    description: '',
    active: true,
  });

  async function loadSpaces() {
    try {
      setLoading(true);
      const res = await api.get('/spaces');
      setSpaces(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Error al cargar los espacios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpaces();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: '',
      type: 'FLEX_DESK',
      capacity: 1,
      description: '',
      active: true,
    });
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleEdit(space) {
    setEditingId(space.id);
    setForm({
      name: space.name,
      type: space.type,
      capacity: space.capacity,
      description: space.description || '',
      active: space.active,
    });
  }

  async function handleToggleActive(space) {
    try {
      // usamos PUT normal cambiando solo el campo active
      await api.put(`/spaces/${space.id}`, {
        name: space.name,
        type: space.type,
        capacity: space.capacity,
        description: space.description,
        active: !space.active,
      });
      await loadSpaces();
    } catch (err) {
      console.error(err);
      setError('No se pudo cambiar el estado del espacio');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        capacity: Number(form.capacity),
        description: form.description.trim() || null,
        active: form.active,
      };

      if (!payload.name) {
        setError('El nombre es obligatorio');
        setSaving(false);
        return;
      }

      if (!payload.capacity || payload.capacity < 1) {
        setError('La capacidad debe ser un número mayor o igual a 1');
        setSaving(false);
        return;
      }

      if (editingId) {
        await api.put(`/spaces/${editingId}`, payload);
      } else {
        await api.post('/spaces', payload);
      }

      resetForm();
      await loadSpaces();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          'Error al guardar el espacio'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user || user.role !== 'ADMIN') {
    // la ruta ya estará protegida, pero por si acaso
    return null;
  }

  return (
   
      <Layout user={user}>

      <div className="admin-page" style={{ padding: '1.5rem 1rem 2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Gestión de espacios</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Crea, edita y activa / desactiva los espacios del coworking.
            </span>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <div
          className="admin-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: '1.5rem',
          }}
        >
          {/* LISTA DE ESPACIOS */}
          <div className="admin-card">
            <h2 style={{ marginBottom: '1rem' }}>Espacios</h2>

            {loading ? (
              <div>Cargando espacios...</div>
            ) : spaces.length === 0 ? (
              <div>No hay espacios creados aún.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Capacidad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {spaces.map(space => (
                    <tr key={space.id}>
                      <td>{space.name}</td>
                      <td>
                        {SPACE_TYPES.find(t => t.value === space.type)
                          ?.label || space.type}
                      </td>
                      <td>{space.capacity}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: space.active ? '#dcfce7' : '#fee2e2',
                            color: space.active ? '#166534' : '#991b1b',
                          }}
                        >
                          {space.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-small btn-outline"
                          onClick={() => handleEdit(space)}
                          style={{ marginRight: '0.5rem' }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-small btn-danger"
                          onClick={() => handleToggleActive(space)}
                        >
                          {space.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* FORMULARIO CREAR / EDITAR */}
          <div className="admin-card">
 <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
              {editingId ? 'Editar espacio' : 'Nuevo espacio'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ej: Sala de Reuniones"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                  }}
                >
                  {SPACE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Capacidad</label>
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Descripción opcional del espacio"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active}
                    onChange={handleChange}
                    style={{ marginRight: '0.4rem' }}
                  />
                  Espacio activo
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  className="button"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : editingId
                    ? 'Guardar cambios'
                    : 'Crear espacio'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="button"
                    onClick={resetForm}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
      </Layout>
   
  );
}
