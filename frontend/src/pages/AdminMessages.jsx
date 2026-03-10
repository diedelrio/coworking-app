
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

export default function AdminMessages() {
  const [convs, setConvs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");

  async function loadConvs() {
    const { data } = await api.get("/admin/conversations");
    setConvs(data || []);
    if (!selectedId && data?.[0]?.id) setSelectedId(data[0].id);
  }

  async function loadMsgs(id) {
    if (!id) return;
    const { data } = await api.get(`/admin/conversations/${id}/messages`);
    setMessages(data || []);
  }

  useEffect(() => {
    loadConvs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMsgs(selectedId).catch(() => {});
  }, [selectedId]);

  async function send() {
    if (!selectedId || !body.trim()) return;
    await api.post(`/admin/conversations/${selectedId}/messages`, { body });
    setBody("");
    await loadMsgs(selectedId);
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Mensajería — Admin (MVP)</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: una conversación por usuario + mensajes admin/cliente.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem" }}>
          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <h3 style={{ marginTop: 0 }}>Conversaciones</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    textAlign: "left",
                    padding: "0.65rem 0.75rem",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: c.id === selectedId ? "#e5f1f8" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {c.user?.name} {c.user?.lastName}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{c.user?.email}</div>
                </button>
              ))}
              {!convs.length && <div style={{ color: "#6b7280" }}>Sin conversaciones</div>}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <h3 style={{ marginTop: 0 }}>Mensajes</h3>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.75rem", height: 420, overflow: "auto", marginBottom: 10 }}>
              {messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 10, textAlign: m.senderRole === "ADMIN" ? "right" : "left" }}>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "0.5rem 0.75rem",
                      borderRadius: 12,
                      background: m.senderRole === "ADMIN" ? "#e5f1f8" : "#f3f4f6",
                      maxWidth: "80%",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{m.senderRole} · {new Date(m.createdAt).toLocaleString()}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                  </div>
                </div>
              ))}
              {!messages.length && <div style={{ color: "#6b7280" }}>Sin mensajes</div>}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribir…"
                style={{ flex: 1, padding: "0.6rem", borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
              <button onClick={send} style={{ padding: "0.6rem 0.9rem", borderRadius: 10, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
