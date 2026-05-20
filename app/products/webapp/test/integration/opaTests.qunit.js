sap.ui.require([
    "test/integration/journeys/ProductJourney"
], function () {
    "use strict";
    QUnit.config.autostart = false;
    sap.ui.require([], function () {
        QUnit.start();
    });
});
