sap.ui.define([
    "ern/products/ext/formatter/CriticalityFormatter"
], function (CriticalityFormatter) {
    "use strict";

    QUnit.module("CriticalityFormatter — criticalityState");

    QUnit.test("returns Error for criticality 1", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityState(1), "Error");
    });

    QUnit.test("returns Warning for criticality 2", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityState(2), "Warning");
    });

    QUnit.test("returns Success for criticality 3", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityState(3), "Success");
    });

    QUnit.test("returns None for unknown values", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityState(0), "None");
        assert.strictEqual(CriticalityFormatter.criticalityState(undefined), "None");
    });

    QUnit.module("CriticalityFormatter — criticalityText");

    var bundleStub = { getText: function (k) { return "tr(" + k + ")"; } };

    QUnit.test("returns translated label for known criticalities", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityText(1, bundleStub), "tr(criticality.critical)");
        assert.strictEqual(CriticalityFormatter.criticalityText(2, bundleStub), "tr(criticality.low)");
        assert.strictEqual(CriticalityFormatter.criticalityText(3, bundleStub), "tr(criticality.ok)");
    });

    QUnit.test("returns unknown text for unrecognized criticality", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityText(42, bundleStub), "tr(criticality.unknown)");
    });

    QUnit.test("falls back to raw key when no bundle", function (assert) {
        assert.strictEqual(CriticalityFormatter.criticalityText(1), "criticality.critical");
    });
});
