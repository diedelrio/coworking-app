
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

export default function AdminContracts() {
  const [contracts, setContracts] = useState([]);
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);

  const [userId, setUserId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("MONTHLY");
  const [amount, setAmount] = useState("250");
  const [error, setError] = useState("");

  async function load() {
    const [c, u, s] = await Promise.all([
      api.get("/admin/contracts"),
      api.get("/users"),
      api.get("/spaces"),
    ]);
    setContracts(c.data || []);
    setUsers(u.data || []);
    setSpaces(s.data || []);
    if (!userId && u.data?.[0]?.id) setUserId(String(u.data[0].id));
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createContract() {
    setError("");
    try {
      if (!userId || !startDate) return;
      await api.post("/admin/contracts", {
        userId: Number(userId),
        spaceId: spaceId ? Number(spaceId) : null,
        startDate: new Date(startDate).toISOString(),
        billingPeriod,
        amount: Number(amount),
      });
      setStartDate("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error creando contrato");
    }
  }

  async function generateInvoice(contractId) {
    const period = prompt("Periodo (YYYY-MM)", new Date().toISOString().slice(0, 7));
    if (!period) return;
    await api.post(`/admin/contracts/${contractId}/invoices/generate?period=${encodeURIComponent(period)}`);
    alert("Factura (draft) generada/actualizada");
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Contratos — Puestos fijos (MVP)</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: crear contrato + generar factura draft por período (YYYY-MM).
        </p>

        {error && (
          <div style={{ background: "#fee2e2", padding: "0.75rem", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nuevo contrato</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <option value="">Usuario…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.lastName} ({u.email})
                </option>
              ))}
            </select>

            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <option value="">(Opcional) Espacio…</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </select>

            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }} />

            <select value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <option value="MONTHLY">Mensual</option>
              <option value="YEARLY">Anual</option>
            </select>

            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" style={{ width: 120, padding: "0.5rem", borderRadius: 8, border: "1px solid #e5e7eb" }} />

            <button onClick={createContract} style={{ padding: "0.6rem 0.8rem", borderRadius: 8, border: "none", background: "#33576f", color: "white", cursor: "pointer" }}>
              Crear
            </button>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <h3 style={{ marginTop: 0 }}>Contratos</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Usuario</th>
                <th style={{ padding: "0.5rem" }}>Espacio</th>
                <th style={{ padding: "0.5rem" }}>Inicio</th>
                <th style={{ padding: "0.5rem" }}>Periodo</th>
                <th style={{ padding: "0.5rem" }}>Monto</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {c.user?.name} {c.user?.lastName}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{c.space ? c.space.name : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{new Date(c.startDate).toLocaleDateString()}</td>
                  <td style={{ padding: "0.5rem" }}>{c.billingPeriod}</td>
                  <td style={{ padding: "0.5rem" }}>{Number(c.amount).toFixed(2)}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>
                    <button
                      onClick={() => generateInvoice(c.id)}
                      style={{ padding: "0.35rem 0.6rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}
                    >
                      Generar factura
                    </button>
                  </td>
                </tr>
              ))}
              {!contracts.length && (
                <tr>
                  <td colSpan={6} style={{ padding: "0.75rem", color: "#6b7280" }}>
                    Sin contratos
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
