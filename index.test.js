const utils = require('./index');

function mockMap() {
    return {
        setPaintProperty: jest.fn(),
        setLayoutProperty: jest.fn()
    };
}
test('Attaches itself to map object', () => {
    const map = {};
    const U = new utils(map);
    expect(map.U).toBe(U);    
});

test('Provides hoverPointer function', () => {
    const map = {};
    const U = new utils(map);
    expect(typeof U.hoverPointer).toBe('function');    
});

describe('setProp', () => {
    test('Correctly picks setPaintProperty for line-color', () => {
        const map = mockMap();
        const U = new utils(map);
        U.setProp('mylayer', 'lineColor', 'red');
        expect(map.setPaintProperty.mock.calls.length).toBe(1);
        expect(map.setPaintProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setPaintProperty.mock.calls[0][1]).toBe('line-color');
        expect(map.setPaintProperty.mock.calls[0][2]).toBe('red');
        expect(map.setLayoutProperty.mock.calls.length).toBe(0);
    });
    test('Correctly picks setLayoutProperty for icon-size', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProp('mylayer', 'icon-size', 3);
        expect(map.setPaintProperty.mock.calls.length).toBe(0);
        expect(map.setLayoutProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setLayoutProperty.mock.calls[0][1]).toBe('icon-size');
        expect(map.setLayoutProperty.mock.calls[0][2]).toBe(3);
        expect(map.setLayoutProperty.mock.calls.length).toBe(1);
    });
    test('Handles multiple properties correctly', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProp('mylayer', {
            'font-size': 12,
            'text-color': 'blue',
        });
        expect(map.setPaintProperty.mock.calls.length).toBe(1);
        expect(map.setPaintProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setPaintProperty.mock.calls[0][1]).toBe('text-color');
        expect(map.setPaintProperty.mock.calls[0][2]).toBe('blue');
        expect(map.setLayoutProperty.mock.calls.length).toBe(1);
        expect(map.setLayoutProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setLayoutProperty.mock.calls[0][1]).toBe('font-size');
        expect(map.setLayoutProperty.mock.calls[0][2]).toBe(12);
    });
    test('Supports multiple properties in camel case', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProp('mylayer', {
            fontSize: 12,
            textColor: 'blue',
        });
        expect(map.setPaintProperty.mock.calls.length).toBe(1);
        expect(map.setPaintProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setPaintProperty.mock.calls[0][1]).toBe('text-color');
        expect(map.setPaintProperty.mock.calls[0][2]).toBe('blue');
        expect(map.setLayoutProperty.mock.calls.length).toBe(1);
        expect(map.setLayoutProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setLayoutProperty.mock.calls[0][1]).toBe('font-size');
        expect(map.setLayoutProperty.mock.calls[0][2]).toBe(12);
    });
    test('Supports a single property in camel case', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProp('mylayer', 'fontSize', 12);
        expect(map.setLayoutProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setLayoutProperty.mock.calls[0][1]).toBe('font-size');
        expect(map.setLayoutProperty.mock.calls[0][2]).toBe(12);
    });
});