BLUEPRINT DE ARQUITECTURA — Coworking App (Sinergia)

1. Principios rectores (esto guía todo)
    Antes de entrar en carpetas y código, estas son las reglas del juego:
    Modular Monolith
        Un solo backend
        Módulos bien delimitados
        Sin dependencias circulares
    Separación por dominio, no por capa
        Pricing no sabe cómo se factura
        Billing no decide precios
        Reports no ejecuta lógica de negocio
    Backward compatibility
        Cada cambio nuevo convive con lo viejo
        Nada “big bang”
    Feature flags
        Activar/desactivar módulos sin redeploy completo
    Read models para reportes
        Reportes = lectura pura, optimizada

2. Arquitectura general (visión)

    [ Landing Hostinger ]
            |
            |  (API pública)
            v
    [ CMS Público ] ───────────────┐
                                |
    [ Frontend App ] ───→ [ Backend Modular ]
                                |
                                v
                            [ PostgreSQL ]

3. Backend — Modular Monolith
    
    Estructura base
        src/
        ├─ app.ts
        ├─ server.ts
        ├─ modules/
        ├─ shared/
        └─ config/
    
    Módulos por dominio
        modules/
        ├─ auth/
        ├─ users/
        ├─ spaces/
        ├─ reservations/
        ├─ pricing/
        ├─ contracts/
        ├─ billing/
        ├─ messaging/
        ├─ cms/
        ├─ reports/
    
    Estructura interna de cada módulo
    Ejemplo pricing/:
        pricing/
        ├─ pricing.routes.ts
        ├─ pricing.controller.ts
        ├─ pricing.service.ts
        ├─ pricing.repo.ts
        ├─ pricing.dto.ts
        ├─ pricing.types.ts
        └─ index.ts
    Regla clave
        controller → HTTP + validaciones
        service → reglas de negocio
        repo → Prisma / DB
        reports NO tiene service con lógica de negocio

4. Dominio por dominio (qué hace cada uno)
    4.1 Pricing
    Responsabilidad:
        Listas de precios
        Productos
        Bonos y paquetes
        Cotización (getQuote())
    NO hace:
        Facturación
        Cobros

    4.2 Reservations
    Responsabilidad:
        Crear/modificar reservas
        Aplicar pricing snapshot
        Validar contratos/bonos
    Consume:
        Pricing (quote)
        Contracts (validación)  
    
    4.3 Contracts
        Responsabilidad:
        Contratos mensuales/anuales
        Vigencia
        Relación con espacios/puestos
    NO factura directamente.

    4.4 Billing
    Responsabilidad:
        Liquidaciones
        Facturas
        Recibos / cobranzas
    Consume:
        Reservations (lectura)
        Contracts (lectura)

    4.5 Messaging
    Responsabilidad:
        Conversaciones
        Mensajes
        Notificaciones
        Disparo de emails
    
    4.6 CMS
    Responsabilidad:
        Contenido público
        Versionado (draft / published)
        API pública
    
    4.7 Reports
    Responsabilidad:
        Queries
        Export XLSX
        KPIs simples
        Regla de oro:
    Reports nunca escribe nada

5. Frontend — Feature-based Architecture

Estructura

5.1 Features
    features/
    ├─ adminPricing/
    ├─ adminContracts/
    ├─ adminBilling/
    ├─ adminReports/
    ├─ adminMessaging/
    ├─ adminCMS/
    ├─ clientCatalog/
    ├─ clientInbox/
    ├─ reservations/

Cada feature:
    adminPricing/
    ├─ pages/
    ├─ components/
    ├─ hooks/
    ├─ api.ts
    └─ routes.ts

5.2 Lazy loading
    Cada routes.ts se importa con React.lazy
    Reduce bundle
    Permite crecer sin penalizar UX

6. Base de datos — Diseño evolutivo
    Agrupación lógica (una sola DB)
        PRICING → PriceList, PriceItem, Purchase, UserEntitlement
        CONTRACTS → Contract
        BILLING → Settlement, Invoice, Receipt
        MESSAGING → Conversation, Message, Notification
        CMS → PublicContent

    Estrategia de migraciones
        Agregar tablas/campos
        Deploy
        Backfill (si hace falta)
        Activar feature flag
        Dejar legacy morir solo

7. Feature Flags (críticos)

    Ejemplos:
        FEATURE_PRICING_V2=true
        FEATURE_CONTRACTS=true
        FEATURE_BILLING=true
        FEATURE_MESSAGING=true
        FEATURE_CMS=true
    Uso:
        Backend valida flag antes de exponer endpoints
        Frontend muestra/oculta features

8. Reportes + Excel (estándar único)

Patrón técnico
    GET /admin/reports/<tipo>
    GET /admin/reports/<tipo>?format=xlsx

Internamente:
    mismo query
    mismo mapper
    distinto renderer

Excel:
    generado en backend
    1 hoja
    formato numérico correcto

9. Landing en Hostinger (Headless CMS)

    Flujo
        Admin edita contenido
        Publica
        Landing hace:
            fetch('/public/content/landing')
        Render dinámico

    Con cache + versionado.
    