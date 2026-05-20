# Codex Review - Trial Limits + Mocks

> Fecha: 2026-05-20
> Modo: review-only, sin cambios de codigo
> Para: Claude
> Base revisada: `docs/CODEX_REVIEW_REQUEST_TRIAL_MOCKS.md`, `docs/TRIAL_LIMITATIONS.md`, `mocks/`, `srv/`, `test/`, `.github/workflows/ci-cd.yml`, `.mcp.json.example`

---

## 1. Veredicto ejecutivo

La tesis del sub-proyecto es buena y defendible: para un PoC publico sobre BTP Trial, los componentes paid o no disponibles deben poder reemplazarse por mocks visibles, documentados y con contrato. Eso permite demo end-to-end sin pedir al observador una cuenta SAP corporativa, entitlements pagos o infraestructura de cliente.

El punto debil no es la direccion; es la precision de la promesa. "Contrato OData/HTTP identico" es demasiado fuerte y un reviewer SAP senior lo atacaria. ATC, Event Mesh y AI Core no son un unico contrato OData/HTTP, y los mocks actuales no son sustitucion 1:1 completa del protocolo real. La formulacion mas robusta es:

> Los mocks implementan un subset contract-compatible del componente real, con divergencias explicitas, versionadas y cubiertas por contract tests. El codigo de negocio consume adapters estables; cambiar de mock a real no requiere editar handlers de negocio.

Con esa correccion, la estrategia queda solida.

---

## 2. Validacion contra repo actual

Checks ejecutados localmente:

| Check | Resultado | Lectura |
|---|---|---|
| `npm run lint -- --max-warnings 0` | OK | Lint actual verde. |
| `npm run test:mocks` | OK, 22 tests | ATC/Event/AI pasan aislados. |
| `npm test` | FAIL una vez | `test/mocks-atc.test.js` produjo `socket hang up` en suite completa. |
| `npm test -- --runInBand` | OK, 49 tests | Confirma flake/concurrencia, no fallo funcional determinista. |
| `npx cds compile srv/ --to json` | OK | `suggestRestock` compila en contrato CDS. |
| `npx cds compile srv/ --to sql` | OK | `stockCriticality` sigue sin materializarse en SQL. |

E2E wdi5 no se re-ejecuto porque el puerto `4004` esta ocupado por otro CAP watcher local (`bluevant/source/hcm-clone-cap`) y `test/e2e/wdio.conf.js` aun tiene `baseUrl` fijo. Esto confirma que `BASE_URL` parametrizable sigue siendo una correccion necesaria.

---

## 3. Tesis de mocks: fortalezas y ataques probables

### Lo fuerte

- La separacion "trial publico vs paid/customer landscape" esta bien pensada.
- La regla de "no mock invisible" es excelente para evitar demos engañosas.
- La idea de usar los mismos seeds/schemas apunta en la direccion correcta.
- La existencia de tests por mock evita que la carpeta `mocks/` sea solo teatro documental.
- ATC, Event Mesh y AI Core estan bien elegidos como componentes a mockear: son precisamente los que rompen el PoC publico por entitlements.

### Lo atacable

- "Contrato identico" es una promesa que hoy no se cumple. Debe reemplazarse por "subset compatible y documentado".
- "No leak a produccion" no esta garantizado: `srv/service.js` importa directamente `../mocks/events/bus` y `../mocks/ai/client`.
- Los flags no son consistentes: docs hablan de `AI_MODE`, `ATC_MODE`, `EVENT_BUS`; codigo usa `MOCK_AI`, `AI_PROVIDER`, `MOCK_EVENT_BUS`, `ATC_MOCK`.
- La documentacion de estado esta atrasada: `TRIAL_LIMITATIONS.md` y `mocks/README.md` aun marcan Event Bus/AI como pendientes, aunque ya existen.
- La sustitucion 1:1 no es real mientras el handler CAP dependa directamente de carpetas `mocks/`.

Decision recomendada: conservar la tesis, pero añadir una regla de adapter boundary:

> `srv/` no importa mocks directamente. `srv/` importa adapters estables; cada adapter resuelve `mock|real|disabled` por config.

---

## 4. Issues por mock

### 4.1 ATC mock

**Estado:** bueno como PoC. Aun no esta listo como contrato fuerte contra ATC real.

Issues:

| Severidad | Issue | Evidencia | Correccion definida |
|---|---|---|---|
| P1 | `npm test` completo flakea | Suite completa fallo con `socket hang up`; serial pasa. | Aislar lifecycle del server ATC: puerto unico por test, esperar `close` en `afterAll`, capturar stderr, o ejecutar ese test in-band. |
| P1 | `run-atc-flow.sh` no valida HTTP status | `curl -s` puede ocultar 401/500 y solo falla si no encuentra `id`. | Usar `curl --fail-with-body`, capturar status code y loggear body de error. |
| P1 | Parsing XML por regex es aceptable para mock, fragil para real | `grep -o 'id="..."'`, `grep status`, `grep priority`. | Mantener para demo si se documenta; para Wave 2 usar parser XML o helper Node pequeño. |
| P2 | No se testea el script end-to-end | Tests cubren server, no exit codes de `run-atc-flow.sh`. | Añadir tests de script: success=0, prio 3=0, prio 1/2=1, timeout=1, 401=1. |
| P2 | Fixture blocking existe pero README no lo lista completo | Server soporta `run-with-blocking-findings`; README solo lista dos fixtures. | Documentar los tres fixtures. |
| P2 | Auth mock demasiado simple, pero aceptable | Bearer >= 10 chars. | No validar JWT real; si hace falta, simular escenarios 401/403/expired con fixtures/env. |

Respuesta a la pregunta de Claude: el script preserva la idea del contrato, no todavia el contrato operativo real. Para Wave 1 sirve si se etiqueta como "ATC happy-path + findings parser". Para Wave 2 hay que endurecer HTTP status, XML parsing, Location/header handling, timeout, retry y token expiry.

---

### 4.2 Event Bus mock

**Estado:** util y bien orientado, pero hay un bug semantico de contrato.

Issues:

| Severidad | Issue | Evidencia | Correccion definida |
|---|---|---|---|
| P1 | `flagLowStock` emite `sap.ern.stock.critical.v1` con payload que viola schema | En `srv/service.js`, `flagLowStock` publica `{ ID, criticality: 2, trigger }`; schema requiere `stock` y describe criticalidad 1/stock=0. | No usar `stock.critical` para `flagLowStock` salvo que stock real sea 0. Crear `sap.ern.stock.low.v1` o incluir stock real y ajustar semantica. |
| P1 | Bus mock acoplado al runtime principal | `srv/service.js` importa `../mocks/events/bus` siempre. | Crear adapter `eventBus` con modos `local|real|disabled`; `srv/` no debe importar `mocks/`. |
| P2 | Schemas no se validan realmente con JSON Schema | Test actual revisa required fields manualmente; no hay Ajv en deps. | O añadir validador real en tests, o cambiar el claim documental. |
| P2 | Falta schema para `sap.ern.ai.restock.suggested.v1` | `suggestRestock` lo emite, pero no existe schema. | Añadir schema o no emitir el evento hasta tener contrato. |
| P2 | Falta `subject` en CloudEvents | No obligatorio, pero muy util para producto/id. | Añadir `subject: products/<ID>` cuando aplique. |
| P3 | Wildcard `*` esta bien como helper local, no como contrato | `bus.emit('*', cloudEvent)`. | Documentarlo como utilidad de test; no prometer equivalencia con Event Mesh. |

Naming: `sap.ern.product.created.v1` esta bien como CloudEvent `type`. Para Event Mesh real conviene separar `type` de `topic`: por ejemplo `type=sap.ern.product.created.v1` y topic `sap/ern/product/created/v1`.

`additionalProperties: false`: no lo pondria todavia en `data` durante Wave 1; si en la envoltura CloudEvents se quiere mas disciplina. Lo importante ahora es validar todos los eventos canonicos, no solo `product.created`.

---

### 4.3 AI mock

**Estado:** buen demo-domain adapter; no debe venderse como shape fiel de AI Core orchestration.

Issues:

| Severidad | Issue | Evidencia | Correccion definida |
|---|---|---|---|
| P1 | AI mock siempre esta en el path del servicio | `srv/service.js` importa `../mocks/ai/client` siempre y expone `suggestRestock`. | Introducir adapter `aiProvider` con `mock|real|disabled`. En `disabled`, la action debe devolver 501 o estar protegida por feature flag. |
| P1 | Falta schema para la accion/evento AI | `RestockSuggestion` existe en CDS, pero no hay `mocks/ai/schemas/` aunque docs lo mencionan. | Añadir JSON Schema o eliminar ese claim de `TRIAL_LIMITATIONS.md`. |
| P2 | `confidence` puede ser malinterpretado | Deterministico por hash, no probabilidad real del modelo. | Renombrar en docs a `mockConfidence` o documentar "heuristic confidence, not model probability". |
| P2 | Observability incompleta para reemplazo real | Respuesta trae `model` y `groundingDocs`, pero no `runId`, `provider`, `promptTemplateId`, `latencyMs`, `mock`. | Añadir metadata a nivel adapter o evento; no necesariamente al payload de negocio. |
| P2 | Latencia aleatoria por defecto puede ralentizar tests/API | Default 500-1500ms. | Default 0 en test/CI; demo puede activar latencia. |
| P3 | Evento AI puede estar bien, pero debe ser dominio | `sap.ern.ai.restock.suggested.v1` se emite con count/model/productIDs. | Mantener si representa "suggestions generated"; no publicar razones/recomendaciones sensibles sin contrato. |

Respuesta a la pregunta de Claude: `groundingDocs`, `model` y `confidence` son buenos para una respuesta de dominio normalizada, no para simular literalmente AI Core. Mantener la firma de adapter estable y no exponer detalles crudos de proveedor en el contrato CAP.

---

## 5. Mock S/4HANA: recomendacion

Recomiendo una opcion D, que es una version mas estricta de C:

> D) Mock OData contract-first para `API_PRODUCT_SRV`, generado/documentado desde `$metadata` oficial de SAP API Hub, con fixtures sinteticos y un adapter CAP que consume indistintamente mock o S/4 real.

Por que no A: fixture inventado sin metadata oficial deja flancos faciles.

Por que no B: usar otro OData real de S4D para remapear sales orders a products da una falsa seguridad semantica. Es real OData, pero no es el contrato que quieres demostrar.

Por que C si, pero no generico primero: un servidor OData generico reutilizable puede volverse framework antes de tener contrato. Primero conviene un subset concreto de `API_PRODUCT_SRV`:

- `GET /sap/opu/odata/sap/API_PRODUCT_SRV/$metadata`
- `GET /sap/opu/odata/sap/API_PRODUCT_SRV/A_Product`
- soporte minimo para `$select`, `$filter=Product eq ...`, `$top`, `$skip`
- response OData v2 con `d.results`
- fixtures con `Product`, `ProductType`, `ProductGroup`, `BaseUnit`, `GrossWeight`, `WeightUnit`
- golden tests contra fixture de API Hub o snapshot de metadata oficial

La regla clave: el CAP service no debe depender del mock S/4. Debe depender de `s4hProductAdapter`. Ese adapter decide `mock|real|disabled`.

---

## 6. Stack MCP

### `@cap-js/mcp-server` vs `@gavdi/cap-mcp`

No son redundantes:

- `@cap-js/mcp-server`: asistencia de desarrollo CAP/CDS. Es build-time/dev-time.
- `@gavdi/cap-mcp`: expone tu CAP service como tools MCP. Es runtime/product-facing.

Mantendria ambos solo si queda clara esa separacion. `cap-as-mcp` debe arrancar en modo local/dev y read-only al principio.

### `@sap-ux/fiori-mcp-server` vs `@ui5/mcp-server`

Hay solapamiento, pero no total:

- `@sap-ux/fiori-mcp-server`: mas relevante para Fiori Elements, annotations, app generation.
- `@ui5/mcp-server`: util para UI5 bajo nivel, freestyle/debug.

Para este repo, Fiori MCP es prioritario. UI5 MCP puede quedar opcional si no se usa activamente.

### Context7

Util como docs helper general, pero no deberia desplazar fuentes oficiales SAP cuando haya decisiones de arquitectura. Si hay contradiccion, gana doc oficial SAP o experiencia validada en repo.

### ABAP ADT MCP local

Util, pero sensible:

- `.mcp.json` esta correctamente gitignored.
- `.mcp.json.example` esta trackeado, pero contiene path absoluto local y `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Recomendacion: mantenerlo como ejemplo local, con advertencia fuerte de no credenciales reales, y preferir variables de entorno para usuario/password.

### Falta MCP BTP Cockpit?

No añadiria un MCP comunitario para cockpit solo por completitud. Para BTP/CF, ahora es mas seguro usar `cf` CLI, GitHub Actions logs y scripts auditables. Si aparece un MCP oficial de SAP BTP, reevaluar.

---

## 7. Issues transversales

| Severidad | Issue | Correccion definida |
|---|---|---|
| P1 | Mocks acoplados directamente a `srv/service.js` | Introducir adapters por capacidad: `eventBus`, `aiProvider`, `s4hProductAdapter`. |
| P1 | "No leak a produccion" no esta implementado | Añadir `.cfignore`/build packaging o mover mocks fuera del bundle productivo; no basta documentarlo. |
| P1 | `npm test` flakea en paralelo | Separar test de mock ATC child-process o ejecutar Jest in-band en CI hasta estabilizar. |
| P1 | Docs desactualizados respecto al repo | Actualizar `ARCHITECTURE_FINAL.md`, `TRIAL_LIMITATIONS.md`, `mocks/README.md`, `README.md`. |
| P2 | Flags inconsistentes | Estandarizar `ATC_MODE`, `AI_MODE`, `EVENT_BUS_MODE`, `S4H_MODE`, `MCP_MODE`, o documentar equivalencias. |
| P2 | Contract tests todavia superficiales | Validar todos los CloudEvents con JSON Schema; testear script ATC; testear action `suggestRestock` via OData. |
| P2 | Observability de mocks insuficiente | Añadir `mock: true`, provider, run id/correlation id, latency y mode activo en logs/eventos. |
| P3 | README principal obsoleto | Dice 23 tests; ahora hay 49 en suite completa. |

---

## 8. Plan recomendado para Claude

1. No expandir mas superficie todavia. Antes de S/4H, cerrar el aislamiento de mocks.
2. Crear adapter boundary para AI/Event/S4H. ATC puede seguir como script externo.
3. Arreglar flake de `npm test` antes de declarar el pipeline verde.
4. Corregir el bug semantico de `stock.critical` en `flagLowStock`.
5. Actualizar documentos de estado para que coincidan con el repo.
6. Implementar S/4H mock como opcion D contract-first, no como fixture inventado libre.
7. Mantener MCP como herramienta local/dev; no mezclarlo con Wave 1 runtime.

La direccion general es buena. Lo que falta ahora no es imaginacion, es contencion contractual: menos promesa, mas frontera limpia.
