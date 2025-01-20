import utils from './index';
const mockMap = jest.fn(params => {
    let map;
    const style = {
        cursor: '',
    };
    return (map = {
        _style: {
            layers: [],
            sources: {},
        },
        _handlers: {},
        _fire: (event, data) => {
            if (map._handlers[event]) {
                map._handlers[event](data);
            } else if (event === 'error') {
                console.error(data.error);
            }
        },
        getStyle: jest.fn(() => map._style),
        setStyle: jest.fn(style => (map._style = style)),
        setPaintProperty: jest.fn().mockName('setPaintProperty'),
        setLayoutProperty: jest.fn().mockName('setLayoutProperty'),
        getPaintProperty: jest.fn().mockName('getPaintProperty'),
        getLayoutProperty: jest.fn().mockName('getLayoutProperty'),
        setFilter: jest.fn().mockName('setFilter'),
        addLayer: jest
            .fn((layer, before) => {
                let index = map._style.layers.length;

                if (before) {
                    index = map._style.layers.findIndex(l => l.id === before);

                    if (index < 0) {
                        index = map._style.layers.length;
                    }
                }

                map._style.layers.splice(index, 0, layer);
            })
            .mockName('addLayer'),
        removeLayer: jest
            .fn(layerId => {
                if (!map._style.layers.find(l => l.id === layerId)) {
                    map._fire('error', {
                        error: {
                            message:
                                "The layer '" +
                                layerId +
                                "'hello' does not exist in the map's style and cannot be removed.",
                        },
                    });
                } else {
                    map._style.layers = map._style.layers.filter(
                        l => l.id !== layerId
                    );
                }
            })
            .mockName('removeLayer'),
        loaded: jest.fn(() => true).mockName('loaded'),
        getSource: jest.fn(id => ({
            ...map._style.sources[id],
            setData: jest.fn(),
        })),
        // .mockName('getSource'),
        addSource: jest.fn(
            (id, sourceDef) => (map._style.sources[id] = sourceDef)
        ),
        removeSource: jest.fn().mockName('removeSource'),
        once: jest.fn((event, cb) => (map._handlers[event] = cb)),
        on: jest.fn((event, cb) => (map._handlers[event] = cb)),
        off: jest.fn((event, cb) => (map._handlers[event] = undefined)),
        getCanvas: jest.fn(() => ({
            style,
        })),
    });
});
const mockMapboxgl = jest.fn(() => {
    return {
        Popup: function () {
            return {
                remove() {},
            };
        },
        Map: jest.fn((...params) => {
            return mockMap(...params);
        }),
    };
});
let map, U;
beforeEach(() => {
    map = mockMap();
    U = utils.init(map, mockMapboxgl());
});
const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [144.95, -37.8],
            },
            properties: {
                name: 'Melbourne',
            },
        },
    ],
};
describe('Initialisation', () => {
    test('Attaches itself to map object', () => {
        expect(map.U).toBeDefined();
        expect('setProperty' in map.U).toBe(true); // it's on a prototype, so...

        expect(map.setProperty).toBe(undefined);
    });
    test('Provides hoverPointer function', () => {
        expect(typeof U.hoverPointer).toBe('function');
    });
    test('Can initialise the map', async () => {
        const map = await utils.newMap(mockMapboxgl());
        expect(map).toBeDefined();
        expect(map.U).toBeDefined();
    });
    test('addLayers() on load', async () => {
        const mgl = mockMapboxgl();
        const map = await utils.newMap(
            mgl,
            {},
            {
                addLayers: [
                    {
                        id: 'box',
                        type: 'fill',
                        fillColor: 'purple',
                    },
                ],
            }
        );
        expect(mgl.Map.mock.calls[0][0]).toEqual({
            style: {
                version: 8,
                sources: {},
                layers: [
                    {
                        id: 'box',
                        type: 'fill',
                        paint: {
                            'fill-color': 'purple',
                        },
                    },
                ],
            },
        });
    });
});
describe('setProperty()', () => {
    test('Correctly picks setPaintProperty for line-color', () => {
        U.setProperty('mylayer', 'lineColor', 'red');
        expect(map.setPaintProperty).toBeCalledWith(
            'mylayer',
            'line-color',
            'red'
        );
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
        expect(map.setPaintProperty).toBeCalledWith(
            'mylayer',
            'text-color',
            'blue'
        );
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'text-size',
            12
        );
    });
    test('Supports multiple properties in camel case', () => {
        U.setProperty('mylayer', {
            textSize: 12,
            textColor: 'blue',
        });
        expect(map.setPaintProperty).toBeCalledWith(
            'mylayer',
            'text-color',
            'blue'
        );
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'text-size',
            12
        );
    });
    test('Supports a single property in camel case', () => {
        U.setProperty('mylayer', 'textSize', 12);
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'text-size',
            12
        );
    });
    test('Supports a single property on two layers in camel case', () => {
        U.setProperty(['mylayer', 'otherlayer'], 'textSize', 12);
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'text-size',
            12
        );
        expect(map.setLayoutProperty).toBeCalledWith(
            'otherlayer',
            'text-size',
            12
        );
    });
});
describe('Streamlined setFoo() for layers', () => {
    test('Supports setLineWidth', () => {
        map.U.setLineWidth('mylayer', 3);
        expect(map.setPaintProperty).toBeCalledWith('mylayer', 'line-width', 3);
    });
    test('Supports setTextSize', () => {
        map.U.setTextSize('mylayer', 14);
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'text-size',
            14
        );
    });
    test('Supports setFillExtrusionColor', () => {
        map.U.setFillExtrusionColor('mylayer', 'yellow');
        expect(map.setPaintProperty).toBeCalledWith(
            'mylayer',
            'fill-extrusion-color',
            'yellow'
        );
    });
    test('Supports multiple layers', () => {
        map.U.setTextSize(['layer1', 'layer2'], 14);
        expect(map.setLayoutProperty).toBeCalledWith('layer1', 'text-size', 14);
        expect(map.setLayoutProperty).toBeCalledWith('layer2', 'text-size', 14);
    });
    test('Supports multiple layers with regex', () => {
        map.U.addLine('cool-line', 'mysource');
        map.U.addLine('cooler-line', 'mysource');
        map.U.addLine('crap-line', 'mysource');
        map.U.setLineWidth(/cool/, 4);
        expect(map.setPaintProperty).toBeCalledWith(
            'cool-line',
            'line-width',
            4
        );
        expect(map.setPaintProperty).toBeCalledWith(
            'cooler-line',
            'line-width',
            4
        );
        expect(map.setPaintProperty).not.toBeCalledWith(
            'crap-line',
            'line-width',
            4
        );
    });
    test('Supports multiple layers with filter function', () => {
        map.U.addLine('blue-line', 'mysource', {
            lineColor: 'blue',
        });
        map.U.addLine('also-blue-line', 'mysource', {
            lineColor: 'blue',
        });
        map.U.addLine('red-line', 'mysource', {
            lineColor: 'red',
        });
        map.U.setLineWidth(layer => layer.paint['line-color'] === 'blue', 4);
        expect(map.setPaintProperty).toBeCalledWith(
            'blue-line',
            'line-width',
            4
        );
        expect(map.setPaintProperty).toBeCalledWith(
            'also-blue-line',
            'line-width',
            4
        );
        expect(map.setPaintProperty).not.toBeCalledWith(
            'red-line',
            'line-width',
            4
        );
    });
});
describe('getLineWidth() etc', () => {
    test('getLineWidth calls getPaintProperty', () => {
        map.U.getLineWidth('mylayer');
        expect(map.getPaintProperty).toBeCalledWith('mylayer', 'line-width');
    });
    test('getTextSize calls getLayoutProperty', () => {
        map.U.getTextSize('mylayer');
        expect(map.getLayoutProperty).toBeCalledWith('mylayer', 'text-size');
    });
});
describe('properties()', () => {
    test('Handles multiple mixed properties', () => {
        const style = U.properties({
            textSize: 12,
            textColor: 'blue',
        });
        expect(style.layout['text-size']).toBe(12);
        expect(style.paint['text-color']).toBe('blue');
    });
    test("Doesn't include unused paint", () => {
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
            minzoom: 11,
        });
        expect(style).toEqual({
            id: 'mylayer',
            source: 'mysource',
            type: 'line',
            paint: {
                'line-width': 3,
            },
            layout: {
                'line-cap': 'round',
            },
            minzoom: 11,
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
        map.U.add('mylayer', 'things', 'line', {
            lineWidth: 3,
        });
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
            paint: {
                'line-width': 3,
            },
        });
    });
    test('Supports non-style props', () => {
        map.U.add('mylayer', 'things', 'line', {
            lineWidth: 3,
            minzoom: 3,
        });
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            type: 'line',
            source: 'things',
            paint: {
                'line-width': 3,
            },
            minzoom: 3,
        });
    });
    test('Supports sneaky geojson by URL', () => {
        map.U.add('mylayer', 'myfile.geojson', 'line');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: {
                type: 'geojson',
                data: 'myfile.geojson',
            },
            type: 'line',
        });
    });
    test('Supports sneaky geojson inline', () => {
        const geojson = {
            type: 'FeatureCollection',
            features: [],
        };
        map.U.add('mylayer', geojson, 'line');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: {
                type: 'geojson',
                data: geojson,
            },
            type: 'line',
        });
    });
    test('Supports Mapbox source inline', () => {
        map.U.add('mylayer', 'mapbox://myuser.aoeuaoeu', 'fill-extrusion');
        expect(map.addLayer).toBeCalledWith({
            id: 'mylayer',
            source: {
                type: 'vector',
                url: 'mapbox://myuser.aoeuaoeu',
            },
            type: 'fill-extrusion',
        });
    });
    test('Plain "add" respects "before" property', () => {
        map.U.add('someotherlayer', 'things', 'line', {
            lineColor: 'blue',
        });
        map.U.add(
            'mylayer',
            'things',
            'line',
            {
                lineColor: 'green',
            },
            'someotherlayer'
        );
        expect(map.getStyle().layers[0].id).toEqual('mylayer');
    });
});
describe('addLine()', () => {
    test('Adds line type with no style props', () => {
        map.U.addLine('mylayer', 'things', {
            lineWidth: 3,
            minzoom: 3,
        });
        expect(map.getStyle().layers[0].type).toEqual('line');
    });
    test('addLine() respects "before" property', () => {
        map.U.add('someotherlayer', 'things', 'line', {
            lineColor: 'blue',
        });
        map.U.addLine(
            'mylayer',
            'things',
            {
                lineColor: 'green',
            },
            'someotherlayer'
        );
        expect(map.getStyle().layers[0].id).toEqual('mylayer');
    });
});
describe('addGeoJSON', () => {
    test('Adds a GeoJSON source by data', () => {
        map.U.addGeoJSON('mysource', geojson);
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'geojson',
            data: geojson,
        });
    });
    test('Adds a GeoJSON source by URL', () => {
        map.U.addGeoJSON('mysource', 'data/mything.geojson');
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'geojson',
            data: 'data/mything.geojson',
        });
    });
    test('Supports an undefined source', () => {
        map.U.addGeoJSON('mysource');
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [],
            },
        });
    });
});
describe('Streamlined addVector', () => {
    test('addVector({url: "mapbox://..."})', () => {
        map.U.addVector('mysource', {
            url: 'mapbox://foo.blah',
        });
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'vector',
            url: 'mapbox://foo.blah',
        });
    });
    test('addVector("mapbox://")', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah');
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'vector',
            url: 'mapbox://foo.blah',
        });
    });
    test('addVector("mapbox://", { maxzoom: 13 })', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah', {
            maxzoom: 13,
        });
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'vector',
            url: 'mapbox://foo.blah',
            maxzoom: 13,
        });
    });
    test('addVector("http://tiles.example.com/tiles/{z}/{x}/{y}.pbf")', () => {
        map.U.addVector(
            'mysource',
            'http://tiles.example.com/tiles/{z}/{x}/{y}.pbf'
        );
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'vector',
            tiles: ['http://tiles.example.com/tiles/{z}/{x}/{y}.pbf'],
        });
    });
    test('addVector("http://tiles.example.com/tiles/{z}/{x}/{y}.pbf", { maxzoom: 13 })', () => {
        map.U.addVector(
            'mysource',
            'http://tiles.example.com/tiles/{z}/{x}/{y}.pbf',
            {
                maxzoom: 13,
            }
        );
        expect(map.getStyle().sources['mysource']).toEqual({
            type: 'vector',
            tiles: ['http://tiles.example.com/tiles/{z}/{x}/{y}.pbf'],
            maxzoom: 13,
        });
    });
});
describe('Adding layers to a source', () => {
    test('addVector().addLine(...)', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah').addLine('foo-line', {
            sourceLayer: 'mylines',
            lineColor: 'blue',
        });
        expect(map.U.getLayerStyle('foo-line')).toEqual({
            id: 'foo-line',
            source: 'mysource',
            'source-layer': 'mylines',
            paint: {
                'line-color': 'blue',
            },
            type: 'line',
        });
    });
    test('addVector().addLine(...).addLine()', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah')
            .addLine('foo-line', {
                sourceLayer: 'mylines',
                lineColor: 'blue',
            })
            .addLine('foo-line2', {
                sourceLayer: 'mylines',
                lineColor: 'red',
            });
        expect(map.getStyle().layers.length).toEqual(2);
    });
});
describe('setData()', () => {
    test('Calls setData with correct source', () => {
        map.U.setData('mysource', geojson);
        expect(map.getSource).toBeCalledWith('mysource');
        const source = map.getSource.mock.results[0].value;
        expect(source.setData).toBeCalledWith(geojson);
    });
});
describe('setFilter()', () => {
    test('Calls setFilter twice when given two layers', () => {
        map.U.setFilter(['mylayer1', 'mylayer2'], ['==', 'id', 13]);
        expect(map.setFilter).toBeCalledTimes(2);
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
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'visibility',
            'visible'
        );
    });
    test('Show two layers', () => {
        map.U.show(['layer1', 'layer2']);
        expect(map.setLayoutProperty).toBeCalledWith(
            'layer1',
            'visibility',
            'visible'
        );
        expect(map.setLayoutProperty).toBeCalledWith(
            'layer1',
            'visibility',
            'visible'
        );
    });
    test('Hide a layer', () => {
        map.U.hide('mylayer');
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'visibility',
            'none'
        );
    });
    test('Toggle a layer on', () => {
        map.U.toggle('mylayer', true);
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'visibility',
            'visible'
        );
    });
    test('Toggle two layers on', () => {
        map.U.toggle(['mylayer', 'otherlayer'], true);
        expect(map.setLayoutProperty).toBeCalledWith(
            'mylayer',
            'visibility',
            'visible'
        );
        expect(map.setLayoutProperty).toBeCalledWith(
            'otherlayer',
            'visibility',
            'visible'
        );
    });
});
describe('removeLayer()', () => {
    test('Removes a layer. ', () => {
        map.addLayer({
            id: 'mylayer',
        });
        map.U.removeLayer(['mylayer']);
        expect(map.removeLayer).toBeCalledWith('mylayer');
        expect(map.getStyle().layers.length).toBe(0);
    });
    test("Regular removeLayer() throws error when layer doesn't exist, ", () => {
        // this is just testing that our mocking works.
        console.error = jest.fn();
        map.removeLayer('mylayer');
        expect(map.removeLayer).toBeCalledWith('mylayer');
        expect(map.getStyle().layers.length).toBe(0);
        expect(console.error).toBeCalled();
    });
    test("Throws no errors when layer doesn't exist, ", () => {
        console.error = jest.fn();
        map.U.removeLayer(['mylayer']);
        expect(map.removeLayer).toBeCalledWith('mylayer');
        expect(map.getStyle().layers.length).toBe(0);
        expect(console.error).not.toBeCalled();
    });
    test('Removes multiple layers. ', () => {
        map.addLayer({
            id: 'mylayer',
        });
        map.addLayer({
            id: 'mylayer2',
        });
        map.addLayer({
            id: 'mylayer3',
        });
        map.U.removeLayer(['mylayer', 'mylayer2']);
        expect(map.removeLayer).toBeCalledWith('mylayer');
        expect(map.removeLayer).toBeCalledWith('mylayer2');
        expect(map.getStyle().layers.length).toBe(1);
    });
    test('Removes multiple layers with regex. ', () => {
        map.addLayer({
            id: 'mylayer',
        });
        map.addLayer({
            id: 'mylayer2',
        });
        map.addLayer({
            id: 'someotherlayer3',
        });
        map.U.removeLayer(/mylayer/);
        expect(map.getStyle().layers.length).toBe(1);
        expect(map.removeLayer).toBeCalledWith('mylayer');
        expect(map.removeLayer).toBeCalledWith('mylayer2');
    });
});
describe('hideSource(), showSource(), toggleSource()', () => {
    test('Hides layers attached to a source.', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah');
        map.U.addLine('line1', 'mysource');
        map.U.addFill('fill1', 'mysource');
        map.U.hideSource('mysource');
        expect(map.setLayoutProperty.mock.calls[0]).toEqual([
            'line1',
            'visibility',
            'none',
        ]);
        expect(map.setLayoutProperty.mock.calls[1]).toEqual([
            'fill1',
            'visibility',
            'none',
        ]); // expect(map.setLayoutProperty).toBeCalledWith('fill1', 'visibility', 'none');
    });
    test('Shows layers attached to a source.', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah');
        map.U.addLine('line1', 'mysource');
        map.U.addFill('fill1', 'mysource');
        map.U.showSource('mysource');
        expect(map.setLayoutProperty.mock.calls[0]).toEqual([
            'line1',
            'visibility',
            'visible',
        ]);
        expect(map.setLayoutProperty.mock.calls[1]).toEqual([
            'fill1',
            'visibility',
            'visible',
        ]); // expect(map.setLayoutProperty).toBeCalledWith('fill1', 'visibility', 'none');
    });
    test('Toggles layers attached to a source.', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah');
        map.U.addLine('line1', 'mysource');
        map.U.addFill('fill1', 'mysource');
        map.U.toggleSource('mysource', true);
        map.U.toggleSource('mysource', false);
        expect(map.setLayoutProperty.mock.calls[0]).toEqual([
            'line1',
            'visibility',
            'visible',
        ]);
        expect(map.setLayoutProperty.mock.calls[1]).toEqual([
            'fill1',
            'visibility',
            'visible',
        ]);
        expect(map.setLayoutProperty.mock.calls[2]).toEqual([
            'line1',
            'visibility',
            'none',
        ]); // expect(map.setLayoutProperty).toBeCalledWith('fill1', 'visibility', 'none');
    });
});
describe('removeSource', () => {
    test('Removes all layers attached to a source.', () => {
        map.U.addVector('mysource', 'mapbox://foo.blah');
        map.U.addLine('line1', 'mysource');
        map.U.addFill('fill1', 'mysource');
        map.U.removeSource('mysource');
        expect(map.removeLayer.mock.calls[0]).toEqual(['line1']);
        expect(map.removeLayer.mock.calls[1]).toEqual(['fill1']);
        expect(map.removeSource.mock.calls[0]).toEqual(['mysource']);
    });
});
describe('getLayerStyle()', () => {
    test('Works', () => {
        map.U.addLine('myline', 'mysource', {
            lineWidth: 3,
        });
        expect(map.U.getLayerStyle('myline')).toEqual({
            type: 'line',
            id: 'myline',
            source: 'mysource',
            paint: {
                'line-width': 3,
            },
        });
    });
});
describe('layerStyle()', () => {
    const output = {
        id: 'mylayer',
        source: 'mysource',
        type: 'line',
        paint: {
            'line-width': 3,
        },
    };
    test('Works with id, source, type, props', () => {
        expect(
            map.U.layerStyle('mylayer', 'mysource', 'line', {
                lineWidth: 3,
            })
        ).toEqual(output);
    });
    test('Works with id, source, props', () => {
        expect(
            map.U.layerStyle('mylayer', 'mysource', {
                type: 'line',
                lineWidth: 3,
            })
        ).toEqual(output);
    });
    test('Works with id, props', () => {
        expect(
            map.U.layerStyle('mylayer', {
                source: 'mysource',
                type: 'line',
                lineWidth: 3,
            })
        ).toEqual(output);
    });
    test('Works with props', () => {
        expect(
            map.U.layerStyle({
                id: 'mylayer',
                source: 'mysource',
                type: 'line',
                lineWidth: 3,
            })
        ).toEqual(output);
    });
});
describe('addLayer()', () => {
    const output = {
        id: 'mylayer',
        source: 'mysource',
        type: 'line',
        paint: {
            'line-width': 3,
        },
    };
    test('Works with id, source, type, props', () => {
        map.U.addLayer('mylayer', 'mysource', 'line', {
            lineWidth: 3,
        });
        expect(map.addLayer).toBeCalledWith(output);
    });
    test('Works with id, source, props', () => {
        map.U.addLayer('mylayer', 'mysource', {
            type: 'line',
            lineWidth: 3,
        });
        expect(map.addLayer).toBeCalledWith(output);
    });
    test('Works with id, props', () => {
        map.U.addLayer('mylayer', {
            source: 'mysource',
            type: 'line',
            lineWidth: 3,
        });
        expect(map.addLayer).toBeCalledWith(output);
    });
    test('Works with props', () => {
        map.U.addLayer({
            id: 'mylayer',
            source: 'mysource',
            type: 'line',
            lineWidth: 3,
        });
        expect(map.addLayer).toBeCalledWith(output);
    });
});
describe('setLayerStyle()', () => {
    test('Clears unused properties first', () => {
        map.U.addLine('myline', 'mysource', {
            lineWidth: 5,
            lineColor: 'red',
        });
        map.U.setLayerStyle('myline', {
            lineWidth: 3,
            lineDasharray: [4, 4],
        });
        expect(map.setPaintProperty).toBeCalledWith('myline', 'line-width', 3);
        expect(map.setPaintProperty).toBeCalledWith(
            'myline',
            'line-dasharray',
            [4, 4]
        );
        expect(map.setPaintProperty).toBeCalledWith(
            'myline',
            'line-color',
            undefined
        );
    });
    test('Supports id passed in layer', () => {
        map.U.addLine('myline', 'mysource', {
            lineWidth: 5,
            lineColor: 'red',
        });
        map.U.setLayerStyle({
            id: 'myline',
            lineWidth: 3,
        });
        expect(map.setPaintProperty).toBeCalledWith('myline', 'line-width', 3);
    });
});
describe('setLayerSource()', () => {
    test('Works on first layer', () => {
        map.U.addLine('line1', 'mysource', {
            sourceLayer: 'old',
            lineWidth: 5,
        });
        map.U.addLine('line2', 'mysource', {
            lineWidth: 5,
        });
        map.U.setLayerSource('line1', 'newsource', 'new');
        expect(map.getStyle().layers[0].source).toEqual('newsource');
        expect(map.getStyle().layers[0]['source-layer']).toEqual('new');
        expect(map.getStyle().layers.length).toEqual(2);
    });
    test('Works on last layer', () => {
        map.U.addLine('line1', 'mysource', {
            lineWidth: 5,
        });
        map.U.addLine('line2', 'mysource', {
            lineWidth: 5,
        });
        map.U.setLayerSource('line2', 'newsource');
        expect(map.getStyle().layers[1].source).toEqual('newsource');
        expect(map.getStyle().layers.length).toEqual(2);
    });
});
describe("Rasters aren't ambiguous", () => {
    test('Adding raster source', () => {
        map.U.addRasterSource('myrastersource', {
            type: 'raster',
            url: 'mapbox://mapbox.satellite',
            tileSize: 256,
        });
        expect(map.getSource('myrastersource')).toEqual(
            expect.objectContaining({
                type: 'raster',
                url: 'mapbox://mapbox.satellite',
                tileSize: 256,
            })
        );
    });
    test('Adds a Raster layer', () => {
        map.U.addRasterLayer('myrasterlayer', 'myrastersource', {
            rasterSaturation: 0.5,
        });
        expect(map.U.getLayerStyle('myrasterlayer')).toEqual(
            expect.objectContaining({
                id: 'myrasterlayer',
                source: 'myrastersource',
                type: 'raster',
                paint: {
                    'raster-saturation': 0.5,
                },
            })
        );
    });
});
describe('Hook functions return "remove" handlers', () => {
    test('clickOneLayer', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        const remove = map.U.clickOneLayer('layer', console.log);
        expect(map._handlers.click).toBeDefined();
        remove();
        expect(map._handlers.click).not.toBeDefined();
    });
    test('hoverPointer', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        const remove = map.U.hoverPointer('layer');
        console.log(map._handlers.mouseenter);
        expect(map._handlers.mouseenter).toBeDefined();
        expect(map._handlers.mouseleave).toBeDefined();
        remove();
        expect(map._handlers.mouseenter).not.toBeDefined();
        expect(map._handlers.mouseleave).not.toBeDefined();
    });
    test('hoverFeatureState', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        const remove = map.U.hoverFeatureState('layer');
        expect(map._handlers.mousemove).toBeDefined();
        expect(map._handlers.mouseleave).toBeDefined();
        remove();
        expect(map._handlers.mousemove).not.toBeDefined();
        expect(map._handlers.mouseleave).not.toBeDefined();
    });
    test('hoverFeatureState with two sources', () => {
        map.U.addGeoJSON('source1');
        map.U.addGeoJSON('source2');
        map.U.addLine('layer1', 'source1', {
            sourceLayer: 'sourceLayer1',
        });
        map.U.addLine('layer2', 'source2', {
            sourceLayer: 'sourceLayer2',
        });
        const remove = map.U.hoverFeatureState('layer1', [
            ['source1', 'sourceLayer1'],
            ['source2', 'sourceLayer2'],
        ]);
        expect(map.on).toHaveBeenCalledTimes(4);
        remove();
        expect(map._handlers.mousemove).not.toBeDefined();
        expect(map._handlers.mouseleave).not.toBeDefined();
    });
    test('hoverPopup', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        const remove = map.U.hoverPopup('layer', f => f.properties.name);
        expect(map._handlers.mouseenter).toBeDefined();
        expect(map._handlers.mouseout).toBeDefined();
        remove();
        expect(map._handlers.mouseenter).not.toBeDefined();
        expect(map._handlers.mouseout).not.toBeDefined();
    });
    test('hoverPopup with two layers', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        map.U.addLine('layer2', 'source');
        const remove = map.U.hoverPopup(
            ['layer', 'layer2'],
            f => f.properties.name
        );
        expect(map._handlers.mouseenter).toBeDefined();
        expect(map._handlers.mouseout).toBeDefined();
        remove();
        expect(map._handlers.mouseenter).not.toBeDefined();
        expect(map._handlers.mouseout).not.toBeDefined();
        expect(map.on).toHaveBeenCalledTimes(4);
        expect(map.off).toHaveBeenCalledTimes(4);
    });
    test('clickPopup', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        const remove = map.U.clickPopup('layer', f => f.properties.name);
        expect(map._handlers.click).toBeDefined();
        remove();
        expect(map._handlers.click).not.toBeDefined();
    });
    test('clickPopup with regex', () => {
        map.U.addGeoJSON('source');
        map.U.addLine('layer', 'source');
        map.U.addLine('anotherlayer', 'source');
        map.U.addLine('onemorelayer', 'source');
        const remove = map.U.clickPopup(/layer/, f => f.properties.name);
        expect(map._handlers.click).toBeDefined();
        remove();
        expect(map._handlers.click).not.toBeDefined();
        expect(map.on).toHaveBeenCalledTimes(3);
        expect(map.off).toHaveBeenCalledTimes(3);
    });
});
describe('setRootProperty()', () => {
    test('Can set sprite property', () => {
        map.U.setRootProperty('sprite', 'http://example.com/sprite');
        expect(map.getStyle().sprite).toEqual('http://example.com/sprite');
    });
});
describe('zoom()', () => {
    test('Makes a zoom expression with object', () => {
        const e = utils.zoom({
            18: 0,
            19: 1,
        });
        expect(e).toEqual(['interpolate', ['linear'], ['zoom'], 18, 0, 19, 1]);
    });
    test('Makes a zoom expression with array', () => {
        const e = utils.zoom([18, 0, 19, 1]);
        expect(e).toEqual(['interpolate', ['linear'], ['zoom'], 18, 0, 19, 1]);
    });
    test('Makes a zoom expression with numbers', () => {
        const e = utils.zoom(18, 0, 19, 1);
        expect(e).toEqual(['interpolate', ['linear'], ['zoom'], 18, 0, 19, 1]);
    });
});
describe('interpolate()', () => {
    test('Makes an interpolate function with a string property', () => {
        const e = utils.interpolate('size', {
            2: 15,
            4: 30,
        });
        expect(e).toEqual([
            'interpolate',
            ['linear'],
            ['get', 'size'],
            2,
            15,
            4,
            30,
        ]);
    });
    test('Makes an interpolate function with an expression', () => {
        const e = utils.interpolate(['get', 'size'], {
            2: 15,
            4: 30,
        });
        expect(e).toEqual([
            'interpolate',
            ['linear'],
            ['get', 'size'],
            2,
            15,
            4,
            30,
        ]);
    });
    test('Makes an interpolate function with an expression and numbers', () => {
        const e = utils.interpolate(['get', 'size'], 2, 15, 4, 30);
        expect(e).toEqual([
            'interpolate',
            ['linear'],
            ['get', 'size'],
            2,
            15,
            4,
            30,
        ]);
    });
});
describe('match()', () => {
    test('Makes a match expression with "default" case', () => {
        expect(
            utils.match('size', {
                small: 12,
                medium: 18,
                default: 24,
            })
        ).toEqual(['match', ['get', 'size'], 'small', 12, 'medium', 18, 24]);
    });
    test('Makes a match expression with fallback argument', () => {
        expect(
            utils.match(
                'size',
                {
                    small: 12,
                    medium: 18,
                },
                24
            )
        ).toEqual(['match', ['get', 'size'], 'small', 12, 'medium', 18, 24]);
    });
});
