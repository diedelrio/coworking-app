import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axiosClient';

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES');
}

function formatMoney(value, currency = 'EUR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(n);
}

function statusPill(status) {
  const map = {
    ACTIVE: { bg: '#dcfce7', color: '#166534', label: 'Activo' },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelado' },
    EXPIRED: { bg: '#fef3c7', color: '#92400e', label: 'Expirado' },
    EXHAUSTED: { bg: '#e0e7ff', color: '#3730a3', label: 'Agotado' },
  };
  return map[status] || { bg: '#e5e7eb', color: '#374151', label: status || '—' };
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminCommercialAssignments() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [spaces, setSpaces] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [form, setForm] = useState({
    productId: '',
    startDate: '',
    endDate: '',
    priceSnapshot: '',
    currency: 'EUR',
    taxMode: '',
    taxPercent: '',
    notes: '',
    createReservation: false,
    reservationSpaceId: '',
    reservationNotes: '',
  });

  useEffect(() => {
    loadUsers();
    loadProducts();
    loadSpaces();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadAssignments(selectedUserId);
    } else {
      setAssignments([]);
    }
  }, [selectedUserId]);

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      const res = await api.get('/users');
      setUsers(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadProducts() {
    try {
      setLoadingProducts(true);
      const res = await api.get('/admin/commercial/products', {
        params: { active: 'true' },
      });
      setProducts(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando productos comerciales');
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadSpaces() {
    try {
      setLoadingSpaces(true);
      const res = await api.get('/spaces');
      setSpaces(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando espacios');
    } finally {
      setLoadingSpaces(false);
    }
  }

  async function loadAssignments(userId) {
    try {
      setLoadingAssignments(true);
      const res = await api.get('/admin/commercial/assignments', {
        params: { userId },
      });
      setAssignments(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando asignaciones');
    } finally {
      setLoadingAssignments(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.productId)) || null,
    [products, form.productId]
  );

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function suggestFromProduct(productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) return;

    const bestRate = (product.rates || [])[0] || null;

    setForm((prev) => ({
      ...prev,
      productId: String(productId),
      priceSnapshot:
        bestRate?.price === undefined || bestRate?.price === null ? '' : String(bestRate.price),
      currency: bestRate?.currency || 'EUR',
      taxMode: bestRate?.taxMode || product.taxMode || '',
      taxPercent:
        bestRate?.taxPercent === undefined || bestRate?.taxPercent === null
          ? ''
          : String(bestRate.taxPercent),
      createReservation: Boolean(product.requiresReservation),
      reservationSpaceId: product.defaultSpaceId ? String(product.defaultSpaceId) : '',
    }));
  }

  async function createAssignment() {
    try {
      setSaving(true);
      setError('');
      setInfo('');

      if (!selectedUserId) {
        setError('Selecciona un usuario');
        return;
      }
      if (!form.productId) {
        setError('Selecciona un producto comercial');
        return;
      }
      if (!form.startDate) {
        setError('Indica una fecha de inicio');
        return;
      }

      const payload = {
        userId: Number(selectedUserId),
        productId: Number(form.productId),
        startDate: form.startDate,
        endDate: form.endDate || null,
        priceSnapshot: form.priceSnapshot === '' ? null : Number(form.priceSnapshot),
        currency: form.currency || 'EUR',
        taxMode: form.taxMode || null,
        taxPercent: form.taxPercent === '' ? null : Number(form.taxPercent),
        notes: form.notes?.trim() || null,
        createReservation: Boolean(form.createReservation),
        reservation: form.createReservation
          ? {
              spaceId: form.reservationSpaceId ? Number(form.reservationSpaceId) : null,
              status: 'ACTIVE',
              notes: form.reservationNotes?.trim() || null,
            }
          : null,
      };

      await api.post('/admin/commercial/assignments', payload);

      setInfo('Producto asignado correctamente ✅');
      setForm({
        productId: '',
        startDate: '',
        endDate: '',
        priceSnapshot: '',
        currency: 'EUR',
        taxMode: '',
        taxPercent: '',
        notes: '',
        createReservation: false,
        reservationSpaceId: '',
        reservationNotes: '',
      });

      await loadAssignments(selectedUserId);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error asignando producto al usuario');
    } finally {
      setSaving(false);
    }
  }

  async function changeAssignmentStatus(item, nextStatus) {
    try {
      setError('');
      setInfo('');

      await api.patch(`/admin/commercial/assignments/${item.id}/status`, {
        status: nextStatus,
      });

      setAssignments((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: nextStatus } : x))
      );

      setInfo('Estado actualizado ✅');
      await loadAssignments(selectedUserId);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error actualizando estado');
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 1450, margin: '0 auto', padding: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Comercial · Asignaciones</h1>
          <p style={{ marginTop: 6, color: '#6b7280' }}>
            Asigna planes o bonos a usuarios y genera automáticamente los saldos disponibles.
          </p>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 12,
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: '#fee2e2',
              color: '#991b1b',
            }}
          >
            {error}
          </div>
        ) : null}

        {info ? (
          <div
            style={{
              marginBottom: 12,
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: '#dcfce7',
              color: '#166534',
            }}
          >
            {info}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>Usuarios</h3>

            <input
              className="admin-input"
              placeholder="Buscar usuario..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {loadingUsers ? (
              <div>Cargando usuarios...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No se encontraron usuarios.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: '75vh', overflow: 'auto' }}>
                {filteredUsers.map((u) => {
                  const active = String(selectedUserId) === String(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(String(u.id))}
                      style={{
                        textAlign: 'left',
                        padding: '0.85rem',
                        borderRadius: 12,
                        border: active ? '2px solid #111827' : '1px solid #e5e7eb',
                        background: active ? '#f8fafc' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {u.name} {u.lastName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: u.active ? '#166534' : '#991b1b',
                          marginTop: 4,
                        }}
                      >
                        {u.active ? 'Activo' : 'Inactivo'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="admin-card">
              <h3 style={{ marginTop: 0 }}>Nueva asignación</h3>

              {!selectedUser ? (
                <div style={{ color: '#6b7280' }}>Selecciona un usuario para continuar.</div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, color: '#374151' }}>
                    Usuario seleccionado: <b>{selectedUser.name} {selectedUser.lastName}</b> ·{' '}
                    {selectedUser.email}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                    <Field label="Producto comercial">
                      <select
                        className="admin-input"
                        value={form.productId}
                        onChange={(e) => suggestFromProduct(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.code}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Inicio">
                      <input
                        className="admin-input"
                        type="datetime-local"
                        value={form.startDate}
                        onChange={(e) => updateForm('startDate', e.target.value)}
                      />
                    </Field>

                    <Field label="Fin">
                      <input
                        className="admin-input"
                        type="datetime-local"
                        value={form.endDate}
                        onChange={(e) => updateForm('endDate', e.target.value)}
                      />
                    </Field>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr',
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    <Field label="Precio snapshot">
                      <input
                        className="admin-input"
                        type="number"
                        step="0.01"
                        value={form.priceSnapshot}
                        onChange={(e) => updateForm('priceSnapshot', e.target.value)}
                      />
                    </Field>

                    <Field label="Moneda">
                      <input
                        className="admin-input"
                        value={form.currency}
                        onChange={(e) => updateForm('currency', e.target.value)}
                      />
                    </Field>

                    <Field label="Tax mode">
                      <select
                        className="admin-input"
                        value={form.taxMode}
                        onChange={(e) => updateForm('taxMode', e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="INCLUDED">INCLUDED</option>
                        <option value="EXCLUDED">EXCLUDED</option>
                        <option value="EXEMPT">EXEMPT</option>
                      </select>
                    </Field>

                    <Field label="% IVA">
                      <input
                        className="admin-input"
                        type="number"
                        step="0.01"
                        value={form.taxPercent}
                        onChange={(e) => updateForm('taxPercent', e.target.value)}
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Field label="Notas">
                      <textarea
                        className="admin-input"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => updateForm('notes', e.target.value)}
                      />
                    </Field>
                  </div>

                  {loadingProducts ? (
                    <div style={{ marginTop: 12, color: '#6b7280' }}>Cargando productos...</div>
                  ) : selectedProduct ? (
                    <div
                      style={{
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Resumen del producto</div>

                      <div style={{ color: '#374151', fontSize: 14 }}>
                        <div>
                          <b>Tipo:</b> {selectedProduct.productType}
                        </div>
                        <div>
                          <b>Target:</b> {selectedProduct.targetType}
                        </div>
                        <div>
                          <b>Billing:</b> {selectedProduct.billingType}
                        </div>
                        <div>
                          <b>Tarifas activas:</b> {selectedProduct.rates?.length || 0}
                        </div>
                        <div>
                          <b>Beneficios activos:</b> {selectedProduct.benefits?.length || 0}
                        </div>
                      </div>

                      {selectedProduct.benefits?.length ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>
                            Balances a generar
                          </div>
                          <div style={{ display: 'grid', gap: 4 }}>
                            {selectedProduct.benefits.map((b) => (
                              <div key={b.id} style={{ fontSize: 14, color: '#374151' }}>
                                {Number(b.creditAmount)} {b.unitType} · {b.targetType}
                                {b.resetEachPeriod
                                  ? ` · reset ${b.resetFrequency || 'periódico'}`
                                  : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedProduct.requiresReservation ? (
                        <div
                          style={{
                            marginTop: 16,
                            padding: 12,
                            borderRadius: 12,
                            background: '#fff7ed',
                            border: '1px solid #fed7aa',
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 10 }}>
                            Reserva asociada
                          </div>

                          <label
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              marginBottom: 12,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.createReservation}
                              onChange={(e) =>
                                updateForm('createReservation', e.target.checked)
                              }
                            />
                            <span>Crear reserva automáticamente al asignar</span>
                          </label>

                          {form.createReservation ? (
                            <div style={{ display: 'grid', gap: 12 }}>
                              <Field label="Espacio">
                                <select
                                  className="admin-input"
                                  value={form.reservationSpaceId}
                                  onChange={(e) =>
                                    updateForm('reservationSpaceId', e.target.value)
                                  }
                                  disabled={loadingSpaces}
                                >
                                  <option value="">Seleccionar...</option>
                                  {spaces.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </Field>

                              <Field label="Notas de la reserva">
                                <textarea
                                  className="admin-input"
                                  rows={2}
                                  value={form.reservationNotes}
                                  onChange={(e) =>
                                    updateForm('reservationNotes', e.target.value)
                                  }
                                />
                              </Field>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 16 }}>
                    <button
                      className="pill-button"
                      type="button"
                      onClick={createAssignment}
                      disabled={saving}
                    >
                      {saving ? 'Asignando...' : 'Asignar producto'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="admin-card">
              <h3 style={{ marginTop: 0 }}>Asignaciones del usuario</h3>

              {!selectedUser ? (
                <div style={{ color: '#6b7280' }}>
                  Selecciona un usuario para ver sus asignaciones.
                </div>
              ) : loadingAssignments ? (
                <div>Cargando asignaciones...</div>
              ) : assignments.length === 0 ? (
                <div style={{ color: '#6b7280' }}>
                  Este usuario todavía no tiene asignaciones comerciales.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {assignments.map((item) => {
                    const pill = statusPill(item.status);

                    return (
                      <div
                        key={item.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>
                              {item.product?.name || 'Producto'}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                              {item.product?.code} · ID asignación #{item.id}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: 999,
                              background: pill.bg,
                              color: pill.color,
                              fontSize: 12,
                              fontWeight: 700,
                              height: 'fit-content',
                            }}
                          >
                            {pill.label}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 10,
                            marginTop: 12,
                            color: '#374151',
                            fontSize: 14,
                          }}
                        >
                          <div>
                            <b>Inicio:</b> {formatDateTime(item.startDate)}
                          </div>
                          <div>
                            <b>Fin:</b> {formatDateTime(item.endDate)}
                          </div>
                          <div>
                            <b>Precio:</b>{' '}
                            {item.priceSnapshot != null
                              ? formatMoney(item.priceSnapshot, item.currency || 'EUR')
                              : '—'}
                          </div>
                          <div>
                            <b>IVA:</b> {item.taxPercent != null ? `${item.taxPercent}%` : '—'}
                          </div>
                        </div>

                        {item.notes ? (
                          <div style={{ marginTop: 8, color: '#374151', fontSize: 14 }}>
                            <b>Notas:</b> {item.notes}
                          </div>
                        ) : null}

                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            Balances generados
                          </div>

                          {item.balances?.length ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {item.balances.map((b) => (
                                <div
                                  key={b.id}
                                  style={{
                                    fontSize: 14,
                                    color: '#374151',
                                    padding: '0.5rem 0.75rem',
                                    background: '#f9fafb',
                                    borderRadius: 10,
                                  }}
                                >
                                  {b.targetType} · {b.remainingAmount}/{b.grantedAmount}{' '}
                                  {b.unitType}
                                  {' · '}vence: {formatDateTime(b.expiresAt)}
                                  {' · '}estado: {b.status}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#6b7280' }}>No generó balances.</div>
                          )}
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            Reservas asociadas
                          </div>

                          {item.reservations?.length ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {item.reservations.map((r) => (
                                <div
                                  key={r.id}
                                  style={{
                                    fontSize: 14,
                                    color: '#374151',
                                    padding: '0.5rem 0.75rem',
                                    background: '#f9fafb',
                                    borderRadius: 10,
                                  }}
                                >
                                  #{r.id} · {r.space?.name || `Space ${r.spaceId}`} ·{' '}
                                  {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)} ·{' '}
                                  {r.status}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#6b7280' }}>
                              No tiene reservas asociadas.
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          {item.status !== 'ACTIVE' ? (
                            <button
                              type="button"
                              className="pill-button-outline"
                              onClick={() => changeAssignmentStatus(item, 'ACTIVE')}
                            >
                              Activar
                            </button>
                          ) : null}

                          {item.status !== 'CANCELLED' ? (
                            <button
                              type="button"
                              className="pill-button-outline"
                              onClick={() => changeAssignmentStatus(item, 'CANCELLED')}
                            >
                              Cancelar
                            </button>
                          ) : null}

                          {item.status !== 'EXPIRED' ? (
                            <button
                              type="button"
                              className="pill-button-outline"
                              onClick={() => changeAssignmentStatus(item, 'EXPIRED')}
                            >
                              Marcar expirado
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}