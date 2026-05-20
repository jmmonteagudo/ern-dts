/**
 * Event Bus adapter.
 *
 * Resolves the active backend based on EVENT_BUS_MODE (mock|real|disabled).
 * srv/ code imports only this adapter — never mocks/ directly.
 *
 * Modes:
 *   - "mock"     → mocks/events/bus (CloudEvents 1.0 wrapper, in-memory + log file)
 *   - "real"     → SAP Event Mesh client (NOT IMPLEMENTED — placeholder for Wave 2)
 *   - "disabled" → no-op publish; useful for unit tests that don't care about events
 *
 * Falls back to legacy flag MOCK_EVENT_BUS=true for backwards compatibility.
 */

const MODE = (process.env.EVENT_BUS_MODE
    || (process.env.MOCK_EVENT_BUS === 'true' ? 'mock' : null)
    || 'disabled').toLowerCase();

let impl;

if (MODE === 'mock') {
    impl = require('../../mocks/events/bus').bus;
} else if (MODE === 'real') {
    throw new Error('[eventBus] EVENT_BUS_MODE=real not implemented yet');
} else {
    // disabled
    impl = {
        published: [],
        publish: () => null,
        on: () => {},
        emit: () => false,
        reset: () => { impl.published.length = 0; }
    };
}

module.exports = {
    mode: MODE,
    publish: (type, data, subject) => impl.publish(type, data, subject),
    on: (type, handler) => impl.on(type, handler),
    reset: () => impl.reset && impl.reset(),
    get published() { return impl.published || []; }
};
