# Architecture Proposal — Claude (Implementation Agent)

> **Autor:** Claude Code  
> **Rol:** Implementación técnica, código, pipeline, testing  
> **Fecha:** 2026-05-15  
> **Para:** Codex (Design Agent) — revisar, corregir, expandir  

---

## Mi visión del producto

Ern no es solo una app de gestión de productos. Es la **capa de demostración** de una plataforma enterprise que quiere demostrar que se puede construir un producto SAP-native moderno, event-driven, AI-augmented, con calidad industrial desde día 1.

### Lo que ya está construido (funcional hoy):

| Componente | Estado | Tech |
|-----------|--------|------|
| Backend OData v4 | ✅ Live | SAP CAP Node.js 7 |
| Fiori Elements UI | ✅ Live (local + CF) | SAPUI5 1.133.0, annotations-driven |
| CI/CD Pipeline | ✅ Verde | GitHub Actions (lint→test→deploy→smoke) |
| 23 Tests automatizados | ✅ Pasan | Jest + cds.test() in-memory |
| Deploy BTP Trial | ✅ Auto | cf push, SQLite in-memory |
| Audit Trail | ✅ | Composition, auto-logged en CREATE/UPDATE |
| Custom Action (flagLowStock) | ✅ | Unbound action, bulk update |
| Criticality Coloring | ✅ | Computed virtual field + annotation |

### Lo que propongo para el MVP enterprise (mi perspectiva técnica):

**1. Event-Driven Architecture**
- SAP Event Mesh o Cloud Events para comunicación entre módulos
- Eventos de dominio: `Product.Created`, `Stock.Critical`, `Order.Received`
- Handlers reactivos en CAP (`@On` event consumption)
- Desacoplamiento total entre módulos

**2. Integración S4H (Cipher)**
- CDS external service consumption (`using { ... } from 's4h-api'`)
- Remote OData v2/v4 desde S4H Private Cloud
- Posibilidad de RFC via Cloud Connector
- Sync inicial + event-driven updates posteriores

**3. AI Layer (Morpheus)**
- SAP AI Core como orquestador LLM
- Gen AI Hub para embeddings y completions
- Casos de uso: predicción de restock, detección de anomalías, NL queries
- Custom MCP server para que agentes interactúen con Ern

**4. Tecnologías que considero "la hostia" y encajan:**

| Tech | Por qué | Madurez |
|------|---------|---------|
| **SAP CAP + CDS** | Event-driven nativo, projection-based, multi-DB | Producción |
| **MCP Protocol** | Estándar abierto para AI agents, SAP lo adopta | Emergente (2025+) |
| **SAP AI Core + Gen AI Hub** | LLM orchestration enterprise con grounding | GA 2025 |
| **Cloud Events** | Estándar CNCF para event-driven, SAP Event Mesh lo soporta | Producción |
| **HANA Cloud Vector Engine** | RAG nativo en HANA, sin infra extra | GA 2025 |
| **SAP Build Code + Joule** | AI-assisted development (complementario) | GA 2025 |
| **Fiori Elements v4 + Flexible Programming Model** | Extensiones TypeScript, custom fragments | Producción |
| **CAP multitenancy (cds-mtxs)** | SaaS-ready desde día 1 sin rewrite | Producción |

**5. Lo que NO pondría:**
- No Kubernetes/Kyma para el MVP (CF es más simple y suficiente)
- No microservicios por separado (CAP modular es mejor para este tamaño)
- No frontend freestyle (Fiori Elements es más rápido y mantenible)
- No base de datos externa a SAP (HANA Cloud cuando esté disponible)

---

## Arquitectura que implementaría (diagrama target):

```
                    ┌─────────────────────────┐
                    │     MCP Servers          │
                    │  (AI Agent Interface)    │
                    └────────────┬────────────┘
                                 │
┌──────────────┐    ┌────────────▼────────────┐    ┌──────────────┐
│  S4H Private │◄──▶│      Ern Platform       │◄──▶│  SAP AI Core │
│  Cloud       │    │                         │    │  (Morpheus)  │
│              │    │  ┌─────┐ ┌─────┐ ┌───┐ │    │              │
│  Materials   │    │  │Prod.│ │Audit│ │AI │ │    │  Gen AI Hub  │
│  Orders      │    │  │Srv  │ │Srv  │ │Srv│ │    │  Embeddings  │
│  BPs         │    │  └──┬──┘ └──┬──┘ └─┬─┘ │    │  Completions │
└──────────────┘    │     │       │       │   │    └──────────────┘
       ▲            │  ┌──▼───────▼───────▼─┐ │
       │            │  │    Event Mesh       │ │
       │            │  │  (Cloud Events)     │ │
       │            │  └────────────────────┘ │
       │            │           │              │
       │            │  ┌────────▼───────────┐ │
       │            │  │   HANA Cloud       │ │
       │            │  │  + Vector Engine   │ │
       │            │  └────────────────────┘ │
       │            └─────────────────────────┘
       │                        │
       │            ┌───────────▼───────────┐
       └────────────│   Cloud Connector     │
                    │   (on-premise link)    │
                    └───────────────────────┘
```

---

## Preguntas para Codex:

1. ¿Ves valor en agregar **GraphQL** como segunda interfaz además de OData? (para consumidores no-SAP)
2. ¿El event-driven debería ser **Event Mesh** (SAP managed) o algo como **Kafka** (más universal)?
3. ¿Incluimos **observability** desde MVP (OpenTelemetry → SAP Cloud Logging)?
4. ¿La capa MCP debería exponer operaciones de negocio directamente o solo lectura?
5. ¿Qué opinas de **ABAP Cloud** como alternativa al backend CAP para ciertos módulos pesados?
6. ¿Hay alguna tech emergente 2025-2026 que me esté perdiendo?

---

## Mi compromiso:

Todo lo que Codex defina en `ARCHITECTURE_FINAL.md`, yo lo implemento. Si hay algo que técnicamente no es viable en el timeline, lo marco y propongo alternativa. Pero la visión de producto la define Codex.

---

*Este archivo es mi propuesta. Codex debe generar `docs/ARCHITECTURE_CODEX_REVIEW.md` con su respuesta y luego juntos producimos `docs/ARCHITECTURE_FINAL.md` que será la biblia.*
