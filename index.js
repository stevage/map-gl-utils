const kebabCase = require('kebab-case');
const allProps = require('./keys.json');
const jamSession = require('@mapbox/expression-jamsession');

function isPaintProp(prop) {
    return allProps.paints.indexOf(prop) >= 0;
}

function whichProp(prop) {
    if (allProps.paints.indexOf(prop) >= 0) {
        return 'paint';
    }
    if (allProps.layouts.indexOf(prop) >= 0) {
        return 'layout';
    }
    return 'other';
}

function utils(...args) {
    if (args[0] && Array.isArray(args[0]) && args[0].raw) {
        // We're being used as a tagged template
        return jamSession.formulaToExpression(args[0].raw[0]);
    } else throw 'Mapbox-gl-utils unexpectedly called as a function.'
}

function parseSource(source) {
    if (String(source).match(/\.(geo)?json/) || source.type === 'Feature' || source.type === 'FeatureCollection') {
        return {
            type: 'geojson',
            data: source
        }
    } else if (String(source).match(/^mapbox:\/\//)) {
        return {
            type: 'vector',
            data: source
        }
    } else {
        return source;
    }
}

// Magically turn a function that works on one layer into one that works on array of layers.
const arrayify = f => (things, ...args) =>
    Array.isArray(things)
        ? things.forEach(t => f(t, ...args)) 
        : f(things, ...args);


function upperCamelCase(s) {
    return s[0].toUpperCase() + kebabCase.reverse(s).slice(1);
}

utils.init = function(map, directlyIntegrate = false) {
    const U = this;
    function makeSetProp(prop, setPropFunc) {
        const funcName = 'set' + upperCamelCase(prop);
        U[funcName] = arrayify((layer, value) =>
            map[setPropFunc](layer, prop, value)
        );
    };

    function makeAddLayer(layerType) {
        const funcName = 'add' + upperCamelCase(layerType);
        U[funcName] = (id, source, options) => U.add(id, source, layerType, options);
    }

    function makeAddSource(sourceType) {
        const funcName = 'add' + upperCamelCase(sourceType);
        U[funcName] = (id, options) => map.addSource(id, { 
            type: sourceType, 
            ...options
        });
    }

    Object.assign(this, {
        hoverPointer(layers) {
            map.on('mousemove',e => {
                const f = map.queryRenderedFeatures(e.point, {
                    layers: Array.isArray(layers) ? layers : [layers]
                });
                map.getCanvas().style.cursor = f.length ? 'pointer' : '';
            }); 
        }, 
        add(id, source, type, props) {
            return map.addLayer({
                id,
                source: parseSource(source),
                type,
                ...this.properties(props)
            });
        },  addGeoJSON(id, geojson = { type: 'FeatureCollection', features: [] }) {
            return map.addSource(id, {
                type: 'geojson',
                data: geojson
            });
        }, addVector(id, props) {
            if (typeof props === 'string') {
                if (props.match(/\{z\}/)) {
                    return map.addSource(id, {
                        type: 'vector',
                        tiles: [props]
                    });
                } else {
                    // mapbox://, http://.../index.json
                    return map.addSource(id, {
                        type: 'vector',
                        url: props
                    });
                }
            } else {
                return map.addSource(id, {
                    type: 'vector',
                    ...this.properties(props)
                });
            }
        }, setProperty: arrayify((layer, prop, value) => {
            if (typeof prop === 'object') {
                Object.keys(prop).forEach(k => this.setProperty(layer, k, prop[k]));
            } else {
                const kprop = kebabCase(prop);
                const fn = isPaintProp(kprop) ? 'setPaintProperty' : 'setLayoutProperty';
                map[fn](layer, kprop , value);
            }
        }), properties(props) {
            if (!props) {
                return undefined;
            }
            const out = {}, which = { paint: {}, layout: {}, other: {} };
            Object.keys(props).forEach(prop => {
                const kprop = kebabCase(prop);
                which[whichProp(kprop)][kprop] = props[prop];
            });
            if (Object.keys(which.paint).length) {
                out.paint = which.paint;
            }
            if (Object.keys(which.layout).length) {
                out.layout = which.layout;
            }
            Object.assign(out, which.other);
            return out;
        }, update(source, data) {
            map.getSource(source).setData(data);
        }, show: arrayify(layer => 
            map.setLayoutProperty(layer, 'visibility', 'visible')
        ), hide: arrayify(layer => 
            map.setLayoutProperty(layer, 'visibility', 'none')
        ), toggle: arrayify((layer, state) =>
            map.setLayoutProperty(layer, 'visibility', state ? 'visible' : 'none')
        ), onLoad(cb) {
            if (map.loaded() || this._loaded) {
                cb();
            } else {
                map.on('load', () => {
                    this._loaded = true;
                    cb();
                });
            }
        }, lockOrientation() {
            // Hmm, we can't remove the rotation control.
            map.touchZoomRotate.disable();
            map.dragRotate.disable();
        }
    });
    // Turn every property into a 'setTextSize()', 'setLineColor()' etc.
    allProps.paints.forEach(prop => makeSetProp(prop, 'setPaintProperty'));
    allProps.layouts.forEach(prop => makeSetProp(prop, 'setLayoutProperty'));

    ['line','fill','circle','symbol','video','raster','fill-extrusion','heatmap','hillshade']
        .forEach(layerType => makeAddLayer(layerType));

    ['raster','raster-dem','image','video'] // vector, geojson taken care of
        .forEach(sourceType => makeAddSource(sourceType));

    
    map.U = this;
    if (directlyIntegrate) {
        Object.assign(map, this);
    }
    return this;
}

module.exports = utils;