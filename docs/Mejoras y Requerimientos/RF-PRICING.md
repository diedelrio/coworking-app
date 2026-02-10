# RF-PRC-01 — Gestión de Pricing y Listas de Precios

## Descripción
Implementar un modelo desacoplado de precios que permita definir listas de precios, productos y reglas comerciales independientes del espacio.

## Actores
- Administrador
- Sistema

## Alcance
Incluye:
- Listas de precios
- Productos tarifarios
- Reglas de aplicación
No incluye:
- Facturación automática

## Flujos principales
1. Admin crea lista de precios
2. Admin crea productos
3. Sistema aplica pricing en reservas

## Criterios de aceptación
- Se pueden definir múltiples listas activas
- El sistema selecciona la de mayor prioridad

## Impacto técnico
- Backend: módulo pricing
- Frontend: adminPricing
- DB: PriceList, PriceItem
