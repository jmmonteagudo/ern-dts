const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const SCHEMA_DIR = path.join(__dirname, '..', '..', 'mocks', 'events', 'schemas');

let ajv;
const validators = new Map();

function getAjv() {
    if (ajv) return ajv;
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv;
}

function loadAllSchemas() {
    const files = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));
    const schemas = {};
    for (const f of files) {
        const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8'));
        const eventType = schema.properties?.type?.const;
        if (!eventType) {
            throw new Error(`Schema ${f} missing properties.type.const`);
        }
        schemas[eventType] = schema;
    }
    return schemas;
}

function validatorFor(eventType) {
    if (validators.has(eventType)) return validators.get(eventType);
    const schemas = loadAllSchemas();
    const schema = schemas[eventType];
    if (!schema) throw new Error(`No schema registered for event type ${eventType}`);
    const validate = getAjv().compile(schema);
    validators.set(eventType, validate);
    return validate;
}

function validateEvent(event) {
    const validate = validatorFor(event.type);
    const ok = validate(event);
    return { ok, errors: ok ? null : validate.errors };
}

module.exports = {
    loadAllSchemas,
    validatorFor,
    validateEvent
};
