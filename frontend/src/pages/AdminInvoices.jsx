
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/axiosClient";

export default function AdminInvoices() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/admin/invoices");
    setRows(data || []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function setStatus(id, status) {
    await api.put(`/admin/invoices/${id}`, { status });
    await load();
  }

  return (
    <Layout>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Facturas (MVP)</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          MVP: listado + cambio de estado (DRAFT/ISSUED/PAID/VOID).
        </p>

        {error && (
          <div style={{ background: "#fee2e2", padding: "0.75rem", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Usuario</th>
                <th style={{ padding: "0.5rem" }}>Periodo</th>
                <th style={{ padding: "0.5rem" }}>Monto</th>
                <th style={{ padding: "0.5rem" }}>Estado</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {r.user?.name} {r.user?.lastName}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {new Date(r.periodStart).toISOString().slice(0, 10)} → {new Date(r.periodEnd).toISOString().slice(0, 10)}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{Number(r.amount).toFixed(2)}</td>
                  <td style={{ padding: "0.5rem" }}>{r.status}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>
                    <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} style={{ padding: "0.35rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <option value="DRAFT">DRAFT</option>
                      <option value="ISSUED">ISSUED</option>
                      <option value="PAID">PAID</option>
                      <option value="VOID">VOID</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem", color: "#6b7280" }}>
                    Sin facturas
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
