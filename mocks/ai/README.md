# Mock AI (SAP Generative AI Hub / AI Core)

Sustituye el endpoint orchestration de SAP AI Core cuando se trabaja contra trial gratuito (donde AI Core no está incluido).

## Contrato

Una función `suggestRestock` que toma productos + audit context y devuelve sugerencias de reposición. Misma forma que devolvería un LLM real con grounding sobre datos del producto.

```javascript
const ai = require('../mocks/ai/client');

const suggestions = await ai.suggestRestock({
  products: [
    { ID: 'P-001', name: 'Aspirin', stock: 50 }
  ],
  auditByProduct: {
    'P-001': [/* audit entries para grounding */]
  }
});
```

Respuesta:

```json
[
  {
    "productID": "P-001",
    "currentStock": 50,
    "suggestedOrder": 300,
    "reason": "Critical stock level (50 units); historical turnover suggests +300 order.",
    "confidence": 0.78,
    "model": "mock-llm-v1",
    "groundingDocs": ["product:P-001", "audit-log:P-001"]
  }
]
```

## Determinismo

El mock NO es aleatorio en el contenido — la `confidence` se deriva de `sha256(productID + stock)` para que los tests sean reproducibles. La latencia SÍ es aleatoria (entre `MOCK_AI_LATENCY_MIN_MS` y `MOCK_AI_LATENCY_MAX_MS`) para simular llamadas reales.

## Reglas de sugerencia

| Stock | suggestedOrder |
|---|---|
| 0 | 500 |
| < 50 | 300 |
| < 100 | 200 |
| < 200 | 100 |
| ≥ 200 | 50 |

Estas reglas son **placeholder**. La interfaz queda intacta cuando se sustituya por un LLM real — solo cambia el cuerpo de `suggestRestock`.

## Activación

```bash
MOCK_AI=true                          # activa el mock
AI_PROVIDER=mock                      # equivalente
MOCK_AI_LATENCY_MIN_MS=500            # default 500ms
MOCK_AI_LATENCY_MAX_MS=1500           # default 1500ms
MOCK_AI_MODEL=mock-llm-v1             # campo model en la respuesta
```

## Sustitución por SAP AI Core real

Cuando se pase a paid:

```javascript
// antes
const ai = require('../mocks/ai/client');
// después
const ai = require('./adapters/aicore'); // adapter sobre @sap/xsenv + AI Core orchestration API
```

La firma `suggestRestock({ products, auditByProduct })` y la shape de la respuesta NO cambian.

## Tests

```bash
npm run test:mocks:ai
```

Verifica:

- Devuelve un array con misma cardinalidad que input
- Cada item tiene los campos del contrato (productID, currentStock, suggestedOrder, reason, confidence, model, groundingDocs)
- `confidence` es determinista para mismo (productID, stock)
- `suggestedOrder` respeta la tabla de reglas
- `groundingDocs` incluye audit-log si hay entries
- Latencia simulada se aplica
