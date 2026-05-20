# Codex Review — Sub-proyecto Trial Limits + Mocks (Ern)

> **Contexto:** Repositorio `jmmonteagudo/ern` — PoC SAP CAP/Fiori sobre BTP Trial gratuito, demo para cliente Foodstuff (farma/química). Hace falta segundo par de ojos sobre la estrategia de mocks.
> **Fecha:** 2026-05-20
> **Reviewer:** Codex (segunda cabeza arquitectónica)

---

## Lo que necesito que revises

### 1. ¿Es sólida la TESIS del sub-proyecto? (`docs/TRIAL_LIMITATIONS.md` §1)

> "El PoC Ern debe poder mostrarse end-to-end **sin pedir al observador acceso a un trial pago, una cuenta corporativa SAP, ni infraestructura de cliente**. Cuando un componente del paisaje SAP no es accesible vía trial gratuito público, se reemplaza por un mock fiel a la interfaz real."

Reglas declaradas:
1. No mock invisible (cada uno documentado)
2. Sustituible 1:1 (flag de config, no edición de código)
3. Contrato OData/HTTP idéntico (consumer no distingue)
4. Sincronía con otros proyectos (mismos seeds, mismos schemas que sistema real Wave 2)

**Pregunta:** ¿Hay agujeros en esta tesis? ¿Algo que un reviewer de SAP arquitectura senior atacaría?

---

### 2. Mocks YA construidos — review de cada uno

#### 2.1 Mock ATC (ABAP Test Cockpit) — `mocks/atc/`

**Componente real:** ABAP ATC API vía OAuth `client_credentials` contra Steampunk.
**Por qué mock:** El plan `abap-trial / shared` rechaza `client_credentials` con HTTP 401. Confirmado vía curl.

**Implementación:**
- `mocks/atc/server.js` — Node HTTP server (puerto 8765). Endpoints `POST /sap/bc/adt/atc/runs` (201 + run id) y `GET /runs/{id}` (200 + findings XML). Tres fixtures: `run-success`, `run-with-findings` (prio 3), `run-with-blocking-findings` (prio 1).
- `mocks/atc/run-atc-flow.sh` — script bash que ejecuta el flow (trigger + poll + fail si prio 1/2). **El mismo script funciona contra el mock o contra ATC real** (DRY).
- `test/mocks-atc.test.js` — 6 tests Jest verificando contrato.
- `.github/workflows/ci-cd.yml` — refactor del job `test-abap` para llamar al script + nuevo job `test-abap-mock` gated por `vars.ATC_MOCK == 'true'`.

**Pregunta a Codex:**
- ¿El script `run-atc-flow.sh` realmente preserva el contrato? (parsea status="completed" y priority="1|2" con grep/regex)
- ¿Falta algún caso edge — timeouts, tokens expirados, runs huérfanos?
- ¿Está bien que el mock acepte cualquier Bearer >= 10 chars o debería simular más fielmente la validación JWT?

#### 2.2 Mock Event Bus (SAP Event Mesh) — `mocks/events/`

**Componente real:** SAP Event Mesh + CloudEvents 1.0 spec.
**Por qué mock:** plan `enterprise-messaging / default` no en trial gratuito.

**Implementación:**
- `mocks/events/bus.js` — `EventEmitter` wrapper que envuelve payloads en CloudEvents 1.0 (specversion, type, source, id, time, data). Persiste a `events.log` cuando `MOCK_EVENT_BUS=true`. Expone `bus.published[]` para test assertions y emite tanto por type como wildcard `*`.
- `mocks/events/schemas/*.json` — JSON Schemas para los 3 eventos canónicos: `sap.ern.product.created.v1`, `sap.ern.product.changed.v1`, `sap.ern.stock.critical.v1`.
- `srv/service.js` — emite en `after('CREATE')`, `after('UPDATE')`, `flagLowStock`, y `stock.critical` cuando stock=0.
- `test/mocks-events.test.js` — 7 tests.

**Pregunta a Codex:**
- Naming convention `sap.ern.<entity>.<action>.v<N>` — ¿alinea con cómo emitiría Event Mesh real?
- ¿Falta el campo `subject` (CloudEvents opcional pero estándar)?
- Wildcard `*` listener — ¿es demasiado libre? ¿debería forzar pattern matching tipo `sap.ern.product.*`?
- Schemas: ¿bien que `data` sea schema-validated solo por sus required fields, no estricto `additionalProperties: false`?

#### 2.3 Mock AI (SAP Gen AI Hub / AI Core) — `mocks/ai/`

**Componente real:** AI Core orchestration endpoint con grounding.
**Por qué mock:** AI Core no incluido en trial gratuito.

**Implementación:**
- `mocks/ai/client.js` — función `suggestRestock({ products, auditByProduct })`. Devuelve array de `{productID, currentStock, suggestedOrder, reason, confidence, model, groundingDocs}`.
- **Determinismo:** `confidence = sha256(productID + stock)` mapeado a [0.6, 0.99]. `suggestedOrder` por tabla (0→500, <50→300, <100→200, <200→100, ≥200→50). `reason` natural-language adaptativo.
- **Latencia simulada:** 500-1500ms aleatorio (config vía env vars).
- `srv/service.cds` — type `RestockSuggestion` + action `suggestRestock(ids: array of UUID) returns array of RestockSuggestion`.
- `srv/service.js` — handler que carga products + audit history, llama mock AI, emite evento `sap.ern.ai.restock.suggested.v1`.
- `test/mocks-ai.test.js` — 9 tests.

**Pregunta a Codex:**
- ¿El shape de respuesta refleja fielmente lo que retornaría una llamada a AI Core orchestration con grounding sobre datos SAP? Específicamente: `groundingDocs`, `model`, `confidence`.
- Determinismo de `confidence` — ¿correcto para CI? ¿Hace falta también determinismo en `reason` (actualmente es texto fijo por bucket de stock)?
- ¿Falta exponer `tokens_used`, `prompt_template_id`, o algún campo de observabilidad que AI Core sí trackea?
- ¿Es buena idea que el handler emita un evento `ai.restock.suggested.v1` o eso debería ser responsabilidad del consumer?

---

### 3. Mock S/4HANA — DECISIÓN PENDIENTE (input crítico)

**Componente real:** `API_PRODUCT_SRV` en S/4HANA Cloud.
**Por qué mock:** S/4HANA Cloud sandbox requiere paid + entitlement.

**Estado:** No implementado aún. Tengo acceso al sistema BASF S4D (`52.201.80.133`) con SAP_DEV — pero `API_PRODUCT_SRV` **NO está activado** ahí (HTTP 403, "No service found for namespace '', name 'API_PRODUCT_SRV'").

**3 caminos posibles:**

**A) Fixture inventado siguiendo docs SAP API Hub.**
- Pro: control total, sin dependencias.
- Con: shape posiblemente inexacto en algún campo.

**B) Fixture capturado de OTRO endpoint OData en S4D.**
- En S4D BASF hay servicios custom `ZFSB_*` (ej. `salesorder-app` usa `http://52.201.80.133:50000/sap/opu/odata4/sap/zui_salesorder_safe_ui/...`).
- Pro: datos reales de un OData real.
- Con: no es Material Master, sería remapping conceptual.

**C) Mock servidor genérico OData v2/v4 parametrizable** que sirve fixtures JSON, sin atarse a un servicio concreto.
- Pro: el más reutilizable, encaja con la tesis "sustituible 1:1".
- Con: más trabajo upfront.

**Pregunta a Codex:** ¿Qué camino tomar? ¿O hay una opción D que no estoy viendo?

Mi instinto: **C** — un servidor OData mock parametrizable, con fixtures inventados PERO basados en las docs oficiales de `API_PRODUCT_SRV` (campos: `Product`, `ProductType`, `ProductGroup`, `BaseUnit`, `GrossWeight`, etc.). Cuando se conecte a S/4HANA real, solo cambia el endpoint.

---

### 4. Selección de MCPs

Acabo de configurar 6 MCPs en `.mcp.json` (gitignored, hay `.mcp.json.example` en el repo):

| MCP | Origen | Función |
|---|---|---|
| `@cap-js/mcp-server` | SAP CAP team oficial | Asistencia CDS/CAP |
| `@sap-ux/fiori-mcp-server` | SAP Fiori tools oficial | Asistencia Fiori Elements |
| `@ui5/mcp-server` | UI5 team oficial | UI5 dev |
| `@gavdi/cap-mcp` | Comunidad GavdiLabs | Convierte CAP service en MCP server (los entities OData se vuelven tools para LLM) |
| `@upstash/context7-mcp` | Upstash | Docs always-fresh (CAP, Fiori, AI SDK) |
| `mcp-abap-abap-adt-api` (local) | Comunidad | ABAP ADT contra S4D BASF — usa `SAP_DEV` (NUNCA `I589361`) |

**Pregunta a Codex:**
- ¿Hay redundancia entre `@cap-js/mcp-server` y `@gavdi/cap-mcp`? El primero es del propio equipo CAP, el segundo es comunidad pero hace algo diferente (expone TU service como MCP).
- ¿Falta algún MCP crítico? Pensaba en uno para BTP cockpit (cf services, deployments) pero no encontré oficial.
- ¿`@ui5/mcp-server` aporta sobre `@sap-ux/fiori-mcp-server` o es redundante?

---

## Lo que NO necesito que revises

- Calidad del código TypeScript/JavaScript per se (los lints y tests cubren eso)
- Decisiones ya cerradas: tech stack (CAP+Fiori+CF), trial gratuito como target, GitHub Actions
- ABAP / ZERN_PRODUCTS package en Eclipse (eso queda fuera del sub-proyecto)

---

## Output esperado

Estructura libre, pero ojalá:

1. **Validación o crítica de la tesis** (§1)
2. **Lista de issues por mock** (§2.1, 2.2, 2.3) — solo donde haya issues reales
3. **Recomendación clara para mock S/4HANA** (§3) — con razón
4. **Comentario sobre stack MCPs** (§4) — qué quitar/añadir
5. **Issues transversales** — cosas que se aplican a varios mocks o a la estrategia global

Si hay alguna trampa que no estoy viendo, decírmelo plano. Si está bien, decirlo también — confirmaciones quietas son tan valiosas como correcciones.
