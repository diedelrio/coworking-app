# RF-FAC-01 — Facturación y Cobranzas

## Descripción
Emitir facturas y registrar pagos asociados.

## Actores
- Administrador

## Alcance
Incluye facturas y recibos.
No incluye integración contable externa.

## Criterios de aceptación
- Factura puede tener uno o más pagos
- Estado se actualiza automáticamente

## Impacto técnico
- Backend: billing
- Frontend: adminBilling
- DB: Invoice, Receipt
