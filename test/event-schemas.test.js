const { loadAllSchemas, validateEvent } = require('./helpers/event-schema');

describe('event schema contracts (Ajv)', () => {
    let bus;

    beforeAll(() => {
        process.env.MOCK_EVENT_BUS = 'true';
        delete require.cache[require.resolve('../mocks/events/bus')];
        bus = require('../mocks/events/bus').bus;
    });

    beforeEach(() => bus.reset());

    test('all schemas in mocks/events/schemas/ compile under Ajv', () => {
        const schemas = loadAllSchemas();
        expect(Object.keys(schemas).length).toBeGreaterThanOrEqual(5);
        expect(schemas['sap.ern.product.created.v1']).toBeDefined();
        expect(schemas['sap.ern.product.changed.v1']).toBeDefined();
        expect(schemas['sap.ern.stock.critical.v1']).toBeDefined();
        expect(schemas['sap.ern.stock.low.v1']).toBeDefined();
        expect(schemas['sap.ern.ai.restock.suggested.v1']).toBeDefined();
    });

    test('product.created.v1 — valid event passes', () => {
        const evt = bus.publish('sap.ern.product.created.v1', {
            ID: 'P-001', name: 'Aspirin', category: 'Pharma',
            price: 5.5, stock: 100, status: 'in_stock'
        });
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });

    test('product.created.v1 — missing data.name fails', () => {
        const evt = bus.publish('sap.ern.product.created.v1', { ID: 'P-001' });
        const { ok, errors } = validateEvent(evt);
        expect(ok).toBe(false);
        expect(errors.some(e => e.message?.includes('name'))).toBe(true);
    });

    test('product.changed.v1 — valid event passes', () => {
        const evt = bus.publish('sap.ern.product.changed.v1', {
            ID: 'P-002',
            changedFields: ['stock', 'status'],
            newValues: { stock: 50, status: 'low_stock' }
        });
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });

    test('stock.critical.v1 — valid event (stock=0, criticality=1) passes', () => {
        const evt = bus.publish('sap.ern.stock.critical.v1', {
            ID: 'P-003', stock: 0, criticality: 1, trigger: 'update'
        });
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });

    test('stock.critical.v1 — stock=5 violates const 0', () => {
        const evt = bus.publish('sap.ern.stock.critical.v1', {
            ID: 'P-003', stock: 5, criticality: 1, trigger: 'update'
        });
        const { ok, errors } = validateEvent(evt);
        expect(ok).toBe(false);
        expect(errors.some(e => e.instancePath.includes('stock'))).toBe(true);
    });

    test('stock.critical.v1 — criticality=2 violates const 1 (must use stock.low.v1)', () => {
        const evt = bus.publish('sap.ern.stock.critical.v1', {
            ID: 'P-003', stock: 0, criticality: 2, trigger: 'update'
        });
        const { ok, errors } = validateEvent(evt);
        expect(ok).toBe(false);
        expect(errors.some(e => e.instancePath.includes('criticality'))).toBe(true);
    });

    test('stock.low.v1 — valid event (criticality=2) passes', () => {
        const evt = bus.publish('sap.ern.stock.low.v1', {
            ID: 'P-004', criticality: 2, trigger: 'flagLowStock'
        });
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });

    test('ai.restock.suggested.v1 — valid event passes', () => {
        const evt = bus.publish('sap.ern.ai.restock.suggested.v1', {
            count: 3, model: 'mock-llm-v1',
            productIDs: ['P-001', 'P-002', 'P-003']
        });
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });

    test('ai.restock.suggested.v1 — missing model fails', () => {
        const evt = bus.publish('sap.ern.ai.restock.suggested.v1', {
            count: 0, productIDs: []
        });
        const { ok, errors } = validateEvent(evt);
        expect(ok).toBe(false);
        expect(errors.some(e => e.message?.includes('model'))).toBe(true);
    });

    test('every event published by srv/service paths matches its schema', async () => {
        bus.publish('sap.ern.product.created.v1', { ID: 'X1', name: 'N', stock: 10, status: 'in_stock' });
        bus.publish('sap.ern.product.changed.v1', { ID: 'X1', changedFields: ['stock'], newValues: { stock: 0 } });
        bus.publish('sap.ern.stock.critical.v1', { ID: 'X1', stock: 0, criticality: 1, trigger: 'update' });
        bus.publish('sap.ern.stock.low.v1', { ID: 'X2', criticality: 2, trigger: 'flagLowStock' });
        bus.publish('sap.ern.ai.restock.suggested.v1', { count: 1, model: 'mock-llm-v1', productIDs: ['X1'] });

        for (const evt of bus.published) {
            const { ok, errors } = validateEvent(evt);
            if (!ok) {
                throw new Error(`Event ${evt.type} failed validation: ${JSON.stringify(errors)}`);
            }
            expect(ok).toBe(true);
        }
    });

    test('subject auto-derived as products/<ID> for product.* and stock.* events', () => {
        const productEvt = bus.publish('sap.ern.product.created.v1', { ID: 'P-9', name: 'X' });
        const changedEvt = bus.publish('sap.ern.product.changed.v1', { ID: 'P-9', changedFields: ['x'] });
        const criticalEvt = bus.publish('sap.ern.stock.critical.v1', { ID: 'P-9', stock: 0, criticality: 1 });
        const lowEvt = bus.publish('sap.ern.stock.low.v1', { ID: 'P-9', criticality: 2, trigger: 'flagLowStock' });
        expect(productEvt.subject).toBe('products/P-9');
        expect(changedEvt.subject).toBe('products/P-9');
        expect(criticalEvt.subject).toBe('products/P-9');
        expect(lowEvt.subject).toBe('products/P-9');
    });

    test('subject NOT set for ai.restock.suggested.v1 (aggregate event, no single entity)', () => {
        const evt = bus.publish('sap.ern.ai.restock.suggested.v1', {
            count: 2, model: 'mock-llm-v1', productIDs: ['A', 'B']
        });
        expect(evt.subject).toBeUndefined();
    });

    test('explicit subject argument overrides auto-derivation', () => {
        const evt = bus.publish('sap.ern.product.created.v1',
            { ID: 'P-1', name: 'X' },
            'audit/import-batch-42');
        expect(evt.subject).toBe('audit/import-batch-42');
    });

    test('mock observability: every event carries xmock=true and xprovider=mock', () => {
        const evt = bus.publish('sap.ern.product.created.v1', { ID: 'P-OBS', name: 'X' });
        expect(evt.xmock).toBe(true);
        expect(evt.xprovider).toBe('mock');
        const { ok, errors } = validateEvent(evt);
        expect(errors).toBeNull();
        expect(ok).toBe(true);
    });
});
