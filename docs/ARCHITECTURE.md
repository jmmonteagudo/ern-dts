# Ern — Architecture & Design Document

> Documento de referencia para diseño, implementación y revisión del proyecto.
> Última actualización: 2026-05-15

---

## 1. Visión General

**Ern** es un MVP (v0.1) de plataforma de gestión de productos farmacéuticos/químicos construida sobre SAP BTP. Sirve como demostración técnica de capacidades enterprise-grade y arquitectura escalable modular.

### Objetivos del MVP

- App Fiori Elements funcional con extensiones custom verificadas por tests automatizados
- Pipeline CI/CD completo (lint → test → deploy → smoke test)
- Arquitectura preparada para escalar a integración S4H, event-driven y AI

### Naming Convention (referencias internas a Matrix)

| Módulo | Código | Rol |
|--------|--------|-----|
| CI/CD & Quality | **Foundry** | La fábrica que construye y valida |
| Conector S4H / Integración | **Cipher** | El puente entre mundos |
| AI Advisor (AI Core) | **Morpheus** | El guía inteligente |
| Plataforma paraguas | **Ern** | Identidad del producto |

---

## 2. Arquitectura Actual (MVP v0.1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions (Foundry)                       │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────────────┐ │
│  │  Lint    │───▶│  23 Tests    │───▶│  Deploy CF + Smoke Test    │ │
│  │ ESLint   │    │ Jest (unit   │    │  cf push → curl verify     │ │
│  │ CDS chk  │    │ + integration│    │                            │ │
│  └──────────┘    └──────────────┘    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SAP BTP Cloud Foundry (Trial)                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      ern-srv (Node.js)                          │ │
│  │                                                                  │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │ │
│  │  │  CAP Runtime │   │  OData v4    │   │  Static Files    │   │ │
│  │  │  (cds-serve) │   │  /api/*      │   │  /products/webapp│   │ │
│  │  └──────────────┘   └──────────────┘   └──────────────────┘   │ │
│  │         │                   │                                    │ │
│  │         ▼                   ▼                                    │ │
│  │  ┌──────────────────────────────────┐                           │ │
│  │  │     SQLite In-Memory             │                           │ │
│  │  │  (auto-deploy on start)          │                           │ │
│  │  │  Products + AuditLog + CSV seed  │                           │ │
│  │  └──────────────────────────────────┘                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Cliente)                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  SAP Fiori Elements (SAPUI5 1.133.0 CDN)                       │ │
│  │  ┌─────────────────┐    ┌───────────────────────────────────┐ │ │
│  │  │  List Report     │───▶│  Object Page                      │ │ │
│  │  │  - Filtros       │    │  - Header (Stock + Price)         │ │ │
│  │  │  - Criticality   │    │  - FieldGroups (General/Inventory)│ │ │
│  │  │  - Tabla 10 prod │    │  - Audit History (sub-tabla)      │ │ │
│  │  └─────────────────┘    └───────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | SAP CAP (Node.js) | ^7.9 |
| DB | SQLite in-memory (@cap-js/sqlite) | ^1 |
| Frontend | SAP Fiori Elements (OData v4) | SAPUI5 1.133.0 |
| CI/CD | GitHub Actions | v4 actions |
| Deploy | Cloud Foundry (cf push) | BTP Trial us10-001 |
| Test | Jest | ^29 |
| Lint | ESLint | ^8 |
| Auth | Dummy (sin autenticación) | — |

---

## 4. Modelo de Datos

```cds
namespace demo.products;

entity Products {
  key ID            : UUID;
  name              : String(100) @mandatory;
  category          : String(50);
  price             : Decimal(10,2);
  stock             : Integer;
  status            : String(20) enum { available; discontinued; low_stock };
  supplier          : String(100);
  lastUpdated       : Timestamp @cds.on.update: $now;
  stockCriticality  : Integer @Core.Computed;        // Virtual: 1=red, 2=yellow, 3=green
  auditTrail        : Composition of many AuditLog;  // Navigation para Object Page
}

entity AuditLog {
  key ID         : UUID;
  product_ID     : UUID;                             // FK → Products
  entity_name    : String(50);
  entity_id      : String(36);
  action         : String(10) enum { CREATE; UPDATE; DELETE };
  field          : String(50);
  oldValue       : String(255);
  newValue       : String(255);
  user           : String(100);
  timestamp      : Timestamp @cds.on.insert: $now;
}
```

---

## 5. Servicio OData

```cds
service ProductService @(path: '/api') {
  entity Products as projection on db.Products;
  @readonly entity AuditLog as projection on db.AuditLog;
  action flagLowStock(ids: array of UUID) returns String;  // Acción custom
}
```

### Handlers (srv/service.js)

| Hook | Lógica |
|------|--------|
| `before CREATE Products` | Validar price >= 0, stock >= 0 |
| `before UPDATE Products` | Validar price/stock, auto-set `low_stock` si stock < 100 |
| `after READ Products` | Computar `stockCriticality` (0→1, <100→2, >=100→3) |
| `after CREATE Products` | Insertar AuditLog (action=CREATE) |
| `after UPDATE Products` | Insertar AuditLog por cada campo modificado |
| `on flagLowStock` | Bulk update status + audit log |

---

## 6. UI — Fiori Elements

### Annotations (app/products/annotations.cds)

- **HeaderInfo**: TypeName="Product", Title=name, Description=category
- **SelectionFields**: category, status, supplier
- **LineItem**: name, category, price, stock (con Criticality), status (con Criticality), supplier
- **HeaderFacets**: DataPoint#StockLevel (con criticality), DataPoint#Price
- **Facets**: FieldGroup#General, FieldGroup#Inventory, auditTrail/@UI.LineItem
- **AuditLog LineItem**: timestamp, action, field, newValue, user
- **stockCriticality**: @UI.Hidden (campo virtual no visible directamente)

### Extensiones Custom Implementadas

1. **Criticality Coloring** — Colores semáforo en columna stock/status basado en `stockCriticality`
2. **Custom Action (flagLowStock)** — Acción unbound para marcar productos como low_stock en bulk
3. **Audit History Section** — Sección en Object Page con sub-tabla de historial de cambios via Composition

---

## 7. Tests Automatizados

### Service Tests (test/service.test.js) — 13 tests

| Suite | Tests |
|-------|-------|
| READ operations | Listar todos, filtrar por category, filtrar por status, obtener por ID |
| CREATE operations | Crear válido, rechazar price negativo, rechazar stock negativo |
| UPDATE operations | Auto-set low_stock cuando stock < 100 |
| AuditLog | Log en CREATE, log en UPDATE con campos |
| Custom Actions | flagLowStock exitoso, rechazar sin IDs |
| Criticality | Computar stockCriticality según niveles |

### UI Integration Tests (test/ui/integration.test.js) — 10 tests

| Suite | Tests |
|-------|-------|
| Fiori Elements App Serving | index.html, manifest.json, Component.js, i18n |
| OData Metadata | $metadata expose entities, navigation props, actions |
| Fiori Elements Data Contract | $count, $expand auditTrail, stockCriticality select |

### Ejecución

```bash
npm test              # 23 tests
npm run test:coverage # con coverage report
```

---

## 8. Pipeline CI/CD (Foundry)

```yaml
# .github/workflows/ci-cd.yml
Trigger: push/PR a main + workflow_dispatch

Jobs:
  1. lint        → npm ci + cds compile check + eslint --max-warnings 0
  2. test        → npm ci + jest --coverage (artifact: coverage/)
  3. deploy      → cf push + smoke test (solo en push a main)
     - Smoke: curl /api/Products + curl /products/webapp/index.html
```

### Secrets requeridos

| Secret | Descripción |
|--------|-------------|
| CF_API | `https://api.cf.us10-001.hana.ondemand.com` |
| CF_USER | Email del usuario BTP Trial |
| CF_PASSWORD | Password del usuario |
| CF_ORG | `392727e0trial` |
| CF_SPACE | `dev` |

---

## 9. Deploy & Infraestructura

- **Runtime**: Cloud Foundry en BTP Trial (us10-001)
- **App**: `ern-srv` (256MB, nodejs_buildpack)
- **Ruta**: `ern-srv.cfapps.us10-001.hana.ondemand.com`
- **DB**: SQLite in-memory (se regenera en cada restage, datos de CSV)
- **Auth**: Dummy (sin XSUAA/approuter)
- **server.js**: Custom entry point con `cds.env.features.in_memory_db = true`

### Por qué SQLite y no HANA

BTP Trial no incluye HANA Cloud provisionado. SQLite in-memory permite deploy funcional sin dependencias externas. Los datos se cargan desde CSV en cada inicio.

---

## 10. Arquitectura Target (v1.0+)

```
┌────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  S4H Private   │────▶│  SAP Integration    │────▶│  Event Mesh /    │
│  Cloud (ABAP)  │     │  Suite (opcional)    │     │  Cloud Events    │
│                │     │                     │     │                  │
│  - Materials   │     │  - iFlow mappings   │     │  - Product.Changed│
│  - PurchaseOrd │     │  - Error handling   │     │  - Stock.Updated │
│  - BPs         │     │  - Monitoring       │     │                  │
└────────────────┘     └─────────────────────┘     └────────┬─────────┘
                                                             │
                                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Ern Backend (CAP)                             │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │ ProductSrv  │  │ EventHandler │  │ AI Service│  │ Audit Srv  │ │
│  │ (OData v4)  │  │ (consume     │  │ (Morpheus)│  │            │ │
│  │             │  │  events)     │  │           │  │            │ │
│  └─────────────┘  └──────────────┘  └───────────┘  └────────────┘ │
│         │                                    │                       │
│         ▼                                    ▼                       │
│  ┌──────────────┐                   ┌──────────────────┐           │
│  │  HANA Cloud  │                   │  SAP AI Core     │           │
│  │  (prod)      │                   │  (Gen AI Hub)    │           │
│  └──────────────┘                   └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Fiori Elements UI + Custom Extensions                               │
│  - List Report (filtros, criticality, bulk actions)                   │
│  - Object Page (detail, audit, AI suggestions)                       │
│  - Custom Section: AI recommendations (Morpheus)                     │
│  - Custom Action: predictive restock                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Servers (herramientas para agentes AI)                          │
│  - SAP S4H MCP (lectura/escritura via ABAP API)                      │
│  - SAP AI Core MCP (inferencia, embeddings)                          │
│  - Ern MCP (operaciones sobre la plataforma)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Módulos Futuros

| Módulo | Nombre código | Descripción | Dependencias |
|--------|--------------|-------------|--------------|
| Conector S4H | **Cipher** | Integración bidireccional con S4H Private Cloud via OData/RFC. Event-driven con Cloud Events. | Integration Suite (opcional), Event Mesh |
| AI Advisor | **Morpheus** | Recomendaciones inteligentes (restock, anomalías, predicciones) usando SAP AI Core / Gen AI Hub | AI Core, vector embeddings |
| MCP Layer | — | Servers MCP para que agentes AI interactúen con S4H y Ern | MCP protocol, ABAP APIs |

---

## 11. Decisiones de Diseño

| Decisión | Razón |
|----------|-------|
| SQLite en vez de HANA | BTP Trial no provee HANA Cloud. Funcional para MVP. |
| Auth dummy | Sin XSUAA para simplificar deploy en Trial. Futuro: approuter + roles. |
| Sin approuter | CAP sirve estáticos directamente. Menor complejidad. |
| cf push en vez de MTA | Más simple para Trial. MTA para producción con múltiples módulos. |
| Jest + cds.test() | Integración nativa con CAP, in-memory, rápido. |
| Fiori Elements (no freestyle) | Annotation-driven = menos código, más extensible, estándar SAP. |
| ushell sandbox | Fiori Elements requiere servicios de Launchpad. Sandbox los provee sin approuter. |
| Computed stockCriticality | Virtual field calculado en `after READ`, no persistido. Evita sincronización. |
| Composition AuditLog | Permite $expand en Object Page sin joins manuales. |

---

## 12. Estructura del Proyecto

```
ern/
├── app/
│   ├── index.cds                          # Entry point para CDS (importa annotations)
│   └── products/
│       ├── annotations.cds                # UI annotations (HeaderInfo, LineItem, Facets...)
│       └── webapp/
│           ├── index.html                 # Entry point con ushell sandbox
│           ├── manifest.json              # App descriptor (routing, models, datasource)
│           ├── Component.js               # AppComponent (extends sap.fe.core)
│           └── i18n/
│               ├── i18n.properties        # Traducciones base
│               └── i18n_en.properties     # Traducciones EN
├── db/
│   ├── schema.cds                         # Modelo de datos (Products, AuditLog)
│   └── data/
│       └── demo.products-Products.csv     # 10 productos seed (pharma/chemical)
├── srv/
│   ├── service.cds                        # Definición del servicio OData
│   └── service.js                         # Handlers (validación, audit, criticality, action)
├── test/
│   ├── service.test.js                    # 13 tests de backend
│   └── ui/
│       └── integration.test.js            # 10 tests de integración UI
├── server.js                              # Custom server (in_memory_db flag)
├── manifest.yml                           # CF deployment manifest
├── package.json                           # Dependencies + CDS config + scripts
├── .eslintrc                              # ESLint config con CDS globals
└── .github/
    └── workflows/
        └── ci-cd.yml                      # Pipeline: lint → test → deploy
```

---

## 13. URLs & Accesos

| Recurso | URL |
|---------|-----|
| App (producción) | https://ern-srv.cfapps.us10-001.hana.ondemand.com/products/webapp/index.html |
| API OData | https://ern-srv.cfapps.us10-001.hana.ondemand.com/api/ |
| Metadata | https://ern-srv.cfapps.us10-001.hana.ondemand.com/api/$metadata |
| Repo | https://github.com/jmmonteagudo/ern |
| Pipeline | https://github.com/jmmonteagudo/ern/actions |
| BTP Cockpit | https://cockpit.hanatrial.ondemand.com (org: 392727e0trial, space: dev) |

---

## 14. Pendientes Inmediatos

- [ ] Deploy del fix de index.html a CF (funciona local, falta push)
- [ ] Screenshots para PPT (List Report, Object Page, Pipeline verde)
- [ ] Limpiar Sample Applications del sandbox (quitar tiles demo)
- [ ] Agregar custom column fragment visible (más allá del criticality annotation)
- [ ] Validar que Object Page muestra Audit History al navegar

## 15. Pendientes Estratégicos

- [ ] **Cipher**: Diseñar integración S4H (OData consumption model en CDS, o event handlers)
- [ ] **Morpheus**: Conectar SAP AI Core / Gen AI Hub para recomendaciones
- [ ] **MCP**: Implementar MCP servers para interacción agente-S4H
- [ ] **Event-Driven**: Definir eventos de dominio (Product.Changed, Stock.Critical)
- [ ] **HANA**: Migrar a HANA Cloud cuando esté disponible
- [ ] **Auth**: Agregar XSUAA + approuter + roles para producción
- [ ] **Multi-tenant**: Evaluar multi-tenancy si se requiere aislamiento por cliente
