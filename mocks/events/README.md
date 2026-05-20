# Mock Event Bus (SAP Event Mesh)

Sustituye SAP Event Mesh cuando se trabaja contra trial gratuito (donde el plan `enterprise-messaging / default` no está disponible).

## Contrato

Emite **CloudEvents 1.0** sobre un `EventEmitter` de Node y los persiste a `events.log` para inspección.

```javascript
const { bus } = require('../mocks/events/bus');

bus.publish('sap.ern.product.created.v1', {
  ID: 'P-001',
  name: 'Aspirin 500mg',
  category: 'Pharma',
  price: 9.99,
  stock: 250,
  status: 'in_stock'
});
```

Resultado (CloudEvent):

```json
{
  "specversion": "1.0",
  "type": "sap.ern.product.created.v1",
  "source": "/ern/products",
  "id": "uuid",
  "time": "2026-05-20T...",
  "datacontenttype": "application/json",
  "data": { "ID": "P-001", "name": "Aspirin 500mg", ... }
}
```

## Eventos canónicos

| Type | Emitido en | Schema |
|---|---|---|
| `sap.ern.product.created.v1` | `after('CREATE', Products)` | `schemas/sap.ern.product.created.v1.json` |
| `sap.ern.product.changed.v1` | `after('UPDATE', Products)` | `schemas/sap.ern.product.changed.v1.json` |
| `sap.ern.stock.critical.v1` | Cuando `stockCriticality === 1` (stock=0) o tras `flagLowStock` | `schemas/sap.ern.stock.critical.v1.json` |

## Activación

Tres modos vía env vars:

```bash
EVENT_BUS=local              # default — emite y guarda log
MOCK_EVENT_BUS=true          # equivalente a EVENT_BUS=local
# (sin var)                  # bus existe pero NO escribe a events.log
```

Variables opcionales:

```bash
MOCK_EVENT_BUS_LOG=/tmp/events.log    # ruta del log (default: ./events.log)
MOCK_EVENT_BUS_SOURCE=/ern/products   # campo source de CloudEvents
```

## Sustitución por Event Mesh real

Cuando se pase a paid/enterprise, reemplazar la importación:

```javascript
// antes
const { bus } = require('../mocks/events/bus');
// después
const { bus } = require('@sap/event-mesh-client'); // o adapter equivalente
```

Los **schemas** y los **type names** (`sap.ern.*.v1`) NO cambian — eso es la sincronía contractual.

## Tests

```bash
npm run test:mocks:events
```

Verifica:

- Publish devuelve CloudEvent válido (specversion, type, source, id, time, data)
- Eventos quedan en `bus.published` para assertion en tests del servicio
- Listeners reciben el CloudEvent
- Schema JSON validates contra Ajv
