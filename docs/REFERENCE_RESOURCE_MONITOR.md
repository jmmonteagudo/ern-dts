# Reference: btp-resource-consumption-monitor

> Repo: https://github.com/SAP-samples/btp-resource-consumption-monitor
> Analizado: 2026-05-21
> Propósito: norte estético/arquitectónico para el dashboard final del producto MCP server. **No es plantilla a clonar**, es referencia de patrones reutilizables.

## Stack confirmado

| Capa | Decisión |
|---|---|
| Backend | CAP TypeScript (`@sap/cds ~9.9`), HANA prod / SQLite dev |
| Servicios | OData V4 (presentation, analytics, contract, retrieval, manageAlerts, manageTags) — **6 servicios separados** por bounded context |
| Apps Fiori | **9 apps** Fiori Elements (mismo MTA), no una sola |
| UI técnica | `sap.fe.templates` (List Report + Object Page), `flexEnabled: true`, mín UI5 1.136 |
| Charts pesados | **SAC stories** en carpeta `/sac/`, no UI5 |
| Workzone | Cards en `/workzone/` |
| Deploy | MTA → CF + Helm chart Kyma |
| Notifications | `mtaext_notifications.mtaext` con SAP Alert Notification Service |

## Patrón de extensibilidad — clave para Ern

El "look custom" no viene de UI5 puro: viene de **Fiori Elements + annotations CDS + extension points puntuales**. Tres mecanismos combinados:

### 1. `controlConfiguration` en manifest (sin código)

Action menus, navegación entre Object Pages, variantes — todo declarativo en `manifest.json` bajo `routing.targets[X].options.settings.controlConfiguration["@com.sap.vocabularies.UI.v1.LineItem"]`. Define menús con sub-menús (`type: menu`), bulk actions, navegaciones jerárquicas Object Page → sub Object Page sin código JS.

### 2. `extends.extensions` (controller extension)

```json
"sap.ui5": {
  "extends": {
    "extensions": {
      "sap.ui.controllerExtensions": {
        "sap.fe.templates.ListReport.ListReportController": {
          "controllerName": "btprcreport.ext.controller.ListReportExt"
        }
      }
    }
  }
}
```

El controller extension importa `sap/ui/core/mvc/ControllerExtension`, override `onInit`, e implementa los handlers que el manifest referencia con `.extension.btprcreport.ext.controller.ListReportExt.onSetBulkTechnicalAllocations`.

### 3. Fragments para diálogos custom

`webapp/ext/fragments/*.fragment.xml` — XML puro `sap.m`, abierto desde el controller extension. Es el patrón estándar para diálogos custom sin reemplazar el template FE.

## Annotations analíticas (KPIs/Charts en FE)

Los charts dentro de FE **no son `sap.viz`** — son annotations:

```cds
@UI: {
  Chart: {
    Visualizations: ['@UI.Chart'],
    DynamicMeasures: ['@Analytics.AggregatedProperty#cost', ...]
  }
}
@Analytics.AggregatedProperty: {
  Name: 'cost',
  AggregationMethod: 'sum',
  AggregatableProperty: 'rawCost',
  '@Common.Label': 'Total Cost'
}
```

FE renderiza KPI tiles, charts, totales agregados a partir de eso. Cero JS.

## Lo aplicable directamente al PoC Ern

| Idea | Aplicación en Ern |
|---|---|
| Extension points + custom action en menu | Botón "Sugerir Restock" en List Report → llama action `suggestRestock` (AI mock) |
| Controller extension con fragment | Diálogo de confirmación antes de invocar la AI |
| Custom formatter | `stockCriticality` con i18n (Critical/Low/OK) |
| Annotations analíticas | `@Analytics.AggregatedProperty` para "stock total por categoría" |
| Bypass draft (CAP fiori option) | `cds.fiori.bypass_draft: true` para acciones idempotentes |

## Lo que **no** copiamos

- 9 apps separadas — para PoC sobra con 1 List Report + Object Page extendidos.
- SAC stories — fuera del trial gratuito.
- Helm/Kyma chart — el PoC va a CF únicamente.
- Notifications service — no hace falta para la demo.
- Plugin ai-core (`_plugin_ai-core.cds`) — referencia útil para anotaciones AI, pero AI Core no está en trial; usamos el mock.

## Pista para el PoC del producto final (cost estimator MCP dashboard)

Si en el futuro reanudamos ese proyecto:
- Replicar la separación servicios CAP por bounded context (`presentationService`, `retrievalService`, `analyticsService`).
- Usar `@Analytics.AggregatedProperty` para los KPIs sin código.
- Charts pesados → SAC; en el dashboard CAP solo KPI tiles + tablas.
- Workzone cards si el dashboard se integra en BTP Cockpit.
