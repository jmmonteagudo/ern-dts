const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENABLED = process.env.MOCK_EVENT_BUS === 'true' || process.env.EVENT_BUS === 'local';
const LOG_FILE = process.env.MOCK_EVENT_BUS_LOG || path.join(process.cwd(), 'events.log');
const SOURCE = process.env.MOCK_EVENT_BUS_SOURCE || '/ern/products';

function deriveSubject(type, data) {
  if (!data || !data.ID) return null;
  if (type.startsWith('sap.ern.product.') || type.startsWith('sap.ern.stock.')) {
    return `products/${data.ID}`;
  }
  return null;
}

class MockEventBus extends EventEmitter {
  constructor() {
    super();
    this.published = [];
  }

  publish(type, data, subject) {
    const resolvedSubject = subject || deriveSubject(type, data);
    const cloudEvent = {
      specversion: '1.0',
      type,
      source: SOURCE,
      ...(resolvedSubject ? { subject: resolvedSubject } : {}),
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      xmock: true,
      xprovider: 'mock',
      data: data || {}
    };

    this.published.push(cloudEvent);

    if (ENABLED) {
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(cloudEvent) + '\n');
      } catch (err) {
        console.warn('[mock-event-bus] failed to append log:', err.message);
      }
    }

    this.emit(type, cloudEvent);
    this.emit('*', cloudEvent);
    return cloudEvent;
  }

  reset() {
    this.published = [];
  }
}

const bus = new MockEventBus();

module.exports = { bus, MockEventBus };
