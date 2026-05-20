const path = require('path');
const { requireUI5 } = require('./helpers/ui5-loader');

describe('CriticalityFormatter', () => {
    let formatter;

    beforeAll(() => {
        formatter = requireUI5(
            path.join(__dirname, '..', 'app', 'products', 'webapp', 'ext', 'formatter', 'CriticalityFormatter.js')
        );
    });

    describe('criticalityState', () => {
        test('returns Error for criticality 1', () => {
            expect(formatter.criticalityState(1)).toBe('Error');
        });

        test('returns Warning for criticality 2', () => {
            expect(formatter.criticalityState(2)).toBe('Warning');
        });

        test('returns Success for criticality 3', () => {
            expect(formatter.criticalityState(3)).toBe('Success');
        });

        test('returns None for unknown values', () => {
            expect(formatter.criticalityState(0)).toBe('None');
            expect(formatter.criticalityState(undefined)).toBe('None');
            expect(formatter.criticalityState(99)).toBe('None');
        });
    });

    describe('criticalityText', () => {
        const bundle = {
            getText: key => `tr(${key})`
        };

        test('returns translated label via bundle', () => {
            expect(formatter.criticalityText(1, bundle)).toBe('tr(criticality.critical)');
            expect(formatter.criticalityText(2, bundle)).toBe('tr(criticality.low)');
            expect(formatter.criticalityText(3, bundle)).toBe('tr(criticality.ok)');
        });

        test('returns unknown key for unrecognized criticality', () => {
            expect(formatter.criticalityText(42, bundle)).toBe('tr(criticality.unknown)');
        });

        test('falls back to raw key when bundle missing', () => {
            expect(formatter.criticalityText(1)).toBe('criticality.critical');
            expect(formatter.criticalityText(99, null)).toBe('criticality.unknown');
        });
    });
});
