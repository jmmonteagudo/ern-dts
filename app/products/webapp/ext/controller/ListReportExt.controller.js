sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (ControllerExtension, MessageBox, MessageToast) {
    "use strict";

    return ControllerExtension.extend("erndts.products.ext.controller.ListReportExt", {

        override: {
            onInit: function () {
                // hook to allow attaching cleanup later if needed
            }
        },

        /**
         * Custom handler invoked from a manifest-declared button.
         * Demonstrates a controller-extension code path that the OPA5 tests
         * exercise without depending on the AI mock action being wired to
         * a backend (it would in a full demo).
         */
        onShowAiInfo: function () {
            var oResourceBundle = this.base.getView()
                .getModel("i18n").getResourceBundle();
            MessageBox.information(
                oResourceBundle.getText("ai.info.text"),
                { title: oResourceBundle.getText("ai.info.title") }
            );
        },

        onSuggestRestockSuccess: function (oContext) {
            MessageToast.show("Restock suggestions generated");
            return oContext;
        }
    });
});
