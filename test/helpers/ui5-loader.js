// Stub `sap.ui.define` for Node so the UI5 module can be required directly.
// This lets us unit-test pure formatter logic in Jest without spinning up a UI5 runtime.

global.sap = global.sap || {};
global.sap.ui = global.sap.ui || {};

let lastExport = null;

global.sap.ui.define = function (deps, factory) {
    // Resolve dependencies as no-ops or simple stubs (formatters have no deps).
    const resolved = (deps || []).map(() => ({}));
    lastExport = factory.apply(null, resolved);
    return lastExport;
};

module.exports = {
    requireUI5: function (modulePath) {
        delete require.cache[require.resolve(modulePath)];
        lastExport = null;
        require(modulePath);
        return lastExport;
    }
};
