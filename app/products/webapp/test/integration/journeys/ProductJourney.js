sap.ui.define([
    "sap/ui/test/Opa5",
    "sap/ui/test/opaQunit",
    "test/integration/pages/ProductsListPage"
], function (Opa5, opaTest) {
    "use strict";

    Opa5.extendConfig({
        viewNamespace: "sap.fe.templates.ListReport.view.",
        autoWait: true,
        appParams: { "sap-ui-animation": false }
    });

    QUnit.module("Product Journey");

    opaTest("Application starts on the List Report", function (Given, When, Then) {
        Given.iStartMyApp();
        Then.onTheProductsList.iSeeTheTable();
    });

    opaTest("Custom AI Info action is available", function (Given, When, Then) {
        Then.onTheProductsList.iSeeTheCustomAiInfoAction();
    });

    opaTest("Pressing AI Info opens an information dialog", function (Given, When, Then) {
        When.onTheProductsList.iPressTheCustomAiInfoAction();
        Then.onTheProductsList.iSeeTheAiInfoDialog();
        When.onTheProductsList.iCloseTheAiInfoDialog();
        Then.iTeardownMyApp();
    });
});
