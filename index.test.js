const utils = require('./index');
function mockMap() {
    return {
        setPaintProperty: jest.fn().mockName('setPaintProperty'),
        setLayoutProperty: jest.fn().mockName('setLayoutProperty'),
        addLayer: jest.fn().mockName('addLayer'),
        loaded: jest.fn(() => true).mockName('loaded'),
        getSource: jest.fn(() => ({
            setData: jest.fn()
        })).mockName('getSource'), 
        addSource: jest.fn().mockName('addSource')
    };
}

let map, U;
beforeEach(() => {
    map = mockMap();
    U = utils.init(map);
});

const geojson = { type: 'FeatureCollection', features: [] };

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
        const U = utils.init(map, true);
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
    test('Supports a single property on two layers in camel case', () => {
        U.setProperty(['mylayer', 'otherlayer'], 'textSize', 12);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'text-size', 12);
        expect(map.setLayoutProperty).toBeCalledWith('otherlayer', 'text-size', 12);
    });
});

describe('Streamlined setFoo() for layers', () => {
    test('Supports setLineWidth', () => {
        map.U.setLineWidth('mylayer', 3);
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'line-width', 3);
    });
    test('Supports setTextSize', () => {
        map.U.setTextSize('mylayer', 14);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'text-size', 14);
    });
    test('Supports setFillExtrusionColor', () => {
        map.U.setFillExtrusionColor('mylayer', 'yellow');
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'fill-extrusion-color', 'yellow');
    });
    test('Supports multiple layers', () => {
        map.U.setTextSize(['layer1', 'layer2'], 14);
        expect(map.setLayoutProperty).toBeCalledWith('layer1', 'text-size', 14);
        expect(map.setLayoutProperty).toBeCalledWith('layer2', 'text-size', 14);
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

    test('Supports sneaky geojson by URL', () => {
        map.U.add('mylayer', 'myfile.geojson', 'line');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: { type: 'geojson', data: 'myfile.geojson' },
            type: 'line'
        });
    });
    test('Supports sneaky geojson inline', () => {
        const geojson = {
            type: 'FeatureCollection',
            features: [
            ]
        };
        map.U.add('mylayer', geojson, 'line');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: { type: 'geojson', data: geojson },
            type: 'line'
        });
    });
    test('Supports mapbox source inline', () => {
        map.U.add('mylayer', 'mapbox://myuser.aoeuaoeu', 'fill-extrusion');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: { type: 'vector', data: 'mapbox://myuser.aoeuaoeu' },
            type: 'fill-extrusion'
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

describe('addGeoJSON', () => {
    test('Adds a GeoJSON source', () => {
        map.U.addGeoJSON('mysource', geojson);
        expect(map.addSource).toBeCalledWith(
            'mysource', {
                type: 'geojson',
                data: geojson
            });
    });
    test('Supports an undefined source', () => {
        map.U.addGeoJSON('mysource');
        expect(map.addSource).toBeCalledWith(
            'mysource', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
    });
});

describe('Streamlined addVector', () => {
    test('addVector({url: "mapbox://..."})', () => {
        map.U.addVector('mysource', { url: 'mapbox://foo.blah' });
        expect(map.addSource).toBeCalledWith(
            'mysource', {
                type: 'vector',
                url: 'mapbox://foo.blah'
            });
    });
    test('addVector("mapbox://")', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah' );
        expect(map.addSource).toBeCalledWith(
            'mysource', {
                type: 'vector',
                url: 'mapbox://foo.blah'
            });
    });
    test('addVector("http://tiles.example.com/tiles/{z}/{x}/{y}.pbf")', () => {
        map.U.addVector('mysource', 'http://tiles.example.com/tiles/{z}/{x}/{y}.pbf' );
        expect(map.addSource).toBeCalledWith(
            'mysource', {
                type: 'vector',
                tiles: ['http://tiles.example.com/tiles/{z}/{x}/{y}.pbf']
            });
    });
});


describe('update()', () => {
    test('Calls setData with correct source', () => {
        map.U.update('mysource', geojson);
        expect(map.getSource).toBeCalledWith('mysource')
        const source = map.getSource.mock.results[0].value;
        expect(source.setData).toBeCalledWith(geojson);
    });
});



describe('onLoad()', () => {
    test('Fires immediately if needed', () => {
        const cb = jest.fn();
        map.U.onLoad(cb);
        expect(cb).toBeCalled();
    });
});

describe('show(), hide(), toggle()', () => {
    test('Show a layer', () => {
        map.U.show('mylayer');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'visibility', 'visible');
    });
    test('Show two layers', () => {
        map.U.show(['layer1','layer2']);
        expect(map.setLayoutProperty).toBeCalledWith('layer1', 'visibility', 'visible');
        expect(map.setLayoutProperty).toBeCalledWith('layer1', 'visibility', 'visible');
    });
    test('Hide a layer', () => {
        map.U.hide('mylayer');
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'visibility', 'none');
    });
    test('Toggle a layer on', () => {
        map.U.toggle('mylayer', true);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'visibility', 'visible');
    });
    test('Toggle two layers on', () => {
        map.U.toggle(['mylayer','otherlayer'], true);
        expect(map.setLayoutProperty).toBeCalledWith('mylayer', 'visibility', 'visible');
        expect(map.setLayoutProperty).toBeCalledWith('otherlayer', 'visibility', 'visible');
    });
});

describe('Jam Session expressions', () => {
    test('Detects and parses a Jam Session string', () => {
        expect(U`2 + 2`).toEqual(['+', 2, 2]);
    });
    test('Supports Jam Session in a layer definition', () => {
        map.U.addLine('myline', 'mysource', {
            lineWidth: U`get("width") + 3`
        });
        expect(map.addLayer).toBeCalledWith({
            id: 'myline',
            source: 'mysource',
            type: 'line',
            paint: {
                'line-width': ['+', ['get', 'width'], 3]
            }
        });
    });
});