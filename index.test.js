const utils = require('./index');

function mockMap() {
    return {
        setPaintProperty: jest.fn(),
        setLayoutProperty: jest.fn()
    };
}
describe('Initialisation', () => {
    test('Attaches itself to map object', () => {
        const map = mockMap();
        const U = new utils(map);
        expect(map.U).toBe(U);
        expect(map.setProperty).toBe(undefined); 
    });
    test('Provides hoverPointer function', () => {
        const map = mockMap();
        const U = new utils(map);
        expect(typeof U.hoverPointer).toBe('function');    
    });
    test('Attaches methods directly to map instance if requested', () => {
        const map = mockMap();
        const U = new utils(map, true);
        expect(map.U).toBe(U);
        expect(typeof map.U.setProperty).toBe('function'); 
        expect(typeof map.setProperty).toBe('function'); 
    });
});
describe('setProperty', () => {
    test('Correctly picks setPaintProperty for line-color', () => {
        const map = mockMap();
        const U = new utils(map);
        U.setProperty('mylayer', 'lineColor', 'red');
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'line-color', 'red');
        expect(map.setLayoutProperty).not.toBeCalled();
    });
    test('Correctly picks setLayoutProperty for icon-size', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProperty('mylayer', 'icon-size', 3);
        expect(map.setPaintProperty).not.toBeCalled();
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'icon-size', 3);
    });
    test('Handles multiple properties correctly', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProperty('mylayer', {
            'font-size': 12,
            'text-color': 'blue',
        });
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'text-color', 'blue');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'font-size', 12);
    });
    test('Supports multiple properties in camel case', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProperty('mylayer', {
            fontSize: 12,
            textColor: 'blue',
        });
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'text-color', 'blue');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'font-size', 12);
    });
    test('Supports a single property in camel case', () => {
        const map = mockMap();    
        const U = new utils(map);
        U.setProperty('mylayer', 'fontSize', 12);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'font-size', 12);
    });
});