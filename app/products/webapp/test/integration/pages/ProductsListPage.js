sap.ui.define([
    "sap/ui/test/Opa5",
    "sap/ui/test/actions/Press",
    "sap/ui/test/matchers/PropertyStrictEquals"
], function (Opa5, Press, PropertyStrictEquals) {
    "use strict";

    var sViewName = "ListReport";

    Opa5.createPageObjects({
        onTheProductsList: {

            actions: {
                iStartMyApp: function () {
                    return this.iStartMyAppInAFrame("/index.html");
                },

                iPressTheCustomAiInfoAction: function () {
                    return this.waitFor({
                        controlType: "sap.m.Button",
                        matchers: new PropertyStrictEquals({ name: "id", value: "showAiInfoBtn" }),
                        actions: new Press(),
                        errorMessage: "Custom AI Info button not found"
                    });
                },

                iCloseTheAiInfoDialog: function () {
                    return this.waitFor({
                        controlType: "sap.m.Button",
                        searchOpenDialogs: true,
                        matchers: new PropertyStrictEquals({ name: "text", value: "OK" }),
                        actions: new Press(),
                        errorMessage: "Could not close AI Info dialog"
                    });
                }
            },

            assertions: {
                iSeeTheTable: function () {
                    return this.waitFor({
                        controlType: "sap.ui.mdc.Table",
                        viewName: sViewName,
                        success: function () { Opa5.assert.ok(true, "Table is visible"); },
                        errorMessage: "List Report table not visible"
                    });
                },

                iSeeTheCustomAiInfoAction: function () {
                    return this.waitFor({
                        controlType: "sap.m.Button",
                        matchers: new PropertyStrictEquals({ name: "id", value: "showAiInfoBtn" }),
                        success: function () { Opa5.assert.ok(true, "Custom AI Info button rendered"); },
                        errorMessage: "Custom AI Info button missing"
                    });
                },

                iSeeTheAiInfoDialog: function () {
                    return this.waitFor({
                        controlType: "sap.m.Dialog",
                        searchOpenDialogs: true,
                        success: function () { Opa5.assert.ok(true, "Information dialog visible"); },
                        errorMessage: "AI Info dialog did not open"
                    });
                }
            }
        }
    });
});
