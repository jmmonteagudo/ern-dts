sap.ui.define([], function () {
    "use strict";

    /**
     * Returns a human-readable label for a stock criticality value.
     * 1 = Out of stock (Critical), 2 = Low stock (Warning), 3 = OK.
     * Falls back to a localized "Unknown" if the i18n bundle is unavailable.
     */
    function criticalityText(iCriticality, oResourceBundle) {
        var sKey;
        switch (iCriticality) {
            case 1:
                sKey = "criticality.critical";
                break;
            case 2:
                sKey = "criticality.low";
                break;
            case 3:
                sKey = "criticality.ok";
                break;
            default:
                sKey = "criticality.unknown";
        }
        if (oResourceBundle && typeof oResourceBundle.getText === "function") {
            return oResourceBundle.getText(sKey);
        }
        return sKey;
    }

    /**
     * Maps stock criticality to a UI5 ValueState string.
     * Pure function — does not depend on any controller context.
     */
    function criticalityState(iCriticality) {
        switch (iCriticality) {
            case 1: return "Error";
            case 2: return "Warning";
            case 3: return "Success";
            default: return "None";
        }
    }

    return {
        criticalityText: criticalityText,
        criticalityState: criticalityState
    };
});
