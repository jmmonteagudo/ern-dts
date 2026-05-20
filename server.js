const cds = require('@sap/cds');

cds.env.features ??= {};
cds.env.features.in_memory_db = true;

module.exports = cds.server;
