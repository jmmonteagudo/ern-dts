# mocks/

> Mocks fieles a un **subset contract-compatible** de componentes SAP no disponibles en BTP Trial gratuito.
> Documento padre: `docs/TRIAL_LIMITATIONS.md`

## Filosofía

1. **Mock = mismo contrato que el real, en su superficie usada.** Mismos endpoints/topics/shapes que lo que `srv/` consume; no se pretende cubrir 100% de la API real, sólo el subset que el código usa.
2. **Boundary clara.** `srv/` jamás importa de `mocks/` directamente; usa siempre `srv/adapters/*`. Los adapters seleccionan backend según `*_MODE` env (mock|real|disabled).
3. **No leak a producción.** `.cfignore` excluye `mocks/`, `test/`, `docs/` del bundle CF. Si producción quiere mock (caso PoC público), basta con `*_MODE=mock` y volverlo a incluir.
4. **Observabilidad.** Toda salida del mock se autoidentifica: campos `mock=true`, `provider="mock"`, `latencyMs` en payloads; `xmock=true`/`xprovider="mock"` en CloudEvents; headers `X-Mock` en HTTP.

## Mocks disponibles

| Mock | Reemplaza | Activación | Status |
|---|---|---|---|
| `events/` | SAP Event Mesh (CloudEvents 1.0) | `EVENT_BUS_MODE=mock` | ✅ Implementado |
| `ai/` | SAP AI Core / Gen AI Hub | `AI_MODE=mock` | ✅ Implementado |
| `atc/` | SAP ATC API (ABAP Test Cockpit) | servidor independiente, `ATC_MODE=mock` | ✅ Implementado |
| `s4h/` | S/4HANA OData APIs (API_PRODUCT_SRV) | `S4H_MODE=mock` | 🔄 Pendiente (#29) |
| `mcp/` | MCP server SAP-managed | `MCP_MODE=stub` | ⏳ Diferido |

## Activación (Express por env)

| Variable | Valores | Default | Notas |
|---|---|---|---|
| `EVENT_BUS_MODE` | `mock`, `real`, `disabled` | `disabled` | `MOCK_EVENT_BUS=true` legacy → `mock` |
| `AI_MODE` | `mock`, `real`, `disabled` | `disabled` | `MOCK_AI=true` / `AI_PROVIDER=mock` legacy → `mock` |
| `MOCK_AI_MODEL` | string | `mock-llm-v1` | Reportado como `model` en respuesta |
| `MOCK_AI_LATENCY_MIN_MS` / `MAX_MS` | int | `0`/`0` en test/CI; `500`/`1500` interactivo | Latencia simulada |
| `MOCK_EVENT_BUS_LOG` | path | `./events.log` | Log de eventos emitidos cuando `EVENT_BUS_MODE=mock` |
| `MOCK_EVENT_BUS_SOURCE` | string | `/ern/products` | CloudEvents `source` |
| `MOCK_ATC_FIXTURE` | `run-success`, `run-with-findings`, `run-with-blocking-findings` | `run-success` | Fixture del server ATC |
| `PORT` (mock ATC) | int | `8765` | Puerto del server independiente |

## Patrón adapter (cómo lo usa srv/)

```js
// srv/service.js
const bus = require('./adapters/eventBus');
const ai = require('./adapters/aiProvider');

// srv/adapters/eventBus.js resuelve EVENT_BUS_MODE=mock|real|disabled
// → mock: require('../../mocks/events/bus').bus
// → real: throw "not implemented" (Wave 2)
// → disabled: no-op stub
```

## Tests que validan contrato

| Suite | Cubre |
|---|---|
| `test/mocks-events.test.js` | CloudEvents 1.0 envelope, listeners, log file |
| `test/event-schemas.test.js` | Validación Ajv real contra `mocks/events/schemas/*.json`, casos negativos, observabilidad (`xmock`) |
| `test/mocks-ai.test.js` | Determinismo, regla de `suggestedOrder`, `groundingDocs`, latencia, observabilidad (`mock`/`provider`/`latencyMs`) |
| `test/mocks-atc.test.js` | Health, auth, run lifecycle, fixtures, headers `X-Mock-*` |

## Cada subdir tiene su README con

- Contrato exacto que simula (URL/topic, headers, body, códigos)
- Fixtures disponibles
- Cómo arrancarlo standalone
- Cómo integrarlo con CAP/pipeline
- Tests asociados
