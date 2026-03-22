import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axiosClient';

const PRODUCT_TYPES = ['PLAN', 'BONUS', 'RATE'];
const TARGET_TYPES = ['COWORKING', 'MEETING_ROOM', 'INSPIRATION_ROOM', 'FULL_SPACE', 'OTHER'];
const BILLING_TYPES = ['RECURRING', 'PREPAID', 'PAY_PER_USE', 'INCLUDED'];
const UNIT_TYPES = ['HOUR', 'DAY', 'HALF_DAY', 'FULL_DAY', 'WEEK', 'MONTH', 'UNIT', 'SESSION'];
const TAX_MODES = ['INCLUDED', 'EXCLUDED', 'EXEMPT'];
const BENEFIT_TYPES = ['INCLUDED_CREDIT', 'BONUS_CREDIT', 'DISCOUNT', 'ACCESS_RIGHT'];
const PAYMENT_FREQUENCIES = ['ONE_TIME', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  productType: 'PLAN',
  targetType: 'COWORKING',
  billingType: 'RECURRING',
  defaultUnitType: 'MONTH',
  taxMode: 'EXCLUDED',
  isActive: true,
  requiresReservation: false,
  defaultSpaceId: '',
  validFrom: '',
  validTo: '',
  sortOrder: 0,
  rates: [],
  benefits: [],
};

function toInputDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function normalizeProductToForm(product) {
  return {
    code: product?.code || '',
    name: product?.name || '',
    description: product?.description || '',
    productType: product?.productType || 'PLAN',
    targetType: product?.targetType || 'COWORKING',
    billingType: product?.billingType || 'RECURRING',
    defaultUnitType: product?.defaultUnitType || 'MONTH',
    taxMode: product?.taxMode || 'EXCLUDED',
    isActive: Boolean(product?.isActive),
    requiresReservation: Boolean(product?.requiresReservation),
    defaultSpaceId: product?.defaultSpaceId ? String(product.defaultSpaceId) : '',
    validFrom: toInputDateTime(product?.validFrom),
    validTo: toInputDateTime(product?.validTo),
    sortOrder: Number(product?.sortOrder || 0),
    rates: Array.isArray(product?.rates)
      ? product.rates.map((r) => ({
          unitType: r.unitType || 'MONTH',
          currency: r.currency || 'EUR',
          price: r.price ?? '',
          taxMode: r.taxMode || 'EXCLUDED',
          taxPercent: r.taxPercent ?? '',
          validFrom: toInputDateTime(r.validFrom),
          validTo: toInputDateTime(r.validTo),
          priority: Number(r.priority || 0),
          isActive: Boolean(r.isActive),
          notes: r.notes || '',
        }))
      : [],
    benefits: Array.isArray(product?.benefits)
      ? product.benefits.map((b) => ({
          benefitType: b.benefitType || 'INCLUDED_CREDIT',
          targetType: b.targetType || 'MEETING_ROOM',
          unitType: b.unitType || 'HOUR',
          creditAmount: b.creditAmount ?? '',
          resetEachPeriod: Boolean(b.resetEachPeriod),
          resetFrequency: b.resetFrequency || '',
          rolloverAllowed: Boolean(b.rolloverAllowed),
          isActive: Boolean(b.isActive),
          notes: b.notes || '',
        }))
      : [],
  };
}

function buildPayload(form) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description?.trim() || null,
    productType: form.productType,
    targetType: form.targetType,
    billingType: form.billingType,
    defaultUnitType: form.defaultUnitType,
    taxMode: form.taxMode,
    isActive: Boolean(form.isActive),
    requiresReservation: Boolean(form.requiresReservation),
    defaultSpaceId: form.defaultSpaceId ? Number(form.defaultSpaceId) : null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    sortOrder: Number(form.sortOrder || 0),
    rates: (form.rates || []).map((r) => ({
      unitType: r.unitType,
      currency: r.currency || 'EUR',
      price: r.price === '' ? null : Number(r.price),
      taxMode: r.taxMode,
      taxPercent: r.taxPercent === '' ? null : Number(r.taxPercent),
      validFrom: r.validFrom || null,
      validTo: r.validTo || null,
      priority: Number(r.priority || 0),
      isActive: Boolean(r.isActive),
      notes: r.notes?.trim() || null,
    })),
    benefits: (form.benefits || []).map((b) => ({
      benefitType: b.benefitType,
      targetType: b.targetType,
      unitType: b.unitType,
      creditAmount: b.creditAmount === '' ? null : Number(b.creditAmount),
      resetEachPeriod: Boolean(b.resetEachPeriod),
      resetFrequency: b.resetFrequency || null,
      rolloverAllowed: Boolean(b.rolloverAllowed),
      isActive: Boolean(b.isActive),
      notes: b.notes?.trim() || null,
    })),
  };
}

function cardStyle(active = false) {
  return {
    textAlign: 'left',
    padding: '0.85rem',
    borderRadius: '0.9rem',
    border: active ? '2px solid #111827' : '1px solid #e5e7eb',
    background: active ? '#f8fafc' : '#fff',
    cursor: 'pointer',
  };
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminCommercial() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState(emptyForm);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  async function loadProducts() {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const params = {};
      if (activeFilter === 'active') params.active = 'true';
      if (activeFilter === 'inactive') params.active = 'false';
      if (productTypeFilter) params.productType = productTypeFilter;
      if (targetTypeFilter) params.targetType = targetTypeFilter;

      const res = await api.get('/admin/commercial/products', { params });
      const data = res.data || [];
      setItems(data);

      if (!isCreating) {
        if (selectedId) {
          const exists = data.some((x) => x.id === selectedId);
          if (!exists) setSelectedId(data[0]?.id || null);
        } else {
          setSelectedId(data[0]?.id || null);
        }
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando productos comerciales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, productTypeFilter, targetTypeFilter]);

  useEffect(() => {
    if (!selected || isCreating) return;
    setForm(normalizeProductToForm(selected));
  }, [selected, isCreating]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const code = String(x.code || '').toLowerCase();
      const name = String(x.name || '').toLowerCase();
      const desc = String(x.description || '').toLowerCase();
      return code.includes(q) || name.includes(q) || desc.includes(q);
    });
  }, [items, search]);

  function startCreate() {
    setIsCreating(true);
    setSelectedId(null);
    setError('');
    setInfo('');
    setForm({
      ...emptyForm,
      rates: [
        {
          unitType: 'MONTH',
          currency: 'EUR',
          price: '',
          taxMode: 'EXCLUDED',
          taxPercent: '',
          validFrom: '',
          validTo: '',
          priority: 0,
          isActive: true,
          notes: '',
        },
      ],
      benefits: [],
    });
  }

  function cancelCreate() {
    setIsCreating(false);
    setError('');
    setInfo('');
    setForm(emptyForm);
    setSelectedId(items[0]?.id || null);
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addRate() {
    setForm((prev) => ({
      ...prev,
      rates: [
        ...(prev.rates || []),
        {
          unitType: prev.defaultUnitType || 'MONTH',
          currency: 'EUR',
          price: '',
          taxMode: prev.taxMode || 'EXCLUDED',
          taxPercent: '',
          validFrom: '',
          validTo: '',
          priority: 0,
          isActive: true,
          notes: '',
        },
      ],
    }));
  }

  function updateRate(idx, key, value) {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    }));
  }

  function removeRate(idx) {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.filter((_, i) => i !== idx),
    }));
  }

  function addBenefit() {
    setForm((prev) => ({
      ...prev,
      benefits: [
        ...(prev.benefits || []),
        {
          benefitType: 'INCLUDED_CREDIT',
          targetType: 'MEETING_ROOM',
          unitType: 'HOUR',
          creditAmount: '',
          resetEachPeriod: false,
          resetFrequency: '',
          rolloverAllowed: false,
          isActive: true,
          notes: '',
        },
      ],
    }));
  }

  function updateBenefit(idx, key, value) {
    setForm((prev) => ({
      ...prev,
      benefits: prev.benefits.map((b, i) => (i === idx ? { ...b, [key]: value } : b)),
    }));
  }

  function removeBenefit(idx) {
    setForm((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== idx),
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setInfo('');

    try {
      const payload = buildPayload(form);

      if (!payload.code || !payload.name) {
        setSaving(false);
        setError('Code y Nombre son obligatorios');
        return;
      }

      if (isCreating) {
        const res = await api.post('/admin/commercial/products', payload);
        const created = res.data;
        setInfo('Producto comercial creado ✅');
        setIsCreating(false);
        await loadProducts();
        if (created?.id) setSelectedId(created.id);
      } else {
        if (!selected?.id) {
          setSaving(false);
          setError('Selecciona un producto para editar');
          return;
        }
        await api.put(`/admin/commercial/products/${selected.id}`, payload);
        setInfo('Producto comercial actualizado ✅');
        await loadProducts();
        setSelectedId(selected.id);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Error guardando producto comercial');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product) {
    const next = !product?.isActive;
    setTogglingId(product.id);
    setError('');
    setInfo('');

    try {
      await api.patch(`/admin/commercial/products/${product.id}/active`, {
        isActive: next,
      });

      setItems((prev) =>
        prev.map((x) => (x.id === product.id ? { ...x, isActive: next } : x))
      );

      if (selectedId === product.id) {
        setForm((prev) => ({ ...prev, isActive: next }));
      }

      setInfo(next ? 'Producto activado ✅' : 'Producto desactivado ✅');
    } catch (e) {
      setError(e?.response?.data?.message || 'Error actualizando estado');
    } finally {
      setTogglingId(null);
    }
  }

  const headerTitle = isCreating ? 'Nuevo producto comercial' : selected?.name || 'Catálogo comercial';

  return (
    <Layout>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Comercial</h1>
            <p style={{ marginTop: 6, color: '#6b7280' }}>
              Gestión del catálogo comercial base: productos, tarifas y beneficios.
            </p>
          </div>

          {!isCreating ? (
            <button className="pill-button" onClick={startCreate}>
              + Nuevo producto
            </button>
          ) : (
            <button className="pill-button-outline" onClick={cancelCreate}>
              Cancelar alta
            </button>
          )}
        </div>

        {error ? (
          <div style={{ marginBottom: 12, padding: '0.75rem 1rem', borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        ) : null}

        {info ? (
          <div style={{ marginBottom: 12, padding: '0.75rem 1rem', borderRadius: 12, background: '#dcfce7', color: '#166534' }}>
            {info}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1rem', alignItems: 'start' }}>
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>Productos</h3>

            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              <input
                className="admin-input"
                placeholder="Buscar por code, nombre o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select className="admin-input" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>

                <select className="admin-input" value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)}>
                  <option value="">Tipo producto</option>
                  {PRODUCT_TYPES.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>

              <select className="admin-input" value={targetTypeFilter} onChange={(e) => setTargetTypeFilter(e.target.value)}>
                <option value="">Target</option>
                {TARGET_TYPES.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div>Cargando...</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No hay productos para los filtros seleccionados.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredItems.map((item) => {
                  const active = item.id === selectedId && !isCreating;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isCreating}
                      onClick={() => setSelectedId(item.id)}
                      style={{ ...cardStyle(active), opacity: isCreating ? 0.6 : 1 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{item.code}</div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 999,
                            background: item.isActive ? '#dcfce7' : '#e5e7eb',
                            color: item.isActive ? '#166534' : '#374151',
                            height: 'fit-content',
                          }}
                        >
                          {item.isActive ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                        {item.productType} · {item.targetType}
                      </div>

                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        Tarifas: {item.rates?.length || 0} · Beneficios: {item.benefits?.length || 0}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: 14 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>{headerTitle}</h3>
                {!isCreating && selected ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    ID #{selected.id} · {selected.code}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Completa los datos del producto comercial
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!isCreating && selected ? (
                  <button
                    type="button"
                    className="pill-button-outline"
                    onClick={() => toggleActive(selected)}
                    disabled={togglingId === selected.id}
                  >
                    {togglingId === selected.id
                      ? 'Actualizando...'
                      : selected.isActive
                      ? 'Desactivar'
                      : 'Activar'}
                  </button>
                ) : null}

                <button type="button" className="pill-button" onClick={save} disabled={saving}>
                  {saving ? 'Guardando...' : isCreating ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </div>

            {!isCreating && !selected ? (
              <div style={{ color: '#6b7280' }}>Selecciona un producto o crea uno nuevo.</div>
            ) : (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Code">
                    <input className="admin-input" value={form.code} onChange={(e) => updateForm('code', e.target.value)} />
                  </Field>

                  <Field label="Nombre">
                    <input className="admin-input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                  </Field>
                </div>

                <Field label="Descripción">
                  <textarea
                    className="admin-input"
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <Field label="Tipo producto">
                    <select className="admin-input" value={form.productType} onChange={(e) => updateForm('productType', e.target.value)}>
                      {PRODUCT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>

                  <Field label="Target">
                    <select className="admin-input" value={form.targetType} onChange={(e) => updateForm('targetType', e.target.value)}>
                      {TARGET_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>

                  <Field label="Billing">
                    <select className="admin-input" value={form.billingType} onChange={(e) => updateForm('billingType', e.target.value)}>
                      {BILLING_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>

                  <Field label="Unidad default">
                    <select className="admin-input" value={form.defaultUnitType} onChange={(e) => updateForm('defaultUnitType', e.target.value)}>
                      {UNIT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <Field label="Tax mode">
                    <select className="admin-input" value={form.taxMode} onChange={(e) => updateForm('taxMode', e.target.value)}>
                      {TAX_MODES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>

                  <Field label="Sort order">
                    <input
                      className="admin-input"
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => updateForm('sortOrder', e.target.value)}
                    />
                  </Field>

                  <Field label="Válido desde">
                    <input
                      className="admin-input"
                      type="datetime-local"
                      value={form.validFrom}
                      onChange={(e) => updateForm('validFrom', e.target.value)}
                    />
                  </Field>

                  <Field label="Válido hasta">
                    <input
                      className="admin-input"
                      type="datetime-local"
                      value={form.validTo}
                      onChange={(e) => updateForm('validTo', e.target.value)}
                    />
                  </Field>
                </div>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateForm('isActive', e.target.checked)}
                  />
                  <span>Producto activo</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.requiresReservation}
                    onChange={(e) => updateForm('requiresReservation', e.target.checked)}
                  />
                  <span>Este producto requiere crear una reserva asociada</span>
                </label>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Tarifas</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Cada tarifa se reemplaza completa al guardar.
                      </div>
                    </div>

                    <button type="button" className="pill-button-outline" onClick={addRate}>
                      + Añadir tarifa
                    </button>
                  </div>

                  {form.rates.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Este producto aún no tiene tarifas.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {form.rates.map((rate, idx) => (
                        <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontWeight: 700 }}>Tarifa #{idx + 1}</div>
                            <button type="button" className="pill-button-outline" onClick={() => removeRate(idx)}>
                              Eliminar
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                            <Field label="Unidad">
                              <select className="admin-input" value={rate.unitType} onChange={(e) => updateRate(idx, 'unitType', e.target.value)}>
                                {UNIT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <Field label="Moneda">
                              <input className="admin-input" value={rate.currency} onChange={(e) => updateRate(idx, 'currency', e.target.value)} />
                            </Field>

                            <Field label="Precio">
                              <input className="admin-input" type="number" step="0.01" value={rate.price} onChange={(e) => updateRate(idx, 'price', e.target.value)} />
                            </Field>

                            <Field label="Prioridad">
                              <input className="admin-input" type="number" value={rate.priority} onChange={(e) => updateRate(idx, 'priority', e.target.value)} />
                            </Field>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
                            <Field label="Tax mode">
                              <select className="admin-input" value={rate.taxMode} onChange={(e) => updateRate(idx, 'taxMode', e.target.value)}>
                                {TAX_MODES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <Field label="% IVA">
                              <input className="admin-input" type="number" step="0.01" value={rate.taxPercent} onChange={(e) => updateRate(idx, 'taxPercent', e.target.value)} />
                            </Field>

                            <Field label="Válido desde">
                              <input className="admin-input" type="datetime-local" value={rate.validFrom} onChange={(e) => updateRate(idx, 'validFrom', e.target.value)} />
                            </Field>

                            <Field label="Válido hasta">
                              <input className="admin-input" type="datetime-local" value={rate.validTo} onChange={(e) => updateRate(idx, 'validTo', e.target.value)} />
                            </Field>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <Field label="Notas">
                              <input className="admin-input" value={rate.notes} onChange={(e) => updateRate(idx, 'notes', e.target.value)} />
                            </Field>
                          </div>

                          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                            <input type="checkbox" checked={rate.isActive} onChange={(e) => updateRate(idx, 'isActive', e.target.checked)} />
                            <span>Tarifa activa</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Beneficios</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Créditos o beneficios incluidos por el producto.
                      </div>
                    </div>

                    <button type="button" className="pill-button-outline" onClick={addBenefit}>
                      + Añadir beneficio
                    </button>
                  </div>

                  {form.benefits.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Este producto no tiene beneficios.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {form.benefits.map((benefit, idx) => (
                        <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontWeight: 700 }}>Beneficio #{idx + 1}</div>
                            <button type="button" className="pill-button-outline" onClick={() => removeBenefit(idx)}>
                              Eliminar
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                            <Field label="Tipo beneficio">
                              <select className="admin-input" value={benefit.benefitType} onChange={(e) => updateBenefit(idx, 'benefitType', e.target.value)}>
                                {BENEFIT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <Field label="Target">
                              <select className="admin-input" value={benefit.targetType} onChange={(e) => updateBenefit(idx, 'targetType', e.target.value)}>
                                {TARGET_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <Field label="Unidad">
                              <select className="admin-input" value={benefit.unitType} onChange={(e) => updateBenefit(idx, 'unitType', e.target.value)}>
                                {UNIT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <Field label="Cantidad crédito">
                              <input className="admin-input" type="number" step="0.01" value={benefit.creditAmount} onChange={(e) => updateBenefit(idx, 'creditAmount', e.target.value)} />
                            </Field>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={benefit.resetEachPeriod}
                                onChange={(e) => updateBenefit(idx, 'resetEachPeriod', e.target.checked)}
                              />
                              <span>Reinicia por período</span>
                            </label>

                            <Field label="Frecuencia reset">
                              <select className="admin-input" value={benefit.resetFrequency} onChange={(e) => updateBenefit(idx, 'resetFrequency', e.target.value)}>
                                <option value="">Sin reset</option>
                                {PAYMENT_FREQUENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </Field>

                            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={benefit.rolloverAllowed}
                                onChange={(e) => updateBenefit(idx, 'rolloverAllowed', e.target.checked)}
                              />
                              <span>Permite rollover</span>
                            </label>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <Field label="Notas">
                              <input className="admin-input" value={benefit.notes} onChange={(e) => updateBenefit(idx, 'notes', e.target.value)} />
                            </Field>
                          </div>

                          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                            <input type="checkbox" checked={benefit.isActive} onChange={(e) => updateBenefit(idx, 'isActive', e.target.checked)} />
                            <span>Beneficio activo</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!isCreating && selected ? (
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Resumen actual</div>
                    <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#374151' }}>
                      <div><b>Estado:</b> {selected.isActive ? 'Activo' : 'Inactivo'}</div>
                      <div><b>Tipo:</b> {selected.productType}</div>
                      <div><b>Target:</b> {selected.targetType}</div>
                      <div><b>Billing:</b> {selected.billingType}</div>
                      <div><b>Unidad default:</b> {selected.defaultUnitType}</div>
                      <div><b>Vigencia:</b> {formatDateTime(selected.validFrom)} → {formatDateTime(selected.validTo)}</div>
                    </div>

                    {selected.rates?.length ? (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Tarifas cargadas</div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {selected.rates.map((r) => (
                            <div key={r.id} style={{ fontSize: 14, color: '#374151' }}>
                              {r.unitType} · {formatMoney(r.price, r.currency)} · prioridad {r.priority} · {r.isActive ? 'activa' : 'inactiva'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}