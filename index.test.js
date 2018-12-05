const utils = require('./index');

function mockMap() {
    return {
        setPaintProperty: jest.fn(),
        setLayoutProperty: jest.fn(),
        addLayer: jest.fn()
    };
}

let map, U;
beforeEach(() => {
    map = mockMap();
    U = new utils(map);
});


describe('Initialisation', () => {
    test('Attaches itself to map object', () => {
        expect(map.U).toBe(U);
        expect(map.setProperty).toBe(undefined); 
    });
    test('Provides hoverPointer function', () => {
        expect(typeof U.hoverPointer).toBe('function');    
    });
    test('Attaches methods directly to map instance if requested', () => {
        // shadowing global map/U
        const map = mockMap();
        const U = new utils(map, true);
        expect(map.U).toBe(U);
        expect(typeof map.U.setProperty).toBe('function'); 
        expect(typeof map.setPaintProperty).toBe('function'); 

        expect(typeof map.setProperty).toBe('function'); 

    });
});
describe('setProperty()', () => {
    test('Correctly picks setPaintProperty for line-color', () => {
        U.setProperty('mylayer', 'lineColor', 'red');
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'line-color', 'red');
        expect(map.setLayoutProperty).not.toBeCalled();
    });
    test('Correctly picks setLayoutProperty for icon-size', () => {
        U.setProperty('mylayer', 'icon-size', 3);
        expect(map.setPaintProperty).not.toBeCalled();
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'icon-size', 3);
    });
    test('Handles multiple properties correctly', () => {
        U.setProperty('mylayer', {
            'text-size': 12,
            'text-color': 'blue',
        });
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'text-color', 'blue');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'text-size', 12);
    });
    test('Supports multiple properties in camel case', () => {
        U.setProperty('mylayer', {
            textSize: 12,
            textColor: 'blue',
        });
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'text-color', 'blue');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'text-size', 12);
    });
    test('Supports a single property in camel case', () => {
        U.setProperty('mylayer', 'textSize', 12);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'text-size', 12);
    });
});

describe('properties()', () => {
    test('Handles multiple mixed properties', () => {
        const style = U.properties({
            textSize: 12,
            textColor: 'blue'
        });
        expect(style.layout['text-size']).toBe(12);
        expect(style.paint['text-color']).toBe('blue');
    });
    test('Doesn\'t include unused paint', () => {
        const style = U.properties({
            textSize: 12,
        });
        expect(style.layout['text-size']).toBe(12);
        expect('paint' in style).toBe(false);
    });
    test('Support mixing everything', () => {
        const style = U.properties({
            id: 'mylayer',
            source: 'mysource',
            type: 'line',
            lineWidth: 3,
            lineCap: 'round',
            minzoom: 11
        });
        expect(style).toEqual({
            id: 'mylayer',
            source: 'mysource',
            type: 'line',
            paint: {
                'line-width': 3,
            }, layout: {
                'line-cap': 'round'
            },
            minzoom: 11
        });
    });
});

describe('add()', () => {
    test('Adds line type with no style props', () => {
        map.U.add('mylayer', 'things', 'line');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
        });
    });
    test('Supports paint prop', () => {
        map.U.add('mylayer', 'things', 'line', { lineWidth: 3 });
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
            paint: {
                'line-width': 3
            }
        });
    });
    test('Supports non-style props', () => {
        map.U.add('mylayer', 'things', 'line', { lineWidth: 3, minzoom: 3 });
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
            paint: {
                'line-width': 3
            }, minzoom: 3
        });
    });
});

describe('addLine()', () => {
    test('Adds line type with no style props', () => {
        map.U.addLine('mylayer', 'things', { lineWidth: 3, minzoom: 3 });
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
            paint: {
                'line-width': 3
            }, minzoom: 3
        });
    });
});
