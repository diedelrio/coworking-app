import { useEffect, useState } from "react";

/* Tipos de espacio */
const SPACE_TYPES = [
  { value: "FIX_DESK", label: "Puesto fijo" },
  { value: "FLEX_DESK", label: "Puesto flex" },
  { value: "SHARED_TABLE", label: "Mesa compartida" },
  { value: "MEETING_ROOM", label: "Sala de reuniones" },
  { value: "OFFICE", label: "Oficina privada" },
];

/* Amenities hardcodeadas */
const HARD_TAGS = ["Wifi", "Cafetería", "Impresora", "Climatización"];

/* Valores por defecto */
const DEFAULT_FORM = {
  name: "",
  type: "FLEX_DESK",
  capacity: 1,
  hourlyRate: 0,
  description: "",
  imageUrl: "",
  active: true,
};

export default function SpaceFormModal({
  open,
  mode, // "create" | "edit"
  initialValues,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const title = mode === "edit" ? "Editar espacio" : "Añadir nuevo espacio";
  const subtitle =
    mode === "edit"
      ? "Actualiza los detalles del espacio."
      : "Completa la información para crear un nuevo espacio.";

  const [form, setForm] = useState(DEFAULT_FORM);
  const [previewError, setPreviewError] = useState(false);

  /* 🔑 CLAVE: rehidrata el form cada vez que se abre o cambia initialValues */
  useEffect(() => {
    if (!open) return;

    const next = { ...DEFAULT_FORM, ...(initialValues || {}) };

    // Normalizaciones defensivas
    next.capacity = Number(next.capacity ?? 1);
    next.hourlyRate = Number(next.hourlyRate ?? 0);
    next.description = next.description ?? "";
    next.imageUrl = next.imageUrl ?? "";
    next.active = Boolean(next.active);

    setForm(next);
    setPreviewError(false);
  }, [open, initialValues]);

  if (!open) return null;

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    const img = String(form.imageUrl || "").trim();

    const payload = {
      name: String(form.name || "").trim(),
      type: form.type,
      capacity: Number(form.capacity),
      hourlyRate: Number(form.hourlyRate),
      description: String(form.description || "").trim() || null,
      imageUrl: img ? img : null,
      active: Boolean(form.active),
    };

    onSubmit(payload);
  }

  return (
    <div className="settings-modal-overlay" role="dialog" aria-modal="true">
      <div className="settings-modal" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div className="settings-modal-header">
          <div>
            <div className="settings-modal-title">{title}</div>
            <div className="settings-modal-subtitle">{subtitle}</div>
          </div>

          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="settings-modal-body">
            {error ? (
              <div className="settings-modal-error">{error}</div>
            ) : null}

            <div className="space-modal-grid">
              {/* Columna izquierda */}
              <div>
                <div className="form-group">
                  <label>Nombre *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Tipo *</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      style={{
                        width: "100%",
                        borderRadius: "0.5rem",
                        border: "1px solid #d1d5db",
                        padding: "0.6rem 0.8rem",
                      }}
                    >
                      {SPACE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Capacidad *</label>
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      value={form.capacity}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tarifa por hora (€) *</label>
                  <input
                    name="hourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hourlyRate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>URL de la imagen</label>
                  <input
                    name="imageUrl"
                    type="url"
                    value={form.imageUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Columna derecha */}
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Vista previa
                </label>

                <div className="space-modal-preview" style={{ marginBottom: 14 }}>
                  {form.imageUrl && !previewError ? (
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      onError={() => setPreviewError(true)}
                    />
                  ) : (
                    "🖼️"
                  )}
                </div>

                <label
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Servicios incluidos
                </label>

                <div className="space-amenities" style={{ marginBottom: 14 }}>
                  {HARD_TAGS.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    Estado
                  </div>
                  <span className={`badge ${form.active ? "green" : "red"}`}>
                    {form.active ? "Disponible" : "No disponible"}
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      name="active"
                      checked={form.active}
                      onChange={handleChange}
                    />
                    Disponible para reserva
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="settings-modal-footer">
            <button
              type="button"
              className="pill-button-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button type="submit" className="pill-button" disabled={saving}>
              {saving
                ? mode === "edit"
                  ? "Guardando..."
                  : "Creando..."
                : mode === "edit"
                ? "Guardar cambios"
                : "Crear espacio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
