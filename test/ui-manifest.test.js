const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'app', 'products', 'webapp', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

describe('app/products manifest.json — extensibility wiring', () => {

    test('declares ListReport controller extension', () => {
        const exts = manifest['sap.ui5'].extends.extensions['sap.ui.controllerExtensions'];
        expect(exts['sap.fe.templates.ListReport.ListReportController']).toBeDefined();
        expect(exts['sap.fe.templates.ListReport.ListReportController'].controllerName)
            .toBe('erndts.products.ext.controller.ListReportExt');
    });

    test('declares ObjectPage controller extension', () => {
        const exts = manifest['sap.ui5'].extends.extensions['sap.ui.controllerExtensions'];
        expect(exts['sap.fe.templates.ObjectPage.ObjectPageController']).toBeDefined();
        expect(exts['sap.fe.templates.ObjectPage.ObjectPageController'].controllerName)
            .toBe('erndts.products.ext.controller.ObjectPageExt');
    });

    test('referenced controller files exist', () => {
        const exts = manifest['sap.ui5'].extends.extensions['sap.ui.controllerExtensions'];
        const base = path.join(__dirname, '..', 'app', 'products', 'webapp');
        for (const def of Object.values(exts)) {
            const relPath = def.controllerName
                .replace('erndts.products.', '')
                .replace(/\./g, '/') + '.controller.js';
            const file = path.join(base, relPath);
            expect(fs.existsSync(file)).toBe(true);
        }
    });

    test('declares custom action ShowAiInfo with localized text and handler', () => {
        const lr = manifest['sap.ui5'].routing.targets.ProductsList;
        const actions = lr.options.settings.controlConfiguration['@com.sap.vocabularies.UI.v1.LineItem'].actions;
        expect(actions.ShowAiInfo).toBeDefined();
        expect(actions.ShowAiInfo.text).toMatch(/^\{i18n>/);
        expect(actions.ShowAiInfo.press)
            .toBe('.extension.erndts.products.ext.controller.ListReportExt.onShowAiInfo');
    });

    test('declares Object Page custom section AiSuggestionsSection', () => {
        const op = manifest['sap.ui5'].routing.targets.ProductsDetail;
        const sections = op.options.settings.content.body.sections;
        expect(sections.AiSuggestionsSection).toBeDefined();
        expect(sections.AiSuggestionsSection.template)
            .toBe('erndts.products.ext.fragment.AiSuggestionsSection');
    });

    test('referenced fragment file exists', () => {
        const op = manifest['sap.ui5'].routing.targets.ProductsDetail;
        const tpl = op.options.settings.content.body.sections.AiSuggestionsSection.template;
        const file = path.join(__dirname, '..', 'app', 'products', 'webapp', tpl.replace('erndts.products.', '').replace(/\./g, '/') + '.fragment.xml');
        expect(fs.existsSync(file)).toBe(true);
    });

    test('every i18n placeholder used in manifest has a key in i18n.properties', () => {
        const i18nFile = path.join(__dirname, '..', 'app', 'products', 'webapp', 'i18n', 'i18n.properties');
        const i18n = fs.readFileSync(i18nFile, 'utf-8');
        const keys = new Set(
            i18n.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'))
                .map(l => l.split('=')[0])
        );

        const manifestText = JSON.stringify(manifest);
        const placeholders = new Set();
        const re = /\{i18n>([^}]+)\}/g;
        let m;
        while ((m = re.exec(manifestText)) !== null) {
            placeholders.add(m[1]);
        }

        for (const p of placeholders) {
            expect(keys.has(p)).toBe(true);
        }
    });
});
