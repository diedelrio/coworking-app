
import { useEffect, useState } from "react";
import Header from "../components/Header";
import api from "../api/axiosClient";

export default function UserBonos() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/me/entitlements").then(({ data }) => setRows(data || [])).catch(() => {});
  }, []);

  return (
    <div>
      <Header />
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Mis Bonos</h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          Packs de horas disponibles.
        </p>

        <div style={{ background: "white", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Tipo</th>
                <th style={{ padding: "0.5rem" }}>Restante</th>
                <th style={{ padding: "0.5rem" }}>Vence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>{r.type}</td>
                  <td style={{ padding: "0.5rem" }}>{r.remainingAmount} horas</td>
                  <td style={{ padding: "0.5rem" }}>{r.validTo ? new Date(r.validTo).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} style={{ padding: "0.75rem", color: "#6b7280" }}>
                    No tenés bonos activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
