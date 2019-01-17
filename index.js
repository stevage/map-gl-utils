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
            url: source
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

utils.init = function(map) {
    const U = this;
    const layerTypes = ['line','fill','circle','symbol','video','raster','fill-extrusion','heatmap','hillshade'];
    function makeSetProp(prop, setPropFunc) {
        const funcName = 'set' + upperCamelCase(prop);
        U[funcName] = arrayify((layer, value) =>
            map[setPropFunc](layer, prop, value)
        );
    };

    function makeAddLayer(layerType, obj, fixedSource) {
        const funcName = 'add' + upperCamelCase(layerType);
        if (fixedSource) {
            obj[funcName] = (id, options) => U.add(id, fixedSource, layerType, options);
        } else {
            obj[funcName] = (id, source, options) => U.add(id, source, layerType, options);
        }
    }

    function makeSource(id) {
        // returns an object on which we can call .addLine() etc.
        const out = {};
        layerTypes.forEach(type => makeAddLayer(type, out, id));
        return out;
    }

    function addSource(id, props) {
        map.addSource(id, props);
        return makeSource(id);
    }

    function makeAddSource(sourceType) {
        const funcName = 'add' + upperCamelCase(sourceType);
        U[funcName] = (id, options) => {
            addSource(id, { 
                type: sourceType, 
                ...options
            });
        };
    }

    function layersBySource(source) {
        return map.getStyle().layers
            .filter(l => l.source === source)
            .map(l => l.id);
    }

    Object.assign(this, {
        hoverPointer: arrayify(layer => {
            map.on('mouseenter', layer, e => map.getCanvas().style.cursor = 'pointer' ); 
            map.on('mouseleave', layer, e => map.getCanvas().style.cursor = '' ); 
        }), clickLayer: arrayify((layer, cb) => {
            map.on('click', layer, e => {
                e.features = map.queryRenderedFeatures(e.point, {
                    layers: [layer]
                });
                cb(e);
            });
        }),
        add(id, source, type, props) {
            map.addLayer({
                id,
                source: parseSource(source),
                type,
                ...this.properties(props)
            });
            return makeSource(source); // Could get very weird if source is not a string...
        },  removeLayer: arrayify(layer => {
            const swallowError = (data => {
                if (!data.error.message.match(/does not exist/)) {
                    console.error(data.error)
                }
            });
            map.once('error', swallowError);
            map.removeLayer(layer);
            map.off('error', swallowError);
        }), addGeoJSON(id, geojson = { type: 'FeatureCollection', features: [] }, props) {
            return addSource(id, {
                type: 'geojson',
                data: geojson,
                ...props
            });
        }, addVector(id, props) {
            if (typeof props === 'string') {
                if (props.match(/\{z\}/)) {
                    return addSource(id, {
                        type: 'vector',
                        tiles: [props]
                    });
                } else {
                    // mapbox://, http://.../index.json
                    return addSource(id, {
                        type: 'vector',
                        url: props
                    });
                }
            } else {
                return addSource(id, {
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
        }, setData(source, data) {
            map.getSource(source).setData(data);
        }, show: arrayify(layer => 
            this.setVisibility(layer, 'visible')
        ), hide: arrayify(layer => 
            this.setVisibility(layer, 'none')
        ), toggle: arrayify((layer, state) =>
            this.setVisibility(layer, state ? 'visible' : 'none')
        ), showSource: arrayify(source =>
            this.setVisibility(layersBySource(source) , 'visible')
        ), hideSource: arrayify(source => 
            this.setVisibility(layersBySource(source), 'none')
        ), toggleSource: arrayify((source, state) =>
            this.setVisibility(layersBySource(source), state ? 'visible' : 'none')
        ), setFilter: arrayify((layer, filter) => 
            map.setFilter(layer, filter)
        ), removeSource: arrayify(source => {
            // remove layers that use this source first
            const layers = layersBySource(source);
            this.removeLayer(layers);
            if (map.getSource(source)) {
                map.removeSource(source);
            }
        }), onLoad(cb) {
            if (map.loaded() || this._loaded) {
                cb();
            } else {
                map.once('load', () => {
                    this._loaded = true;
                    cb();
                });
            }
        }, lockOrientation() {
            // Hmm, we can't remove the rotation control.
            map.touchZoomRotate.disable();
            map.dragRotate.disable();
        }, 
    });
    this.update = this.setData; // deprecated
    // Turn every property into a 'setTextSize()', 'setLineColor()' etc.
    allProps.paints.forEach(prop => makeSetProp(prop, 'setPaintProperty'));
    allProps.layouts.forEach(prop => makeSetProp(prop, 'setLayoutProperty'));

    layerTypes.forEach(layerType => makeAddLayer(layerType, U));

    ['raster','raster-dem','image','video'] // vector, geojson taken care of
        .forEach(sourceType => makeAddSource(sourceType));
    
    map.U = this;
    return this;
}

module.exports = utils;