// frontend/src/pages/AdminSpaces.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { getCurrentUser } from "../utils/auth";
import Layout from "../components/Layout";
import DeskManager from '../components/DeskManager';
import SpaceFormModal from "../components/SpaceFormModal";

const HARD_TAGS = ["Wifi", "Cafetería", "Impresora", "Climatización"];

const SPACE_TYPES = [
  { value: "FIX_DESK", label: "Puesto fijo" },
  { value: "FLEX_DESK", label: "Puesto flex" },
  { value: "SHARED_TABLE", label: "Mesa compartida" },
  { value: "MEETING_ROOM", label: "Sala de reuniones" },
  { value: "OFFICE", label: "Oficina privada" },
];

function typeLabel(type) {
  return SPACE_TYPES.find((t) => t.value === type)?.label || type;
}

function formatRate(rate) {
  const n = Number(rate ?? 0);
  // mantenemos simple (sin i18n), como el mock
  if (!Number.isFinite(n)) return "€ 0/h";
  // si es entero, no mostramos decimales
  return n % 1 === 0 ? `€ ${n}/h` : `€ ${n.toFixed(2)}/h`;
}

export default function AdminSpaces() {
  const user = getCurrentUser();

  const [deskSpace, setDeskSpace] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedSpace, setSelectedSpace] = useState(null);

  async function loadSpaces() {
    try {
      setLoading(true);
      const res = await api.get("/spaces");
      setSpaces(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar los espacios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpaces();
  }, []);

  const filteredSpaces = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return spaces;

    return (spaces || []).filter((s) => {
      const name = String(s?.name || "").toLowerCase();
      const type = String(s?.type || "").toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [spaces, searchTerm]);

  function openCreate() {
    setError("");
    setModalMode("create");
    setSelectedSpace(null);
    setModalOpen(true);
  }

  function openEdit(space) {
    setError("");
    setModalMode("edit");
    setSelectedSpace(space);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function handleDelete(space) {
    setError("");
    const ok = window.confirm(
      `¿Seguro que quieres eliminar el espacio "${space?.name}"?`
    );
    if (!ok) return;

    try {
      setSaving(true);
      await api.delete(`/spaces/${space.id}`);
      await loadSpaces();
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el espacio");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitModal(payload) {
    setError("");

    try {
      setSaving(true);

      if (modalMode === "edit" && selectedSpace?.id) {
        await api.put(`/spaces/${selectedSpace.id}`, payload);
      } else {
        await api.post("/spaces", payload);
      }

      setModalOpen(false);
      setSelectedSpace(null);
      await loadSpaces();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error al guardar el espacio");
    } finally {
      setSaving(false);
    }
  }

  if (!user || user.role !== "ADMIN") return null;

  return (
    <Layout user={user}>
      <div className="admin-page" style={{ padding: "1.5rem 1rem 2rem" }}>
        {/* Header + botón */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, marginBottom: "0.25rem" }}>
              Gestión de Espacios
            </h1>
            <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              Crea, edita y activa / desactiva los espacios del coworking.
            </div>
          </div>

          <button className="pill-button" type="button" onClick={openCreate}>
            + Añadir espacio
          </button>
        </div>

        {/* Error global */}
        {error ? (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Buscador */}
        <div className="admin-card" style={{ padding: "1rem", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ opacity: 0.6 }}>🔎</div>
            <input
              className="admin-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar espacios..."
            />
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="admin-card">Cargando espacios...</div>
        ) : filteredSpaces.length === 0 ? (
          // Empty state (placeholder card)
          <div className="admin-card" style={{ padding: "2.5rem 1rem" }}>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                gap: 10,
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: 44, opacity: 0.35 }}>📄</div>
              <div style={{ fontWeight: 600, color: "#111827" }}>
                Aún no hay espacios
              </div>
              <button className="pill-button-outline" onClick={openCreate}>
                + Añade tu primer espacio
              </button>
            </div>
          </div>
        ) : (
          // Grid de cards (hasta 3 por fila)
          <div className="spaces-grid">
            {filteredSpaces.map((space) => {
              const active = !!space.active;

              return (
                <div
                  key={space.id}
                  className="admin-card space-card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {/* Imagen */}
                  <div className="space-card-cover">
                    {space.imageUrl ? (
                      <img
                        src={space.imageUrl}
                        alt={space.name}
                        onError={(e) => {
                          // si falla, ocultamos img y mostramos fallback (el div siempre está)
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}

                    {/* Fallback siempre presente, se verá si no hay imagen o si la img se ocultó */}
                    <div className="space-card-cover-fallback">🖼️</div>
                  </div>

                  {/* Cuerpo */}
                  <div className="space-card-body" style={{ padding: 16 }}>
                    {/* Título + estado */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                        {space.name}
                      </div>
                      <span className={`badge ${active ? "green" : "red"}`}>
                        {active ? "Disponible" : "No disponible"}
                      </span>
                    </div>

                    {/* Tipo */}
                    <div style={{ marginBottom: 10 }}>
                      <span
                        className="chip"
                        style={{
                          background: "#f3f4f6",
                          color: "#111827",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        {typeLabel(space.type)}
                      </span>
                    </div>

                    {/* Datos */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 10,
                        color: "#374151",
                        fontSize: "0.92rem",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ opacity: 0.7 }}>👥</span>
                        <span>Capacidad: {space.capacity}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: "#111827" }}>
                        {formatRate(space.hourlyRate)}
                      </div>
                    </div>

                    {/* Descripción */}
                    {space.description ? (
                      <div
                        className="space-desc"
                        style={{
                          fontSize: "0.9rem",
                          color: "#6b7280",
                          marginBottom: 10,
                          lineHeight: 1.35,
                        }}
                      >
                        {space.description}
                      </div>
                    ) : null}

                    {/* Tags hardcodeadas */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 14,
                      }}
                    >
                      {HARD_TAGS.map((t) => (
                        <span
                          key={t}
                          className="chip"
                          style={{ background: "#eef2ff", color: "#3730a3" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {space.numberedDesks && <button type="button" className="pill-button-outline" onClick={() => setDeskSpace(space)} style={{marginBottom:12}}>Gestionar mesas</button>}
                    {/* Botones */}
                    <div className="space-card-actions">
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="pill-button-outline"
                          onClick={() => openEdit(space)}
                          disabled={saving}
                          style={{ flex: 1, justifyContent: "center" }}
                        >
                          ✏️ Edición
                        </button>

                        <button
                          type="button"
                          className="btn-small btn-danger"
                          onClick={() => handleDelete(space)}
                          disabled={saving}
                          title="Eliminar"
                          style={{
                            width: 40,
                            height: 30,
                            marginRight: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {deskSpace && <DeskManager space={deskSpace} onClose={() => setDeskSpace(null)} onChanged={loadSpaces} />}
        {/* Modal (crear/editar) */}
        <SpaceFormModal
          open={modalOpen}
          mode={modalMode}
          initialValues={selectedSpace}
          saving={saving}
          error={error}
          onClose={closeModal}
          onSubmit={handleSubmitModal}
        />
      </div>
    </Layout>
  );
}
