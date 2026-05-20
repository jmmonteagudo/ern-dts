# Intermediate Deliverables - 2026-05-20

> Modo: checkpoint tecnico de revision
> Alcance: Ern `source/ern`, sub-proyecto Trial Limits + Mocks
> No incluye: estrategia comercial, marca, pricing o producto Bluevant

---

## 1. Entregables intermedios generados

| Entregable | Proposito | Estado |
|---|---|---|
| `docs/CODEX_REVIEW_TRIAL_MOCKS.md` | Feedback completo para Claude sobre tesis, mocks, S/4H y MCPs. | Nuevo |
| `docs/INTERMEDIATE_DELIVERABLES_2026-05-20.md` | Checkpoint de estado, riesgos y siguiente secuencia de trabajo. | Nuevo |

No se modifico codigo, pipeline ni configuracion.

---

## 2. Estado real del repo

| Area | Estado observado | Comentario |
|---|---|---|
| CAP/Fiori base | Funcional | Service + Fiori static assets compilan y tests de contrato pasan. |
| Lint | Verde | `npm run lint -- --max-warnings 0` pasa. |
| Jest serial | Verde | `npm test -- --runInBand` pasa: 49 tests. |
| Jest default | Inestable | `npm test` fallo una vez en `mocks-atc.test.js` con `socket hang up`. |
| Mock ATC | Implementado | Server + script + tests aislados. Falta endurecer contrato real y flake. |
| Mock Event Bus | Implementado | CloudEvents basicos + log opcional + tests. Hay bug semantico en `stock.critical` desde `flagLowStock`. |
| Mock AI | Implementado | `suggestRestock` en CDS/service + client determinista + tests. Falta feature flag/adapter. |
| Mock S/4HANA | No implementado | Recomendado: OData contract-first desde metadata oficial `API_PRODUCT_SRV`. |
| MCP config | Localmente configurado | `.mcp.json` gitignored; `.mcp.json.example` trackeado con placeholders. |
| E2E wdi5 | No validado aqui | `4004` ocupado por otro proyecto y config sigue fija a `localhost:4004`. |
| Docs | Drift medio/alto | Varios docs describen estados anteriores o pendientes ya implementados. |

---

## 3. Hallazgos bloqueantes antes de seguir construyendo

### P1. Adapter boundary para mocks

Hoy `srv/service.js` importa directamente:

- `../mocks/events/bus`
- `../mocks/ai/client`

Eso contradice la tesis de "sustituible 1:1" y "no leak a produccion". Antes de sumar S/4H o MCP runtime, conviene crear una frontera de adapters:

```text
srv/service.js
  -> srv/adapters/eventBus
  -> srv/adapters/aiProvider
  -> srv/adapters/s4hProductAdapter

adapters/*
  -> decide mock | real | disabled por config
```

### P1. Flake en `npm test`

`npm run test:mocks` pasa aislado, y `npm test -- --runInBand` pasa. Pero `npm test` fallo una vez con `socket hang up` en `mocks-atc.test.js`. Esto puede romper CI de forma intermitente.

Correccion definida:

- puerto unico por worker o random port;
- esperar cierre del child process en `afterAll`;
- capturar stdout/stderr del mock;
- o ejecutar tests con child process en banda.

### P1. Evento `stock.critical` incoherente

`flagLowStock` emite `sap.ern.stock.critical.v1` con `criticality: 2` y sin `stock`, mientras el schema requiere `stock` y define criticalidad 1 como stock cero.

Correccion definida:

- publicar `sap.ern.stock.low.v1` para `flagLowStock`; o
- consultar stock real y publicar `stock.critical` solo si `stock === 0`; o
- cambiar schema/naming si "critical" no significa stock cero.

---

## 4. Siguiente secuencia recomendada

### Bloque A - estabilizar lo existente

1. Crear adapters para AI/Event Bus.
2. Arreglar flake de `mocks-atc.test.js`.
3. Validar `run-atc-flow.sh` con tests de exit code.
4. Validar todos los CloudEvents con JSON Schema real.
5. Corregir evento `stock.critical` vs `flagLowStock`.
6. Actualizar docs de estado.

### Bloque B - S/4HANA mock

1. Obtener metadata oficial de `API_PRODUCT_SRV` desde API Hub.
2. Definir subset minimo de `A_Product`.
3. Crear fixtures sinteticos basados en metadata.
4. Implementar server mock OData v2 minimo.
5. Crear `s4hProductAdapter` para consumir mock/real sin tocar servicio.
6. Añadir contract tests.

### Bloque C - MCPs

1. Mantener MCPs como dev tooling, no runtime de Wave 1.
2. Separar CAP dev MCP de CAP-as-MCP runtime.
3. Mantener ABAP ADT MCP local con credenciales fuera de Git.
4. No añadir MCP BTP no oficial todavia.

---

## 5. Definition of Done intermedia

El sub-proyecto Trial Limits + Mocks puede considerarse listo para avanzar a S/4H cuando:

- `npm test` pasa de forma repetible, no solo serial.
- `npm run test:mocks` pasa.
- `srv/service.js` ya no importa `mocks/` directamente.
- Cada mock tiene modo `mock|real|disabled` o decision explicita equivalente.
- Cada evento emitido tiene schema y contract test.
- `TRIAL_LIMITATIONS.md` refleja lo que existe, no lo que existia al iniciar.
- `mocks/README.md` no promete exclusion de bundle si no hay `.cfignore`/packaging que lo garantice.

---

## 6. Mensaje corto para continuar con Claude

Claude: la direccion es buena y el avance es real. El siguiente salto no deberia ser mas superficie, sino cerrar fronteras. Antes de S/4H, estabilicemos adapter boundary, flake de Jest, contract tests y drift documental. Despues si, S/4H mock contract-first desde metadata oficial.
