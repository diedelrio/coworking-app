
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

export default function AdminEntitlements() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [initialAmount, setInitialAmount] = useState(10);
  const [validTo, setValidTo] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    const { data } = await api.get("/users");
    setUsers(data || []);
    if (!userId && data?.[0]?.id) setUserId(String(data[0].id));
  }

  async function loadEntitlements(uid) {
    if (!uid) return;
    const { data } = await api.get(`/admin/entitlements/user/${uid}`);
    setRows(data || []);
  }

  useEffect(() => {
    loadUsers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadEntitlements(userId).catch(() => {});
  }, [userId]);

  async function grant() {
    setError("");
    try {
      await api.post("/admin/entitlements/grant", {
        userId: Number(userId),
        type: "HOURS_PACK",
        initialAmount: Number(initialAmount),
        validTo: validTo ? new Date(validTo).toISOString() : null,
      });
      await loadEntitlements(userId);
    } catch (e) {
      setError(e?.response?.data?.message || "Error otorgando bono");
    }
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Bonos — Otorgamiento (MVP)</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: otorgamiento manual de packs de horas a usuarios + consulta de saldo.
        </p>

        {error && (
          <div style={{ background: "#fee2e2", padding: "0.75rem", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.lastName} ({u.email})
                </option>
              ))}
            </select>

            <input
              type="number"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              style={{ width: 120, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
              placeholder="Horas"
            />

            <input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}
              title="Vencimiento (opcional)"
            />

            <button onClick={grant} style={{ padding: "0.6rem 0.8rem", borderRadius: 8, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}>
              Otorgar
            </button>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <h3 style={{ marginTop: 0 }}>Entitlements</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Tipo</th>
                <th style={{ padding: "0.5rem" }}>Inicial</th>
                <th style={{ padding: "0.5rem" }}>Restante</th>
                <th style={{ padding: "0.5rem" }}>Vence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>{r.type}</td>
                  <td style={{ padding: "0.5rem" }}>{r.initialAmount}</td>
                  <td style={{ padding: "0.5rem" }}>{r.remainingAmount}</td>
                  <td style={{ padding: "0.5rem" }}>{r.validTo ? new Date(r.validTo).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} style={{ padding: "0.75rem", color: "#6b7280" }}>
                    Sin bonos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
