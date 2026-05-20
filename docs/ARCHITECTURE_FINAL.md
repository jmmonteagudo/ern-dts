# Ern - Architecture Final

> Status: documento rector tecnico
> Fecha de actualizacion: 2026-05-17
> Fuentes: codigo actual, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_CODEX_REVIEW.md`, `docs/ARCHITECTURE_CLAUDE_RESPONSE_2.md` y `docs/ARCHITECTURE_CODEX_RESPONSE_2.md`
> Regla de gobierno: este repo cubre arquitectura, codigo, pipeline, testing y operacion tecnica. Estrategia comercial, marca, pricing y comercializacion viven fuera de `source/ern`.

---

## 1. Tesis

Ern es un demostrador tecnico SAP-native para probar un patron de delivery sobre SAP BTP: una app CAP/Fiori pequena, con contrato OData claro, tests automatizados, pipeline CI/CD y una ruta limpia hacia despliegue en entornos de cliente.

La app actual de productos farmaceuticos/quimicos no debe sobredimensionarse: es el vehiculo de demo. El activo tecnico real es el patron replicable para aplicaciones Fiori/CAP con calidad, pipeline y trazabilidad desde el dia uno.

La arquitectura final prioriza:

- CAP + CDS como backend y modelo de dominio.
- OData v4 como contrato principal.
- Fiori Elements como UI oficial del MVP.
- Cloud Foundry como runtime inicial.
- CI/CD y tests como parte del producto tecnico.
- Preparacion para despliegue en cliente sin cerrar una evolucion SaaS futura.
- Tres olas de roadmap, con Wave 1 deliberadamente simple.

---

## 2. Principios

1. **Primero verdad, despues ambicion.** El documento distingue estado actual, proximo paso y vision futura.
2. **SAP-native por defecto.** CAP, CDS, OData, Fiori, BTP, HANA, XSUAA/IAS y Event Mesh tienen preferencia cuando resuelven el problema.
3. **Un monolito modular antes que microservicios.** Mientras el dominio sea pequeno, CAP modular es la unidad correcta.
4. **Nada de interfaces duplicadas sin consumidor real.** GraphQL, MCP write y APIs paralelas requieren justificacion explicita.
5. **AI solo con grounding y gobierno.** No entra antes de persistencia, identidad, trazabilidad y datos suficientes.
6. **Demo honesta.** SQLite in-memory y dummy auth son decisiones validas de Trial/demo, no patrones de produccion.
7. **Customer-deployable.** El repo no debe asumir que solo corre en un Trial propio; org, space, route, host y secrets deben ser parametrizables.
8. **Pequenos cambios seguros.** Se favorecen ajustes incrementales, testeados y reversibles.

---

## 3. Alcance Actual

Arquitectura existente:

```text
Browser
  |
  v
SAP Fiori Elements app
  - List Report
  - Object Page
  - annotations-driven UI
  |
  v
CAP Node.js ProductService at /api
  - Products projection
  - readonly AuditLog projection
  - flagLowStock action
  - validation, audit, computed criticality
  |
  v
SQLite in-memory
  - CSV seed data on startup
```

Pipeline configurado actualmente:

```text
push / pull_request
  -> npm ci
  -> cds compile check
  -> eslint
  -> jest service + UI integration tests
  -> wdi5 E2E configured as blocking gate
  -> cf push on main
  -> smoke test /api/Products and /products/webapp/index.html
```

Estado verificado localmente:

| Check | Resultado |
|---|---|
| `npm run lint -- --max-warnings 0` | FAIL: warning por import `wdi5` no usado en `test/e2e/specs/listReport.spec.js` |
| `npm test` | OK, 27 tests |
| `npx cds compile srv/ --to json` | OK |
| `npx cds compile srv/ --to sql` | OK |
| E2E wdi5 | Falla: `wait-on` usa `HEAD` contra CAP OData; al sortear ese bloqueo, wdi5 no inyecta UI5 bridge |

Interpretacion: lint, compile y Jest son gates duros sanos. wdi5 existe y debe mantenerse visible, pero la recomendacion es no bloquear deploy con ese job hasta estabilizar el harness.

---

## 4. Modelo de Dominio

### Products

Entidad raiz del MVP. Representa producto inventariable con nombre, categoria, precio, stock, estado, proveedor y fecha de actualizacion.

Reglas actuales:

- `name` es obligatorio.
- `price` no puede ser negativo.
- `stock` no puede ser negativo.
- Si `stock < 100` en update, el estado se marca como `low_stock`.
- `stockCriticality` alimenta la UI con semaforo:
  - `1`: stock igual a 0.
  - `2`: stock entre 1 y 99.
  - `3`: stock igual o superior a 100.

Decision aplicada: `stockCriticality` es `virtual`, no columna persistida. La salida SQL ya no la materializa.

### AuditLog

Entidad de trazabilidad de demo asociada a `Products`.

Reglas actuales:

- Se crea una entrada en `CREATE`.
- Se crea una entrada por campo modificado en `UPDATE`.
- Se crea una entrada por producto en `flagLowStock`.
- La entidad se expone como readonly en OData.

Restriccion: no es todavia audit enterprise. No captura old values reales, actor autenticado ni delete handling completo. Esa madurez pertenece a Wave 2.

---

## 5. Contrato de Servicio

Servicio unico:

```cds
service ProductService @(path: '/api') {
  entity Products as projection on db.Products;
  @readonly entity AuditLog as projection on db.AuditLog;

  action flagLowStock(ids: array of UUID) returns String;
}
```

Decisiones:

- OData v4 es el contrato canonico.
- No se implementa GraphQL en MVP.
- No se versiona la API todavia; se mantiene estable por convencion y tests.
- Las acciones de negocio deben dejar audit log.
- Las futuras integraciones deben consumir/adaptar este contrato, no saltarselo.

---

## 6. UI

La UI oficial del MVP es Fiori Elements:

- List Report para exploracion y filtrado.
- Object Page para detalle.
- Anotaciones CDS para header, line items, facets, datapoints y audit history.
- SAPUI5 cargado desde CDN pinneado para la demo.

Decisiones:

- No se construye UI freestyle mientras Fiori Elements cubra el flujo.
- Las extensiones custom deben ser pequenas, probadas y justificadas.
- El Object Page debe seguir mostrando Audit History via navigation property.
- La experiencia visual se gobierna por anotaciones y convenciones SAP.

wdi5:

- Los specs E2E son utiles como direccion.
- Hoy fallan con `Cannot read properties of undefined (reading 'waitForUI5Options')`.
- Deben estabilizarse antes de convertirse en gate obligatorio.

---

## 7. Runtime e Infraestructura

### MVP

| Capa | Decision |
|---|---|
| Runtime | Cloud Foundry, app unica `ern-srv` |
| DB | SQLite in-memory |
| Auth | dummy auth |
| Static assets | servidos por CAP |
| Deploy | `cf push` |
| Descriptor | `manifest.yml` |

Estas decisiones son aceptadas solo para Trial/demo. La perdida de datos en restage es comportamiento esperado.

### Customer Deployment Readiness

El patron debe poder instalarse en el entorno del cliente sin editar codigo:

- `CF_API`, `CF_ORG`, `CF_SPACE`, usuario/password o credenciales equivalentes viven como secrets.
- Route, host y nombre de app no deben quedar acoplados a un Trial concreto.
- El setup debe documentar prerrequisitos, comandos y smoke tests.
- La CI debe fallar ante lint/compile/unit tests, no ante probes incompatibles con CAP.
- El endpoint de disponibilidad debe evolucionar a `health/readiness` en Wave 2.

### Produccion futura

| Capa | Decision futura |
|---|---|
| DB | HANA Cloud |
| Auth | XSUAA/IAS + approuter |
| Packaging | MTA o descriptor equivalente |
| Observability | structured logs, health/readiness, correlation id, Cloud Logging/OpenTelemetry |
| Secrets | servicios BTP vinculados, no configuracion manual dispersa |

---

## 8. Seguridad

MVP:

- Sin autenticacion real.
- Sin roles.
- Sin autorizacion por accion.
- Sin datos sensibles reales.

Wave 2:

- XSUAA/IAS.
- Roles minimos: viewer, product-maintainer, auditor, admin.
- Restricciones CAP por entidad/accion.
- Actor real en audit.
- Smoke tests autenticados.

Wave 3:

- Politicas especificas para integraciones S4H.
- Permisos de agente MCP separados de permisos humanos.
- Escrituras de agentes solo allowlisted, auditadas e idempotentes.

---

## 9. Multitenancy

Decision actual: single-tenant customer-deployed.

Decision futura: multitenancy-ready, no multitenant activo.

No se activa `cds-mtxs` en Wave 1. Preparar no significa implementar. Significa evitar decisiones que harian caro migrar despues:

- No hardcodear tenant/client/org/space.
- No mezclar configuracion operativa con datos de negocio.
- No asumir que una unica DB compartida sera valida para todos los futuros modos.
- No introducir estado global mutable dependiente de usuario, cliente o tenant.
- No saltarse CAP para lecturas/escrituras futuras.
- No acoplar tests o seeds a rutas productivas fijas.

`cds-mtxs` solo entra en Wave 3 si el modelo tecnico exige SaaS real.

---

## 10. Observability

MVP:

- Logs de runtime CAP.
- Smoke tests HTTP en deploy.
- Tests automatizados de servicio y UI contract.

Wave 2:

- Endpoint de health/readiness.
- Logs estructurados.
- Correlation/request id.
- Metricas basicas de latencia/error rate.
- OpenTelemetry y SAP Cloud Logging si el entorno lo permite.
- Runbook tecnico de diagnostico y upgrade.

Wave 3:

- Trazas distribuidas S4H/Event Mesh/AI.
- Alertas por integracion rota, backlog de eventos y fallos de inferencia.

---

## 11. ABAP Cloud + ATC

ABAP Cloud + ATC es un requisito tecnico complementario, no un blocker del MVP CAP/Fiori.

Posicionamiento:

- Wave 1: documentar patron opcional y secrets esperados. No activar como gate.
- Wave 2: implementar contra sistema ABAP real usando ADT/ATC APIs, gCTS o tooling SAP validado por el entorno del cliente.
- Wave 3: integrar resultados ATC en una vista operativa unificada si existe necesidad real.

No se acepta un step ATC productivo sin:

- Host y autenticacion reales.
- Object set definido.
- Politica de severidad.
- Polling y timeout claros.
- Manejo de findings reproducible.

---

## 12. Eventos

No hay broker de eventos en MVP.

Eventos canonicos futuros:

| Evento | Emisor | Consumidores probables |
|---|---|---|
| `Product.Created` | ProductService | Audit, S4H sync, analytics |
| `Product.Changed` | ProductService | S4H sync, cache, analytics |
| `Stock.Critical` | ProductService | alerts, procurement |
| `Product.Discontinued` | ProductService | S4H sync, UI notifications |

Decision:

- Wave 1 define nombres y payload conceptual, pero no publica.
- Wave 2 introduce outbox/messaging si hay consumidores.
- Wave 3 usa Event Mesh con CloudEvents.
- Kafka solo se evalua si el cliente ya lo exige como backbone corporativo.

---

## 13. S4H, AI y MCP

Estas capacidades no forman parte del MVP.

S4H:

- Se integra por APIs estandar OData cuando sea posible.
- Cloud Connector se usa si el sistema esta en red privada.
- Integration Suite se usa si hacen falta mapping, retries, monitoring o desacoplamiento operacional.
- RFC es ultimo recurso.

AI:

- Entra solo cuando haya datos persistentes, identidad y trazabilidad.
- Casos aceptables: restock, anomalias, explicacion de cambios y consultas read-only con grounding.
- No se aceptan prompts sin grounding ni escritura automatica sin aprobacion.

MCP:

- Es interfaz futura para agentes, no dependencia del MVP.
- Empieza read-only.
- Escritura solo despues de auth, roles, idempotency keys, audit y confirmacion para operaciones sensibles.
- MCP no debe saltarse CAP.

---

## 14. Roadmap en 3 Olas

### Wave 1 - MVP Simple y Pulido

Objetivo: demostrar un patron SAP BTP defendible con una app pequena y pipeline real.

Incluye:

- CAP OData v4 `ProductService`.
- Fiori Elements List Report/Object Page como vehiculo de demo.
- `Products`, `AuditLog`, `flagLowStock`, `stockCriticality`.
- SQLite in-memory y CSV seed.
- Dummy auth.
- CI/CD con compile, lint, Jest, deploy y smoke.
- Documentacion de despliegue parametrizable.
- No-go patterns de multitenancy-ready.
- Patron ABAP/ATC documentado como opcional, no activo.

Correcciones propuestas antes de cerrar Wave 1:

- Hacer wdi5 E2E visible pero no bloqueante hasta quedar estable.
- Parametrizar `baseUrl` de wdi5 via `BASE_URL`.
- Cambiar el probe de `wait-on` a GET, no HEAD, para CAP OData.
- Resolver la inyeccion UI5 bridge antes de declarar E2E como gate duro.

Exit criteria:

- `npm run lint -- --max-warnings 0` verde.
- `npm test` verde.
- `npx cds compile srv/ --to json` verde.
- `npx cds compile srv/ --to sql` verde.
- Deploy y smoke test reproducibles.
- Fallo wdi5 documentado y convertido en backlog tecnico claro.

Fuera de alcance:

- HANA Cloud.
- XSUAA/approuter.
- Event Mesh.
- S4H real.
- AI Core.
- MCP.
- GraphQL.
- `cds-mtxs` activo.
- ATC real como gate.

### Wave 2 - Hardening Enterprise

Objetivo: convertir la demo en base enterprise desplegable con confianza.

Incluye:

- HANA Cloud.
- XSUAA/IAS + approuter + roles.
- Packaging BTP mas completo.
- Audit trail con actor real, old/new values, delete handling y retention.
- Observability: health, readiness, logs estructurados, correlation id.
- Runbook tecnico y health-check reproducible.
- wdi5 estabilizado como gate duro o reemplazado por una alternativa comprobable.
- ABAP Cloud + ATC real con sistema disponible.
- Tests de contrato OData mas exhaustivos.
- Eventos de dominio definidos con outbox preparado si hay consumidores.
- Parametrizacion completa de deploy en cliente.

Exit criteria:

- Datos sobreviven restage.
- Usuarios y roles gobiernan acciones.
- Audit soporta trazabilidad real.
- Pipeline falla ante vulnerabilidades criticas runtime.
- Smoke test valida servicio y UI en entorno autenticado.
- ATC falla solo ante findings definidos y reproducibles.

### Wave 3 - Plataforma Conectada e Inteligente

Objetivo: conectar Ern al paisaje SAP y habilitar inteligencia gobernada solo si hay caso real.

Incluye:

- S4H adapter y reconciliacion.
- Event Mesh + CloudEvents.
- AI Core / Gen AI Hub con grounding.
- MCP read-only para agentes.
- Escrituras de agentes solo con gobierno explicito.
- HANA Vector si existe corpus y caso RAG real.
- Multitenancy / `cds-mtxs` solo si el modelo tecnico exige SaaS real.
- GraphQL solo si aparece consumidor que no pueda operar bien con OData.

Exit criteria:

- Integracion S4H tiene ownership y errores definidos.
- Eventos tienen schema, versionado y consumidores reales.
- AI produce explicaciones trazables, no respuestas opacas.
- MCP no puede ejecutar operaciones fuera de su allowlist.
- Multitenancy se valida con tenants reales, no por deseo de roadmap.

---

## 15. Decisiones Arquitectonicas

| ID | Decision | Estado |
|---|---|---|
| ADR-001 | CAP Node.js es backend principal | Aprobada |
| ADR-002 | OData v4 es API canonica | Aprobada |
| ADR-003 | Fiori Elements es UI principal | Aprobada |
| ADR-004 | Cloud Foundry es runtime MVP | Aprobada |
| ADR-005 | SQLite in-memory solo para Trial/demo | Aprobada con limite |
| ADR-006 | Dummy auth solo para MVP | Aprobada con limite |
| ADR-007 | No GraphQL en MVP | Aprobada |
| ADR-008 | No Event Mesh en MVP | Aprobada |
| ADR-009 | Event Mesh preferido sobre Kafka en paisaje SAP | Propuesta |
| ADR-010 | No MCP write antes de Wave 3 | Aprobada |
| ADR-011 | AI solo con grounding, persistencia e identidad | Aprobada |
| ADR-012 | ABAP Cloud no reemplaza CAP para Ern | Aprobada |
| ADR-013 | Despliegue actual single-tenant en entorno cliente/CF | Aprobada |
| ADR-014 | Multitenancy-ready sin activar `cds-mtxs` en Wave 1 | Aprobada |
| ADR-015 | ABAP/ATC documentado en Wave 1, real en Wave 2 | Aprobada |
| ADR-016 | La app Fiori actual es vehiculo de demo del patron | Aprobada |
| ADR-017 | wdi5 no bloquea deploy hasta estar estable | Aprobada temporal |

---

## 16. Criterios de Aceptacion Globales

Un cambio de arquitectura solo se acepta si:

1. Tiene usuario, consumidor o riesgo concreto.
2. Esta ubicado en Wave 1, Wave 2 o Wave 3.
3. Declara impacto en modelo, servicio, UI, seguridad, operacion y tests.
4. No duplica contratos existentes sin justificacion.
5. Incluye prueba automatizada o razon explicita para no tenerla.
6. Actualiza este documento antes o junto al codigo.
7. Mantiene separado el alcance tecnico de cualquier estrategia comercial externa.

---

## 17. Resumen Final

Ern gana por precision. El MVP no necesita aparentar amplitud; necesita ser dificil de discutir. CAP, Fiori Elements, OData, tests y pipeline ya dan una base seria. La siguiente jugada es terminar de estabilizar la entrega tecnica: customer deployment, wdi5 confiable, ATC documentado y una ruta enterprise sin inflar Wave 1.

Ese es el camino recomendado.
