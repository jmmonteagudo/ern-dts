/**
 * AI provider adapter.
 *
 * Resolves the active backend based on AI_MODE (mock|real|disabled).
 * srv/ code imports only this adapter — never mocks/ directly.
 *
 * Modes:
 *   - "mock"     → mocks/ai/client (deterministic SHA256-based mock)
 *   - "real"     → SAP AI Core / Generative AI Hub (NOT IMPLEMENTED — placeholder for Wave 2)
 *   - "disabled" → throws on call; the suggestRestock action surfaces 501
 *
 * Falls back to legacy flag MOCK_AI=true and AI_PROVIDER=mock for backwards compatibility.
 */

const MODE = (process.env.AI_MODE
    || (process.env.MOCK_AI === 'true' ? 'mock' : null)
    || (process.env.AI_PROVIDER === 'mock' ? 'mock' : null)
    || 'disabled').toLowerCase();

let impl;

if (MODE === 'mock') {
    impl = require('../../mocks/ai/client');
} else if (MODE === 'real') {
    throw new Error('[aiProvider] AI_MODE=real not implemented yet');
} else {
    impl = {
        MODEL_ID: 'disabled',
        suggestRestock: async () => {
            const err = new Error('AI provider disabled (set AI_MODE=mock or AI_MODE=real)');
            err.code = 501;
            throw err;
        }
    };
}

module.exports = {
    mode: MODE,
    MODEL_ID: impl.MODEL_ID,
    suggestRestock: input => impl.suggestRestock(input)
};
