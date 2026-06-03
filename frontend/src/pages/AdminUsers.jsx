import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiSearch, FiUserPlus, FiUsers } from 'react-icons/fi';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import AdminUsersWithoutClassify from '../components/AdminUsersWithoutClassify';

function getInitials(user) {
  const first = (user?.name || '').trim()[0] || '';
  const last = (user?.lastName || '').trim()[0] || '';
  const email = (user?.email || '').trim()[0] || '';
  return (first + last || email || 'U').toUpperCase();
}

function fullName(user) {
  return `${user?.name || ''} ${user?.lastName || ''}`.trim() || 'Sin nombre';
}

function getUserTags(user) {
  if (!Array.isArray(user?.userTags)) return [];
  return user.userTags.map((ut) => ut?.tag).filter(Boolean);
}

function RoleBadge({ role }) {
  const isAdmin = role === 'ADMIN';
  return <span className={`admin-crm-badge ${isAdmin ? 'admin-crm-badge--purple' : 'admin-crm-badge--slate'}`}>{isAdmin ? 'Admin' : 'Cliente'}</span>;
}

function StatusBadge({ active }) {
  return <span className={`admin-crm-badge ${active ? 'admin-crm-badge--green' : 'admin-crm-badge--red'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

function ClassifyBadge({ classify }) {
  const value = classify || 'SIN_CLASIFICAR';
  const labelMap = {
    GOOD: 'Premium',
    REGULAR: 'Regular',
    BAD: 'Bloqueado',
    SIN_CLASIFICAR: 'Sin clasificar',
  };
  const toneMap = {
    GOOD: 'admin-crm-badge--green',
    REGULAR: 'admin-crm-badge--blue',
    BAD: 'admin-crm-badge--red',
    SIN_CLASIFICAR: 'admin-crm-badge--amber',
  };
  return <span className={`admin-crm-badge ${toneMap[value] || 'admin-crm-badge--slate'}`}>{labelMap[value] || value}</span>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [classifyFilter, setClassifyFilter] = useState('ALL');

  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/users');
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    const action = user.active ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Seguro que quieres ${action} a ${user.email}?`)) return;

    try {
      setSavingId(user.id);
      setError('');
      const response = await api.put(`/users/${user.id}`, { active: !user.active });
      const updated = response.data || {};
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del usuario.');
    } finally {
      setSavingId(null);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    const unclassified = users.filter((u) => !u.classify).length;
    return { total, active, admins, unclassified };
  }, [users]);

  const tagOptions = useMemo(() => {
    const byId = new Map();
    users.forEach((u) => getUserTags(u).forEach((tag) => {
      if (tag?.id) byId.set(tag.id, tag);
    }));
    return Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users]);

  const [tagFilter, setTagFilter] = useState('ALL');

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const tags = getUserTags(user);
      const matchesSearch = !query || `${user.name || ''} ${user.lastName || ''} ${user.email || ''} ${user.phone || ''} ${tags.map((t) => t.name).join(' ')}`
        .toLowerCase()
        .includes(query);

      const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? user.active : !user.active;
      const matchesRole = roleFilter === 'ALL' ? true : user.role === roleFilter;
      const matchesClassify = classifyFilter === 'ALL' ? true : classifyFilter === 'EMPTY' ? !user.classify : user.classify === classifyFilter;
      const matchesTag = tagFilter === 'ALL' ? true : tags.some((tag) => String(tag.id) === String(tagFilter));

      return matchesSearch && matchesStatus && matchesRole && matchesClassify && matchesTag;
    });
  }, [users, searchTerm, statusFilter, roleFilter, classifyFilter, tagFilter]);

  return (
    <Layout>
      <div className="admin-page admin-crm-page">
        <section className="admin-crm-hero">
          <div>
            <p className="admin-crm-eyebrow">Administración</p>
            <h1>Usuarios</h1>
            <p>Consulta, segmenta y administra las cuentas del coworking desde una vista más clara tipo CRM.</p>
          </div>
          <button type="button" className="admin-crm-primary" onClick={() => navigate('/admin/usuarios/nuevo')}>
            <FiUserPlus /> Nuevo usuario
          </button>
        </section>

        <section className="admin-crm-stats">
          <article className="admin-crm-stat-card"><span>Total usuarios</span><strong>{stats.total}</strong></article>
          <article className="admin-crm-stat-card"><span>Activos</span><strong>{stats.active}</strong></article>
          <article className="admin-crm-stat-card"><span>Administradores</span><strong>{stats.admins}</strong></article>
          <article className="admin-crm-stat-card"><span>Sin clasificar</span><strong>{stats.unclassified}</strong></article>
        </section>

        <div className="admin-crm-alert-wrap">
          <AdminUsersWithoutClassify />
        </div>

        <section className="admin-crm-card admin-crm-filters">
          <div className="admin-crm-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="admin-crm-filter-grid">
            <label>
              Estado
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Activos</option>
                <option value="INACTIVE">Inactivos</option>
              </select>
            </label>
            <label>
              Rol
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="ALL">Todos</option>
                <option value="ADMIN">Admin</option>
                <option value="CLIENT">Cliente</option>
              </select>
            </label>
            <label>
              Clasificación
              <select value={classifyFilter} onChange={(e) => setClassifyFilter(e.target.value)}>
                <option value="ALL">Todas</option>
                <option value="GOOD">Premium</option>
                <option value="REGULAR">Regular</option>
                <option value="BAD">Bloqueado</option>
                <option value="EMPTY">Sin clasificar</option>
              </select>
            </label>
            <label>
              Tag
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="ALL">Todos</option>
                {tagOptions.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
            </label>
          </div>

          <div className="admin-crm-filter-footer">
            <span>{filteredUsers.length} usuario{filteredUsers.length === 1 ? '' : 's'} encontrado{filteredUsers.length === 1 ? '' : 's'}</span>
            <button type="button" className="admin-crm-secondary" onClick={fetchUsers} disabled={loading}>
              <FiRefreshCw /> {loading ? 'Cargando...' : 'Recargar'}
            </button>
          </div>
        </section>

        {error ? <div className="admin-crm-message admin-crm-message--error">{error}</div> : null}

        <section className="admin-crm-card">
          <div className="admin-crm-card-head">
            <div>
              <h2>Listado de usuarios</h2>
              <p>Vista compacta con estado, rol, clasificación y tags principales.</p>
            </div>
            {savingId ? <span className="admin-crm-saving">Guardando cambios...</span> : null}
          </div>

          {loading ? (
            <div className="admin-crm-empty"><FiUsers /><strong>Cargando usuarios...</strong></div>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-crm-empty"><FiUsers /><strong>No hay usuarios para mostrar</strong><p>Cambia los filtros o crea un nuevo usuario.</p></div>
          ) : (
            <div className="admin-crm-user-list">
              {filteredUsers.map((user) => {
                const tags = getUserTags(user);
                return (
                  <article key={user.id} className="admin-crm-user-row">
                    <div className="admin-crm-avatar">{getInitials(user)}</div>
                    <div className="admin-crm-user-main">
                      <div className="admin-crm-user-title">
                        <button type="button" onClick={() => navigate(`/admin/usuarios/${user.id}`)}>{fullName(user)}</button>
                        <StatusBadge active={user.active} />
                      </div>
                      <div className="admin-crm-user-meta">
                        <span>{user.email || 'Sin email'}</span>
                        <span>{user.phone || 'Sin teléfono'}</span>
                      </div>
                      <div className="admin-crm-chip-row">
                        <RoleBadge role={user.role} />
                        <ClassifyBadge classify={user.classify} />
                        {tags.slice(0, 4).map((tag) => <span key={tag.id} className="admin-crm-tag">{tag.name}</span>)}
                        {tags.length > 4 ? <span className="admin-crm-tag">+{tags.length - 4}</span> : null}
                      </div>
                    </div>
                    <div className="admin-crm-row-actions">
                      <button type="button" className="admin-crm-secondary" onClick={() => navigate(`/admin/usuarios/${user.id}`)}>Editar</button>
                      <button
                        type="button"
                        className={user.active ? 'admin-crm-danger-soft' : 'admin-crm-success-soft'}
                        onClick={() => handleToggleActive(user)}
                        disabled={savingId === user.id}
                      >
                        {user.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
