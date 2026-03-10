import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

const SPACE_TYPES = [
  { value: "FIX_DESK", label: "Puesto fijo" },
  { value: "FLEX_DESK", label: "Puesto flex" },
  { value: "MEETING_ROOM", label: "Sala de reuniones" },
  { value: "OFFICE", label: "Oficina" },
  { value: "SHARED_TABLE", label: "Mesa compartida" },
];

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function AdminPricing() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // create list form
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(100);
  const [active, setActive] = useState(true);

  const [selectedId, setSelectedId] = useState(null);

  // add item form
  const [scope, setScope] = useState("GLOBAL");
  const [unit, setUnit] = useState("HOUR");
  const [spaceType, setSpaceType] = useState("FIX_DESK");
  const [spaceId, setSpaceId] = useState("");
  const [price, setPrice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/pricing/lists");
      const tagsRes = await api.get("/admin/tags");
      setTags(tagsRes.data || []);
      setLists(data || []);
      if (!selectedId && data?.[0]?.id) setSelectedId(data[0].id);
    } catch (e) {
      setError(e?.response?.data?.message || "Error cargando pricing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => lists.find((l) => l.id === selectedId), [lists, selectedId]);

  // Load selected list targetTags (segmentación) when switching list
  useEffect(() => {
    if (!selectedId) {
      setSelectedTagIds([]);
      return;
    }

    (async () => {
      try {
        // Intentamos traer el detalle (ideal: incluye targetTags)
        const { data } = await api.get(`/admin/pricing/lists/${selectedId}`);

        // targetTags puede venir como:
        // - [{ tagId: 1 }, { tagId: 2 }]
        // - [{ id: 1 }, { id: 2 }]
        // - [{ tag: { id: 1 } }, ...]
        const tt = data?.targetTags ?? [];
        const ids = tt
          .map((x) => x?.tagId ?? x?.id ?? x?.tag?.id)
          .filter((v) => typeof v === "number");

        setSelectedTagIds(ids);
      } catch (err) {
        // Fallback: si no existe el endpoint de detalle, usamos lo que ya vino en /lists
        const tt = selected?.targetTags ?? [];
        const ids = tt
          .map((x) => x?.tagId ?? x?.id ?? x?.tag?.id)
          .filter((v) => typeof v === "number");
        setSelectedTagIds(ids);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function createList() {
    if (!name.trim()) return;
    await api.post("/admin/pricing/lists", { name, priority: Number(priority), active });
    setName("");
    await load();
  }

  async function saveTags() {
    if (!selectedId) return;
    await api.put(`/admin/pricing/lists/${selectedId}/tags`, { tagIds: selectedTagIds });
    // recargar para reflejar targetTags si el list endpoint los devuelve
    await load();
  }

  async function addItem() {
    if (!selectedId) return;
    if (price === "" || Number.isNaN(Number(price))) return;

    const payload = {
      scope,
      price: Number(price),
      unit,
      spaceType: scope === "SPACE_TYPE" ? spaceType : null,
      spaceId: scope === "SPACE_ID" ? Number(spaceId) : null,
    };

    await api.post(`/admin/pricing/lists/${selectedId}/items`, payload);
    setPrice("");
    setSpaceId("");
    await load();
  }

  async function deleteItem(itemId) {
    await api.delete(`/admin/pricing/items/${itemId}`);
    await load();
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Pricing — Listas de precios</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: una lista activa (por prioridad) con items por SPACE_ID / SPACE_TYPE / GLOBAL.
        </p>

        {error && (
          <div style={{ background: "#fee2e2", padding: "0.75rem", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem" }}>
          {/* Left: lists */}
          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <h3 style={{ marginTop: 0 }}>Listas</h3>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                style={{ flex: 1, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="Prioridad"
                style={{ width: 140, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activa
              </label>
              <button
                onClick={createList}
                style={{ padding: "0.55rem 0.75rem", borderRadius: 8, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}
              >
                Crear
              </button>
            </div>

            {loading ? (
              <div>Cargando…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    style={{
                      textAlign: "left",
                      padding: "0.65rem 0.75rem",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: l.id === selectedId ? "#e5f1f8" : "white",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      prioridad: {l.priority} · {l.active ? "ACTIVA" : "INACTIVA"} · {fmtDate(l.validFrom)} → {fmtDate(l.validTo)}
                    </div>
                  </button>
                ))}
                {!lists.length && <div style={{ color: "#6b7280" }}>No hay listas</div>}
              </div>
            )}
          </div>

          {/* Right: items + segmentation */}
          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <h3 style={{ marginTop: 0 }}>Items — {selected?.name || "—"}</h3>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <option value="GLOBAL">GLOBAL</option>
                <option value="SPACE_TYPE">SPACE_TYPE</option>
                <option value="SPACE_ID">SPACE_ID</option>
              </select>

              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
                title="Unidad"
              >
                <option value="HOUR">Por hora</option>
                <option value="HALF_DAY">Medio día</option>
                <option value="DAY">Día entero</option>
                <option value="MONTH">Mes completo</option>
              </select>

              {scope === "SPACE_TYPE" && (
                <select value={spaceType} onChange={(e) => setSpaceType(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  {SPACE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}

              {scope === "SPACE_ID" && (
                <input
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  placeholder="spaceId"
                  style={{ width: 140, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              )}

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Precio"
                style={{ width: 160, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />

              <button
                onClick={addItem}
                style={{ padding: "0.55rem 0.75rem", borderRadius: 8, border: "none", background: "#5686a7ff", color: "white", cursor: "pointer" }}
              >
                Agregar item
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "0.5rem" }}>Scope</th>
                  <th style={{ padding: "0.5rem" }}>Unidad</th>
                  <th style={{ padding: "0.5rem" }}>SpaceType</th>
                  <th style={{ padding: "0.5rem" }}>SpaceId</th>
                  <th style={{ padding: "0.5rem" }}>Precio</th>
                  <th style={{ padding: "0.5rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {(selected?.items || []).map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.5rem" }}>{it.scope}</td>
                    <td style={{ padding: "0.5rem" }}>{it.unit || "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{it.spaceType || "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{it.spaceId ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{Number(it.price).toFixed(2)}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>
                      <button
                        onClick={() => deleteItem(it.id)}
                        style={{ padding: "0.35rem 0.6rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {!selected?.items?.length && (
                  <tr>
                    <td colSpan={6} style={{ padding: "0.75rem", color: "#6b7280" }}>
                      Sin items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Segmentation by Tags */}
            <hr style={{ margin: "24px 0" }} />

            <h3 style={{ marginTop: 0 }}>Segmentación por cliente (Tags)</h3>
            <div style={{ marginBottom: 10, color: "#6b7280", fontSize: 13 }}>
              Si la lista no tiene tags, aplica a todos. Si tiene tags, solo aplica a usuarios que tengan al menos uno de esos tags.
            </div>

            {!selectedId ? (
              <div style={{ color: "#6b7280" }}>Seleccioná una lista para configurar su segmentación.</div>
            ) : !tags?.length ? (
              <div style={{ color: "#6b7280" }}>
                No hay tags. Crealos en la sección de usuarios/campañas y volvé acá.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {tags.map((t) => {
                    const checked = selectedTagIds.includes(t.id);
                    return (
                      <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTagIds((prev) => [...prev, t.id]);
                            else setSelectedTagIds((prev) => prev.filter((id) => id !== t.id));
                          }}
                        />
                        {t.name}
                      </label>
                    );
                  })}
                </div>

                <button
                  onClick={saveTags}
                  style={{ marginTop: 12, padding: "0.55rem 0.75rem", borderRadius: 8, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}
                >
                  Guardar segmentación
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}