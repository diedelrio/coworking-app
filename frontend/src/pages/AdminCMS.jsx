
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

export default function AdminCMS() {
  const [rows, setRows] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/admin/cms");
    setRows(data || []);
    if (!selectedKey && (data?.[0]?.key || "")) {
      setSelectedKey(data[0].key);
      setContent(data[0].content || "");
      setPublished(Boolean(data[0].published));
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const row = rows.find((r) => r.key === selectedKey);
    if (!row) return;
    setContent(row.content || "");
    setPublished(Boolean(row.published));
  }, [selectedKey]);

  async function save() {
    setError("");
    try {
      const { data } = await api.put(`/admin/cms/${encodeURIComponent(selectedKey)}`, { content, published });
      // refresh list
      const next = rows.map((r) => (r.key === data.key ? data : r));
      if (!next.find((r) => r.key === data.key)) next.push(data);
      setRows(next.sort((a, b) => a.key.localeCompare(b.key)));
      alert("Guardado");
    } catch (e) {
      setError(e?.response?.data?.message || "Error guardando");
    }
  }

  function addNew() {
    const key = prompt("Key (ej: HOME_HERO, HOME_ABOUT, PRICING_TEXT)");
    if (!key) return;
    setSelectedKey(key);
    setContent("");
    setPublished(false);
    if (!rows.find((r) => r.key === key)) setRows([...rows, { key, content: "", published: false }].sort((a, b) => a.key.localeCompare(b.key)));
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>CMS — Contenido público</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: clave/valor con publish. El público consume /api/public/content (solo publicados).
        </p>

        {error && (
          <div style={{ background: "#fee2e2", padding: "0.75rem", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1rem" }}>
          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginTop: 0 }}>Keys</h3>
              <button onClick={addNew} style={{ padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}>
                + Nueva
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setSelectedKey(r.key)}
                  style={{
                    textAlign: "left",
                    padding: "0.65rem 0.75rem",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: r.key === selectedKey ? "#e5f1f8" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{r.key}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{r.published ? "PUBLICADO" : "NO publicado"}</div>
                </button>
              ))}
              {!rows.length && <div style={{ color: "#6b7280" }}>Sin contenido</div>}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <h3 style={{ marginTop: 0 }}>Editar — {selectedKey || "—"}</h3>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicado
            </label>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              style={{ width: "100%", padding: "0.75rem", borderRadius: 10, border: "1px solid #e5e7eb", fontFamily: "monospace" }}
              placeholder="Contenido (texto o JSON string)"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={save} style={{ padding: "0.6rem 0.9rem", borderRadius: 8, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
