
import { useEffect, useState } from "react";
import Header from "../components/Header";
import api from "../api/axiosClient";

export default function UserMessages() {
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");

  async function loadConv() {
    const { data } = await api.get("/me/conversations");
    const c = data?.[0] || null;
    setConv(c);
    if (c?.id) {
      const m = await api.get(`/me/conversations/${c.id}/messages`);
      setMessages(m.data || []);
    }
  }

  useEffect(() => {
    loadConv().catch(() => {});
  }, []);

  async function send() {
    if (!conv?.id || !body.trim()) return;
    await api.post(`/me/conversations/${conv.id}/messages`, { body });
    setBody("");
    const m = await api.get(`/me/conversations/${conv.id}/messages`);
    setMessages(m.data || []);
  }

  return (
    <div>
      <Header />
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Mensajes</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>Escribile al equipo del coworking.</p>

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.75rem", height: 420, overflow: "auto", marginBottom: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, textAlign: m.senderRole === "CLIENT" ? "right" : "left" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 12,
                    background: m.senderRole === "CLIENT" ? "#e5f1f8" : "#f3f4f6",
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
  );
}
