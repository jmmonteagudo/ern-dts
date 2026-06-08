QUnit.config.autostart = false;

sap.ui.require([
    "erndts/products/ext/formatter/CriticalityFormatter"
], function (CriticalityFormatter) {
    QUnit.module("CriticalityFormatter", {
        before: function () {
            // Any setup before the tests run can be done here
        }
    });

    QUnit.test("criticalityText - critical", function (assert) {
        var bundle = { getText: function (k) { return k; } };
        assert.strictEqual(CriticalityFormatter.criticalityText(1, bundle), "criticality.critical", "Criticality 1 returns 'criticality.critical'");
    });

    QUnit.test("criticalityText - low", function (assert) {
        var bundle = { getText: function (k) { return k; } };
        assert.strictEqual(CriticalityFormatter.criticalityText(2, bundle), "criticality.low", "Criticality 2 returns 'criticality.low'");
    });

    QUnit.test("criticalityText - ok", function (assert) {
        var bundle = { getText: function (k) { return k; } };
        assert.strictEqual(CriticalityFormatter.criticalityText(3, bundle), "criticality.ok", "Criticality 3 returns 'criticality.ok'");
    });

    QUnit.test("criticalityText - unknown", function (assert) {
        var bundle = { getText: function (k) { return k; } };
        assert.strictEqual(CriticalityFormatter.criticalityText(4, bundle), "criticality.unknown", "Unknown criticality returns 'criticality.unknown'");
    });

    QUnit.test("criticalityState", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityState(1), "Error", "Criticality 1 returns 'Error'");
        assert.strictEqual(CriticalityFormatter.criticalityState(2), "Warning", "Criticality 2 returns 'Warning'");
        assert.strictEqual(CriticalityFormatter.criticalityState(3), "Success", "Criticality 3 returns 'Success'");
        assert.strictEqual(CriticalityFormatter.criticalityState(4), "None", "Unknown criticality returns 'None'");
    });

    QUnit.start();
});