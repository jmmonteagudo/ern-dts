const path = require('path');
const fs = require('fs');
const os = require('os');

describe('mock event bus', () => {
  let bus;
  const tmpLog = path.join(os.tmpdir(), `ern-events-${Date.now()}.log`);

  beforeAll(() => {
    process.env.MOCK_EVENT_BUS = 'true';
    process.env.MOCK_EVENT_BUS_LOG = tmpLog;
    delete require.cache[require.resolve('../mocks/events/bus')];
    bus = require('../mocks/events/bus').bus;
  });

  beforeEach(() => bus.reset());

  afterAll(() => {
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  });

  test('publish returns a CloudEvent 1.0 envelope', () => {
    const evt = bus.publish('sap.ern.product.created.v1', { ID: 'P-001', name: 'Aspirin' });
    expect(evt.specversion).toBe('1.0');
    expect(evt.type).toBe('sap.ern.product.created.v1');
    expect(evt.source).toBe('/ern/products');
    expect(evt.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(evt.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evt.datacontenttype).toBe('application/json');
    expect(evt.data).toEqual({ ID: 'P-001', name: 'Aspirin' });
  });

  test('published events accumulate in bus.published', () => {
    bus.publish('sap.ern.product.created.v1', { ID: 'P-001' });
    bus.publish('sap.ern.product.changed.v1', { ID: 'P-001', changedFields: ['stock'] });
    expect(bus.published).toHaveLength(2);
    expect(bus.published[0].type).toBe('sap.ern.product.created.v1');
    expect(bus.published[1].type).toBe('sap.ern.product.changed.v1');
  });

  test('listeners on specific type receive the CloudEvent', done => {
    bus.once('sap.ern.stock.critical.v1', evt => {
      expect(evt.type).toBe('sap.ern.stock.critical.v1');
      expect(evt.data.criticality).toBe(1);
      done();
    });
    bus.publish('sap.ern.stock.critical.v1', { ID: 'P-001', stock: 0, criticality: 1 });
  });

  test('wildcard listener receives any event', done => {
    let count = 0;
    const listener = () => {
      count++;
      if (count === 2) {
        bus.off('*', listener);
        done();
      }
    };
    bus.on('*', listener);
    bus.publish('sap.ern.product.created.v1', { ID: 'A' });
    bus.publish('sap.ern.product.changed.v1', { ID: 'A', changedFields: [] });
  });

  test('events are appended to log file when MOCK_EVENT_BUS=true', () => {
    bus.publish('sap.ern.product.created.v1', { ID: 'P-LOG', name: 'LogTest' });
    const content = fs.readFileSync(tmpLog, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.type).toBe('sap.ern.product.created.v1');
    expect(last.data.ID).toBe('P-LOG');
  });

  test('reset clears in-memory published list', () => {
    bus.publish('sap.ern.product.created.v1', { ID: 'X' });
    expect(bus.published).toHaveLength(1);
    bus.reset();
    expect(bus.published).toHaveLength(0);
  });

  test('contract: emitted CloudEvent matches schema for product.created.v1', () => {
    const schema = require('../mocks/events/schemas/sap.ern.product.created.v1.json');
    const evt = bus.publish('sap.ern.product.created.v1', {
      ID: 'P-002',
      name: 'Ibuprofen',
      category: 'Pharma',
      price: 5.5,
      stock: 100,
      status: 'in_stock'
    });
    for (const required of schema.required) {
      expect(evt[required]).toBeDefined();
    }
    expect(evt.specversion).toBe(schema.properties.specversion.const);
    expect(evt.type).toBe(schema.properties.type.const);
    for (const required of schema.properties.data.required) {
      expect(evt.data[required]).toBeDefined();
    }
  });
});
