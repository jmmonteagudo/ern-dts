# Ern (CIS_DTS edition)

Enterprise product management platform on SAP BTP. Fork of [`ern`](https://github.com/jmmonteagudo/ern) re-targeted at the corporate **CIS_DTS** global account, region **eu10**, subaccount **CF_EU10_I589361_3** (Sandboxes directory). Same code, different landscape: full Joule for Developers, real services available beyond Trial limits.

## Environment

| | |
|---|---|
| Global Account | CIS_DTS (`39c3a16d-8bc5-4286-8696-1e884b553d4b`) |
| Subaccount | CF_EU10_I589361_3 (`42dfec9f-44c0-4d19-a214-3728823ac23e`) |
| Region | cf-eu10 |
| CF Org / Space | `ern-cf-org` / `dev` |
| App | `ern-dts-srv` |
| Build Code | `https://cf-eu10-i589361-3.eu10.build.cloud.sap` |
| BAS | `https://cf-eu10-i589361-3.eu10cf.applicationstudio.cloud.sap` |

## Quick Start

```bash
npm install
cds watch
# Open http://localhost:4004/products/webapp/index.html#preview-app
```

## Test

```bash
npm test              # 80 tests across 7 suites
npm run test:coverage # with coverage
npm run test:ui       # UI tier only (formatter + manifest wiring)
npm run test:mocks    # all mocks (atc + ai + events)
```

Suites:
- `service.test.js` — CAP handlers (CRUD, actions, audit, events) — 17 tests
- `event-schemas.test.js` — Ajv contract validation for all CloudEvents — 15 tests
- `mocks-ai.test.js` — deterministic AI mock — 10 tests
- `mocks-atc.test.js` — ATC HTTP mock + fixtures — 7 tests
- `mocks-events.test.js` — CloudEvents 1.0 mock event bus — 7 tests
- `ui-formatter.test.js` — Fiori formatter (Jest tier via UI5 stub) — 7 tests
- `ui-manifest.test.js` — manifest extension wiring + i18n keys — 7 tests

## Deploy

Automated via GitHub Actions on push to `main` (`lint` → `test-unit` + `test-ui` → `deploy`). Manual:

```bash
cf push
```

`.cfignore` keeps `mocks/`, `test/`, `docs/`, `abap/` out of the CF bundle. `srv/` uses adapter boundary (`srv/adapters/*`) — production code never imports from `mocks/`. Backend selection via `EVENT_BUS_MODE` / `AI_MODE` (`mock`|`real`|`disabled`).

## Architecture

See [docs/ARCHITECTURE_FINAL.md](docs/ARCHITECTURE_FINAL.md) for technical design and [docs/TRIAL_LIMITATIONS.md](docs/TRIAL_LIMITATIONS.md) for the trial-vs-real component matrix and mock catalog.

## Stack

- SAP CAP Node.js ^7 (OData v4)
- SAP Fiori Elements (SAPUI5 1.133.0) with controller extensions, custom action, custom Object Page section
- SQLite in-memory (BTP Trial)
- Mocks: contract-first SAP Event Mesh / AI Core / ATC stand-ins
- GitHub Actions CI/CD with concurrency gating
- Cloud Foundry (BTP CIS_DTS, eu10)

## Live

- App: https://ern-dts-srv.cfapps.eu10.hana.ondemand.com/products/webapp/index.html
- API: https://ern-dts-srv.cfapps.eu10.hana.ondemand.com/api/Products
