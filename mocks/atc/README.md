# Mock ATC (ABAP Test Cockpit)

Reemplaza el endpoint `${ABAP_HOST}/sap/bc/adt/atc/runs` cuando se usa BTP trial gratuito (donde `client_credentials` grant es rechazado por el ABAP system con HTTP 401).

## Contrato simulado

### POST /sap/bc/adt/atc/runs

Request:
```http
POST /sap/bc/adt/atc/runs
Authorization: Bearer <any non-empty string>
Content-Type: application/vnd.sap.atc.run.parameters.v1+xml
Accept: application/vnd.sap.atc.run.v1+xml

<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" maximumVerdicts="100">
  <objectSets>
    <objectSet kind="inclusive">
      <objects>
        <object name="ZERN_PRODUCTS" type="DEVC/K"/>
      </objects>
    </objectSet>
  </objectSets>
</atc:run>
```

Response:
```http
HTTP/1.1 201 Created
Content-Type: application/vnd.sap.atc.run.v1+xml

<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" id="run-mock-<timestamp>" status="running"/>
```

### GET /sap/bc/adt/atc/runs/{id}

Response (success scenario, default):
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.sap.atc.run.v1+xml

<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" id="run-mock-<id>" status="completed">
  <findings count="0"/>
</atc:run>
```

Response (with findings, set via `MOCK_ATC_FIXTURE=run-with-findings`):
```http
HTTP/1.1 200 OK

<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" id="run-mock-<id>" status="completed">
  <findings count="2">
    <finding priority="3" check="EXTENDED_CHECK" object="ZI_ERN_PRODUCT" line="42">
      Unused variable 'lv_temp'
    </finding>
    <finding priority="3" check="UNIT_TESTS" object="ZCL_ERN_PRODUCT_HELPER" line="18">
      Public method without unit test
    </finding>
  </findings>
</atc:run>
```

> Pipeline solo falla con `priority="1"` o `priority="2"`. Prio 3 son warnings.

### Auth check

El mock acepta CUALQUIER `Authorization: Bearer <non-empty>`. NO verifica firma JWT — es un mock. Sin header → 401.

## Cómo arrancar

```bash
# Desde raíz del repo
node mocks/atc/server.js
# Listening on http://localhost:8765
```

Variables de entorno:

```bash
PORT=8765                              # default 8765
MOCK_ATC_FIXTURE=run-success           # run-success | run-with-findings
MOCK_ATC_LATENCY_MS=2000               # latencia simulada en POST + cada GET
```

## Integración con pipeline GitHub Actions

En `.github/workflows/ci-cd.yml`:

```yaml
test-abap-mock:
  name: ABAP Quality (ATC mock)
  runs-on: ubuntu-latest
  needs: lint
  if: ${{ vars.ATC_MOCK == 'true' }}
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - name: Start mock ATC
      run: |
        node mocks/atc/server.js &
        npx wait-on http://localhost:8765/health --timeout 10000
    - name: Run ATC against mock
      env:
        ABAP_HOST: http://localhost:8765
        ABAP_TOKEN: mock-token-anything
      run: |
        # Use same curl flow as real test-abap, just pointing at mock
        bash mocks/atc/run-atc-flow.sh
```

Activación: en GitHub repo → Settings → Variables → New repository variable → `ATC_MOCK = true`.

## Tests

```bash
npm run test:mocks:atc
# Verifica:
# - POST devuelve 201 con XML válido
# - GET devuelve 200 con run completed
# - Sin auth → 401
# - Fixture run-with-findings devuelve findings prio 3
```
