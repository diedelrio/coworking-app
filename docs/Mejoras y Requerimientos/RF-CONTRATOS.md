# RF-CTR-01 — Contratos de Puestos Fijos

## Descripción
Gestión de contratos mensuales y anuales para puestos fijos.

## Actores
- Administrador
- Usuario (lectura)

## Alcance
Incluye creación, facturación y visualización.
No incluye autogeneración de reservas.

## Criterios de aceptación
- Solo admin puede modificar contratos
- Usuario ve condiciones en su perfil

## Impacto técnico
- Backend: contracts, billing
- Frontend: adminContracts, userProfile
- DB: Contract, Invoice
