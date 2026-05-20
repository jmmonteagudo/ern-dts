# Ern Products — UI Tests

> Two tiers of UI testing for the Products Fiori Elements app.

## Tier 1 — Jest unit tests (in CI, no browser)

Located outside this folder: `test/ui-formatter.test.js` and `test/ui-manifest.test.js`.

- **ui-formatter.test.js**: tests pure formatter logic (`CriticalityFormatter.js`). Uses a Node stub for `sap.ui.define`.
- **ui-manifest.test.js**: validates manifest wiring (controller extensions exist, custom actions reference handlers, fragments exist, every i18n placeholder has a key).

Run: `npm test`. Fast (< 0.5s). Run on every push by GitHub Actions (`test` job).

## Tier 2 — QUnit + OPA5 in browser (manual / future CI)

Located in `app/products/webapp/test/`.

### Unit (QUnit)

- `unit/unitTests.qunit.html` — open in browser via `cds watch` then navigate to `http://localhost:4004/products/webapp/test/unit/unitTests.qunit.html`.
- `unit/unitTests.qunit.js` — same assertions as Jest tier but loaded as real UI5 module.

### Integration (OPA5)

- `integration/opaTests.qunit.html` — entry page.
- `integration/journeys/ProductJourney.js` — Given/When/Then journey: app starts → custom AI Info button visible → press opens dialog.
- `integration/pages/ProductsListPage.js` — page object encapsulating selectors and actions for the List Report.

Run manually via `cds watch` and the URL above. To wire Karma + ChromeHeadless for CI, add `karma-ui5` later — the QUnit/OPA5 sources are runner-agnostic.

## Why two tiers

Tier 1 is the gate: fast, deterministic, blocks deploy in CI. Catches the common breakages — formatter regressions, manifest drift, missing i18n keys, dangling controller references.

Tier 2 is the demo-grade evidence: real UI5, real OPA5 journey, opens dialogs and inspects rendered DOM. Slower and needs a browser, so we keep it browser-runnable now and can promote to CI when value-justified.
