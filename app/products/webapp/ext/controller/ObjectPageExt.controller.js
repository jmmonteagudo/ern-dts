sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "../formatter/CriticalityFormatter"
], function (ControllerExtension, CriticalityFormatter) {
    "use strict";

    return ControllerExtension.extend("erndts.products.ext.controller.ObjectPageExt", {

        formatter: CriticalityFormatter,

        override: {
            onInit: function () {
                // no-op — placeholder for future hooks
            }
        }
    });
});
