const utils = require('./index');
test('Attaches to map object', () => {
    const map = {};
    const U = new utils(map);
    expect(map.U).toBe(U);    
});

test('Provides a function', () => {
    const map = {};
    const U = new utils(map);
    expect(typeof U.hoverPointer).toBe('function');    
});

describe('Setprop works', () => {
    test('SetPaintProperty', () => {
        const map = {
            setPaintProperty: jest.fn(x => x),
            setLayoutProperty: jest.fn(x => x)
        };
        const U = new utils(map);
        U.setProp('mylayer', 'lineColor', 'red');
        expect(map.setPaintProperty.mock.calls.length).toBe(1);
        expect(map.setPaintProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setPaintProperty.mock.calls[0][1]).toBe('line-color');
        expect(map.setPaintProperty.mock.calls[0][2]).toBe('red');
        expect(map.setLayoutProperty.mock.calls.length).toBe(0);
    });
    test('SetLayoutProperty', () => {
        const map = {
            setPaintProperty: jest.fn(x => x),
            setLayoutProperty: jest.fn(x => x)
        };
    
        const U = new utils(map);
        U.setProp('mylayer', 'icon-size', 3);
        expect(map.setPaintProperty.mock.calls.length).toBe(0);
        expect(map.setLayoutProperty.mock.calls[0][0]).toBe('mylayer');
        expect(map.setLayoutProperty.mock.calls[0][1]).toBe('icon-size');
        expect(map.setLayoutProperty.mock.calls[0][2]).toBe(3);
        expect(map.setLayoutProperty.mock.calls.length).toBe(1);
    });
});