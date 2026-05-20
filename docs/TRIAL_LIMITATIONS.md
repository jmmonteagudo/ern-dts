# Ern — Trial Limitations & Mock Strategy

> Status: documento operativo
> Fecha: 2026-05-20
> Alcance: limitaciones del SAP BTP Trial gratuito público y estrategia de mocks para mantener la demo end-to-end sin componentes paid.
> Vinculado a: `docs/ARCHITECTURE_FINAL.md`, `abap/README.md`, `.github/workflows/ci-cd.yml`

---

## 1. Tesis del sub-proyecto

El PoC Ern debe poder mostrarse end-to-end **sin pedir al observador acceso a un trial pago, una cuenta corporativa SAP, ni infraestructura de cliente**. Cuando un componente del paisaje SAP **no es accesible vía trial gratuito público**, se reemplaza por un mock que cubre **un subset contract-compatible** de la interfaz real (mismos endpoints/topics/shape para lo que `srv/` consume; no se pretende cubrir 100% de la API real). Los mocks viven en `mocks/`, se inyectan vía adapters en `srv/adapters/*` controlados por flags `*_MODE`, y mantienen sincronía de contratos con los componentes que sí están conectados.

Reglas:

1. **No mock invisible.** Cada mock se documenta aquí con su contraparte real, su contrato y la razón. Toda salida del mock se autoidentifica (`mock=true`, `xmock=true`, header `X-Mock`).
2. **Sustituible 1:1.** Encender un componente real solo requiere cambiar `*_MODE=real` + secrets, no editar código. `srv/` jamás importa de `mocks/` directamente.
3. **Subset contract-compatible.** Un consumer no debe poder distinguir mock de real **dentro del subset cubierto**. El subset está documentado por test (`test/event-schemas.test.js`, `test/mocks-*.test.js`).
4. **Sincronía con otros proyectos.** Los mocks usan los mismos seeds (`db/data/*.csv`) y los mismos schemas que el sistema real cuando se llega a Wave 2.

---

## 2. Inventario: qué SÍ está disponible en trial gratuito público

| Componente | Plan trial | Limitaciones reales |
|---|---|---|
| **CAP runtime (Node.js)** | Cloud Foundry trial — `cf push` | Suspende app inactiva ~30 min. Sin restage = data SQLite efímera. |
| **Fiori Elements UI** | Servida por CAP, SAPUI5 CDN | OK. CDN público, sin pin reproducible 100%. |
| **SQLite in-memory** | Local + en CF | Pierde datos en restage. Aceptado para demo. |
| **HANA Cloud (free)** | `hana-cloud / hana-free` plan | 1 instance, 30 GB, suspende a las 12h inactivo. Reactivable manual. |
| **HDI (HANA Deployment Infrastructure)** | `hana / hdi-shared` | OK trial. |
| **XSUAA** | `xsuaa / application` plan | OK trial, hasta cierto número de instances. |
| **Destination service** | `destination / lite` | OK trial. |
| **Build Code** | Subscription gratuita en trial | OK con role collection asignado. |
| **Business Application Studio** | `app-studio / standard-edition` (trial) | OK, 2 dev spaces simultáneos máx. |
| **ABAP Environment Trial** | `abap-trial / shared` plan | Ver §3 — limitado severamente. |
| **Cloud Foundry CLI** | OK | Estándar. |
| **GitHub Actions** | Repos públicos = ilimitado | OK para CI. |

---

## 3. Inventario: qué NO está disponible o está degradado en trial gratuito

### 3.1 ABAP Cloud (`abap-trial / shared`)

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Provisionar instance ABAP (Steampunk) | OK | — |
| Acceso Fiori Launchpad como user | **OK solo si el creador del instance es el mismo user que pide acceso** (bootstrap admin SSO). Instances creados via API pueden quedar sin admin. | Borrar y recrear via `cf create-service abap-trial shared <name>` desde tu sesión CF. |
| Eclipse + ADT vía service-key OAuth | OK | Service key del instance + browser SSO. |
| Crear paquetes, CDS, BO, services | OK con cuotas reducidas | — |
| abapGit | OK | Folder logic PREFIX, push/pull manual desde ADT. |
| **API ATC vía OAuth `client_credentials`** | **NO autorizado.** UAA emite token, ABAP system devuelve `HTTP 401 Anmeldung fehlgeschlagen`. | **MOCK ATC** (§4.1). Pipeline gated por `vars.ABAP_ENABLED`. |
| API ADT externa (CTS, SAP_BR_DEVELOPER) | NO | Manual via Eclipse. |
| Software Component import via API | NO | Manual via Fiori app. |
| Cuota CPU/memoria | Suspende rápido | Re-encender desde Cockpit. |

### 3.2 SAP AI Core / Generative AI Hub

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| AI Core service binding | NO en trial gratuito (requiere plan paid `cpea` / commercial) | **MOCK AI** (§4.2) |
| Foundation models (GPT-4o, Claude via Bedrock, Gemini) | NO | Mock determinista o llamada directa a Anthropic API si hay key personal (out-of-scope SAP) |
| Embeddings | NO | Mock vector dummy |
| Orchestration / grounding | NO | No aplicable hasta Wave 3 |

### 3.3 Joule / Joule Studio

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Joule for Developers (J4D) en BAS | OK con role `Build Code Developer` | Demo en vivo |
| Joule for CAP (J4C) — generación de tests | OK en BAS con CAP project | Demo en vivo |
| Joule Studio (custom skills) | NO en trial | No incluir en Wave 1 |

### 3.4 Event Mesh

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Event Mesh service | NO en trial gratuito (`enterprise-messaging / default` no disponible) | **MOCK Event Bus** (§4.3) usa EventEmitter local, log a fichero. |
| CloudEvents schema | OK como librería | Mock emite CloudEvents válidos. |

### 3.5 Integration Suite / Cloud Integration

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| CPI / iFlows | Trial existe pero con límites severos y proceso manual | Out-of-scope MVP. |
| Open Connectors | NO trial real | — |

### 3.6 S/4HANA Cloud / OP

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Acceso a sandbox S4H Public Cloud | NO incluido en BTP trial | **MOCK S4H** (§4.4) — adapter contra fixtures JSON con shape OData S4H real. |
| API Hub sandbox | OK (`api.sap.com`) — endpoints públicos read-only | Usar para validar shape, no para escritura. |

### 3.7 Cloud Connector

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Cloud Connector | Local install OK, requiere on-prem real para conectar | No aplicable para PoC público. |

### 3.8 SAP Cloud Logging / Alert Notification

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| Cloud Logging service | NO en trial | Logs a stdout (cf logs). |
| Alert Notification | NO en trial | console.error + GitHub Actions notification. |

### 3.9 MCP servers SAP-managed

| Capacidad | Estado en trial | Workaround |
|---|---|---|
| MCP server hosted by SAP | No existe oficialmente todavía | **Mock MCP server** (§4.5) — read-only stub con manifest. |

---

## 4. Mocks: catálogo y especificación

Todos los mocks viven en `mocks/` (a crear) con esta estructura:

```
mocks/
├── README.md                     # Resumen + cómo activar
├── atc/
│   ├── server.js                 # HTTP mock del endpoint ATC
│   ├── fixtures/
│   │   ├── run-success.xml       # Findings 0
│   │   └── run-with-findings.xml # Findings prio 3 (no fail)
│   └── README.md
├── ai/
│   ├── handler.js                # CAP handler que intercepta acciones AI
│   ├── fixtures/
│   │   ├── restock-suggestion.json
│   │   └── anomaly-detection.json
│   └── README.md
├── events/
│   ├── bus.js                    # EventEmitter wrapper + log
│   ├── schemas/                  # CloudEvents schemas
│   └── README.md
├── s4h/
│   ├── server.js                 # Express stub OData S4H
│   ├── fixtures/
│   │   ├── A_Product.json
│   │   └── A_BusinessPartner.json
│   └── README.md
└── mcp/
    ├── server.js                 # Stub MCP server (stdio/http)
    ├── manifest.json
    └── README.md
```

Activación vía variables de entorno:

```bash
# .env.mock
ATC_MODE=mock         # mock | real | disabled
AI_MODE=mock
S4H_MODE=mock
EVENT_BUS=local       # local | mock-eventmesh | real-eventmesh
MCP_MODE=stub
```

### 4.1 Mock ATC (ABAP Test Cockpit)

**Componente real:** `https://<host>.abap.<region>.hana.ondemand.com/sap/bc/adt/atc/runs`
**Por qué mock:** trial `shared` plan no autoriza `client_credentials` contra ATC API.

**Contrato simulado:**

```
POST /atc/runs
Headers:
  Authorization: Bearer <any>
  Content-Type: application/vnd.sap.atc.run.parameters.v1+xml
Body: <atc:run xmlns:atc=...><objectSets>...</objectSets></atc:run>

Response: 201 Created
<atc:run id="run-mock-12345" status="running" />

GET /atc/runs/{id}
Response: 200 OK
<atc:run id="run-mock-12345" status="completed">
  <findings count="0" />
  <!-- o con findings prio 3 si fixture = run-with-findings -->
</atc:run>
```

**Modo de uso en pipeline:**

```yaml
test-abap:
  if: ${{ vars.ABAP_ENABLED == 'true' || vars.ATC_MOCK == 'true' }}
  env:
    ABAP_HOST: ${{ vars.ATC_MOCK == 'true' && 'http://localhost:8765' || secrets.ABAP_HOST }}
  steps:
    - if: vars.ATC_MOCK == 'true'
      run: node mocks/atc/server.js &
```

### 4.2 Mock AI (Gen AI Hub)

**Componente real:** SAP AI Core orchestration endpoint (paid).
**Por qué mock:** trial gratuito no incluye AI Core.

**Contrato simulado:**

CAP action `suggestRestock(ids: array of UUID) returns array of RestockSuggestion`:

```json
{
  "productID": "uuid",
  "currentStock": 50,
  "suggestedOrder": 200,
  "reason": "Stock below threshold; demand trend +15% in last 30d",
  "confidence": 0.78,
  "model": "mock-llm-v1",
  "groundingDocs": ["audit-log:uuid", "product:uuid"]
}
```

Mock retorna respuesta determinista basada en datos reales (cálculo simple sobre stock actual + audit history). Latencia simulada: 500-1500ms.

### 4.3 Mock Event Bus (Event Mesh)

**Componente real:** SAP Event Mesh + CloudEvents.
**Por qué mock:** Event Mesh no en trial gratuito.

**Implementación:**

```javascript
// mocks/events/bus.js
const { EventEmitter } = require('events');
const fs = require('fs');
class MockEventBus extends EventEmitter {
  publish(eventType, payload) {
    const cloudEvent = {
      specversion: '1.0',
      type: eventType,                    // ej. 'sap.ern.product.created.v1'
      source: '/ern/products',
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: payload
    };
    fs.appendFileSync('events.log', JSON.stringify(cloudEvent) + '\n');
    this.emit(eventType, cloudEvent);
    return cloudEvent;
  }
}
```

**Eventos canónicos publicados (mock):**

- `sap.ern.product.created.v1` — emit en `after('CREATE', Products)`
- `sap.ern.product.changed.v1` — emit en `after('UPDATE', Products)`
- `sap.ern.stock.critical.v1` — emit cuando `stockCriticality === 1`
- `sap.ern.product.discontinued.v1` — pendiente Wave 2

**Sincronía con otros proyectos:** los schemas en `mocks/events/schemas/*.json` son los mismos que se usarían contra Event Mesh real (CloudEvents 1.0 spec).

### 4.4 Mock S/4HANA

**Componente real:** S/4HANA Public Cloud sandbox (paid + entitlement).
**Por qué mock:** no incluido en trial.

**Contrato simulado (subset):**

```
GET /sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$filter=Product eq '...'
Response: 200 OK
{
  "d": {
    "results": [{
      "Product": "P-001",
      "ProductType": "FERT",
      "ProductGroup": "PHARMA",
      "BaseUnit": "EA",
      "GrossWeight": "0.5",
      "WeightUnit": "KG",
      "to_Description": { "results": [...] },
      "to_SalesOrg": { "results": [...] }
    }]
  }
}
```

Fixtures basadas en API Hub (api.sap.com) — shape real, datos sintéticos. El adapter CAP consume mock S4H y lo proyecta a `Products`.

### 4.5 Mock MCP server

**Componente real:** servidor MCP hosted (no existe SAP-managed todavía).
**Por qué mock:** demostrar el patrón sin infra.

**Implementación stdio:**

```javascript
// mocks/mcp/server.js
// Implementa Model Context Protocol spec
// Tools expuestas (read-only):
//   - list_products(filter?)
//   - get_product_audit(id)
//   - search_products(query)
// Sin write tools en Wave 1 (ADR-010)
```

Un cliente MCP (Claude Desktop, Cursor) puede conectarse y consultar el contrato. Demuestra el patrón sin requerir AI Core.

---

## 5. Matriz de sincronía con otros proyectos del repo

| Componente | Real (Wave 2/3) | Mock (Wave 1) | Sincronía garantizada por |
|---|---|---|---|
| OData ProductService | CAP + HANA | CAP + SQLite | Schema CDS único `db/schema.cds` |
| AuditLog | HANA persistido | SQLite efímero | Schema CDS único |
| Eventos | Event Mesh | EventEmitter + events.log | CloudEvents schema en `mocks/events/schemas/` |
| ATC findings | ATC real via ADT API | XML fixtures | XSD ATC v1 |
| AI suggestions | AI Core orchestration | Cálculo determinista | JSON Schema `mocks/ai/schemas/` |
| S4H products | API_PRODUCT_SRV | Fixtures OData v2 | Metadata XML extraída de api.sap.com |
| MCP tools | MCP server real | stdio stub | MCP spec + manifest.json |
| ABAP CDS view | `ZI_ERN_PRODUCT` en ABAP system | (no mock; opcional) | abapGit |

---

## 6. Pipeline CI/CD: comportamiento por entorno

| Job | Trial público (default) | Trial con cuenta SAP | Cliente paid |
|---|---|---|---|
| `lint` | ON | ON | ON |
| `test-unit` (Jest) | ON | ON | ON |
| `test-e2e` (wdi5) | ON, continue-on-error | ON, gate duro Wave 2 | ON, gate duro |
| `test-abap` (ATC) | OFF (`ABAP_ENABLED=false`) | OFF (limitación trial) | ON (real ATC) |
| `test-abap-mock` (mock ATC) | ON si `ATC_MOCK=true` | ON | OFF (no aplica) |
| `deploy` | ON main + push | ON | ON con approval |
| `smoke` | ON | ON | ON con healthcheck strict |

---

## 7. Workarounds documentados ya aplicados

| # | Limitación | Workaround | Status |
|---|---|---|---|
| W1 | `bv-arc` instance creado vía API → user CB9980000XXX no auto-provisionado al SSO | Borrar y recrear como `default_abap-trial` desde Cockpit/booster | DONE 2026-05-20 |
| W2 | Multiple identities (`sap.ids` corporate vs IAS subaccount) generan UUIDs distintos en BTP | Usar siempre la misma identidad (cert SAP `I589361`) en CF + cockpit + browser | DONE |
| W3 | client_credentials grant rechazado por ATC API en trial | Pipeline `test-abap` gated por `vars.ABAP_ENABLED` + mock ATC con fixtures + script de flow hardenized | DONE |
| W4 | wdi5 E2E inestable (`waitForUI5Options` undefined) | `continue-on-error: true` en pipeline + backlog Wave 2 | DONE |
| W5 | Trial suspende app a los 30 min | Re-deploy automático en cada `cf push` del pipeline; smoke test detecta caída | DONE |
| W6 | SQLite in-memory pierde data | Aceptado para Wave 1 (ADR-005). HANA Cloud en Wave 2. | DOCUMENTED |
| W7 | Sin Event Mesh trial | Mock event bus local con CloudEvents 1.0 + auto-derivación de `subject` + extension attrs `xmock`/`xprovider` + validación Ajv real contra schemas | DONE |
| W8 | Sin AI Core trial | Mock AI handler determinista (SHA256 sobre `productId:stock`), modo selector `AI_MODE=mock|real|disabled`, observabilidad `mock=true`/`provider`/`latencyMs` | DONE |
| W9 | Sin acceso S4H sandbox | Mock S4H adapter con fixtures de api.sap.com — contract-first OData v2 server | PENDING (#29) |

---

## 8. Roadmap del sub-proyecto

### Fase 1 (DONE)

- [x] Crear este documento
- [x] Crear `mocks/` con README + estructura inicial
- [x] Implementar mock ATC (server.js + fixtures + integración pipeline)
- [x] Añadir variable `vars.ATC_MOCK` al pipeline + step condicional
- [x] Tests que verifican que mock responde a contrato XSD ATC

### Fase 2 (DONE)

- [x] Mock Event Bus + emisión de eventos en `srv/service.js` (gated por `EVENT_BUS_MODE`)
- [x] Mock AI con action `suggestRestock` en `srv/service.cds` (gated por `AI_MODE`)
- [x] Adapter boundary `srv/adapters/*` — `srv/` jamás importa de `mocks/` directamente
- [x] CloudEvents schemas validados con Ajv real, observabilidad `xmock`/`xprovider`, auto-derivación de `subject`
- [x] `.cfignore` excluye `mocks/`, `test/`, `docs/`, `abap/` del bundle CF
- [ ] Mock S4H adapter contract-first OData v2 (#29)

### Fase 3 (Wave 2 lift)

- [ ] Reemplazar mocks por componentes reales sin tocar código de servicio (sólo `*_MODE=real` + secrets)
- [ ] Validar contratos con schemas reales (Event Mesh, ATC v1, AI Core orchestration)
- [ ] HANA Cloud + persistencia real de AuditLog

---

## 9. Reglas de sincronía con el resto del repo

1. **Un schema único.** `db/schema.cds` es la fuente. Mocks consumen este schema, no copian estructuras.
2. **Un seed único.** `db/data/*.csv` es el seed. Mocks que necesitan datos los leen de aquí.
3. **Un contrato único por canal.** Cada mock declara el subset del contrato real que cubre. Si el real cambia, el mock falla en CI.
4. **Tests cruzados.** Cada mock tiene un test que valida (a) shape de respuesta, (b) coexistencia con CAP service.
5. **Flags binarios.** `*_MODE=mock|real|disabled`. Sin `auto`, sin `try real then fallback`.
6. **No leak de mocks a producción.** El bundle de deploy a CF NO incluye `mocks/` salvo que `MOCK_ENABLED=true` esté explícito.

---

## 10. Demo guidance para Foodstuff

Lo que se muestra al cliente en trial gratuito:

1. **CAP + Fiori real:** ProductService corriendo, List Report y Object Page navegables.
2. **Pipeline real:** GitHub Actions verde con lint, unit, deploy, smoke.
3. **Joule J4C demo en vivo:** generación de tests en BAS contra el CAP service real.
4. **Mocks marcados claramente:** "AI suggestions (mock — connects to AI Core in production)" con badge visual en la UI cuando está en mock mode.
5. **Eventos vistos en log:** terminal mostrando `events.log` mientras se hacen CRUDs.
6. **ATC mock corriendo en pipeline:** screenshot del job `test-abap-mock` verde + nota "real ATC requires paid tier".
7. **MCP demo opcional:** Claude Desktop conectándose a `mocks/mcp/server.js` y consultando productos.

Lo que NO se muestra (y se documenta como roadmap):

- AI Core real (paid)
- Event Mesh real (paid)
- S4H real (paid + entitlement)
- ATC real (paid `standard` plan)
- Cloud Connector productivo
- Multitenancy

---

## 11. Referencias

- ADR-005, ADR-006, ADR-015, ADR-017 en `docs/ARCHITECTURE_FINAL.md`
- `abap/README.md` para detalle del system ABAP trial
- `.github/workflows/ci-cd.yml` para gating del pipeline
- SAP Discovery Center → `discovery-center.cloud.sap` para confirmar entitlements por plan
