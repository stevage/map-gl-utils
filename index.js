const kebabCase = require('kebab-case');
const allProps = require('./keys.json');
const jamSession = require('@mapbox/expression-jamsession');

function isPaintProp(prop) {
    return allProps.paints.indexOf(prop) >= 0;
}

function isLayoutProp(prop) {
    return allProps.layouts.indexOf(prop) >= 0;
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
    } else throw 'Mapbox-gl-utils unexpectedly called as a function. Use .init(map)'
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
        _loaded: false,
        hoverPointer: arrayify(layer => {
            map.on('mouseenter', layer, e => map.getCanvas().style.cursor = 'pointer' ); 
            map.on('mouseleave', layer, e => map.getCanvas().style.cursor = '' ); 
        }), hoverFeatureState: arrayify((layer, source, sourceLayer) => {
            if (Array.isArray(source)) {
                // assume we have array of [source, sourceLayer]
                source.forEach(([source, sourceLayer]) => this.hoverFeatureState(layer, source, sourceLayer));
                return;
            }
            let featureId;
            function setHoverState(state) {
                if (featureId) {
                    map.setFeatureState({ source, sourceLayer, id: featureId}, { hover: state });
                }
            }
            map.on('mousemove', layer, e => {
                setHoverState(false);
                const f = e.features[0];
                if (!f) return;
                featureId = f.id;
                setHoverState(true);
            });
            map.on('mouseleave', layer, () => {
                setHoverState(false);
                featureId = undefined;
            });
        }), clickLayer: arrayify((layer, cb) => {
            map.on('click', layer, e => {
                e.features = map.queryRenderedFeatures(e.point, {
                    layers: [layer]
                });
                cb(e);
            });
        }),
        addLayer(...args) {
            map.addLayer(this.layerStyle(...args))
        },
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
                if (isPaintProp(kprop)){
                    map.setPaintProperty(layer, kprop, value);
                } else if (isLayoutProp(kprop)) {
                    map.setLayoutProperty(layer, kprop, value);
                } else {
                    // ignore properties such as minzoom, type, filter, etc for now.
                }
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
        }, layerStyle(...args) { // layerStyle([id,] [source,] [type,] props)
            const [id, source, type] = args;
            const props = args.find(arg => typeof arg === 'object' && !Array.isArray(arg));
            const ret = this.properties(props);
            if (typeof id === 'string') ret.id = id;
            if (typeof source === 'string') ret.source = source;
            if (typeof type === 'string') ret.type = type;
            return ret;
        }, 
        getLayerStyle(layer) {
            return map.getStyle().layers.find(l => l.id === layer)
        }, setLayerStyle: arrayify((layer, style) => {
            const clearProps = (oldObj = {}, newObj = {}) => 
                Object.keys(oldObj)
                    .forEach(key => {
                        if (!(key in newObj)) {
                            this.setProperty(layer, key, undefined);
                        }
                    });
            if (!style) {
                style = layer;
                layer = style.id;
            }
            const oldStyle = this.getLayerStyle(layer);
            const newStyle = this.properties(style);
            clearProps(oldStyle.paint, newStyle.paint);
            clearProps(oldStyle.layout, newStyle.layout);
            // Hmm, this gets murky, what exactly is meant to happen with non-paint, non-layout props?
            this.setProperty(layer, { ...newStyle.paint, ...newStyle.layout });
        }), setData(source, data) {
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
        }), setLayerSource: arrayify((layerId, source, sourceLayer) => {
            const oldLayers = map.getStyle().layers;
            const layerIndex = oldLayers.findIndex(l => l.id === layerId);
            const layerDef = oldLayers[layerIndex];
            const before = oldLayers[layerIndex + 1] && oldLayers[layerIndex + 1].id;
            layerDef.source = source;
            if (sourceLayer) {
                layerDef['source-layer'] = sourceLayer;
            }
            map.removeLayer(layerId);
            map.addLayer(layerDef, before);
        }), onLoad(cb) {
            if (map.loaded() || this._loaded) {
                cb();
            } else {
                map.once('load', () => {
                    this._loaded = true;
                    cb();
                });
            }
        }, setRootProperty(propName, val) {
            const style = map.getStyle();
            style[kebabCase(propName)] = val;
            map.setStyle(style);
        }, setTransition(val) {
            this.setRootProperty('transition', val);
        }, loadImage(id, url) {
            if (typeof url === 'string' && url.match(/\.[a-z]+$/)) {
                map.loadImage(url, (error, image) => {
                    if (error) {
                        console.error(`Error loading image ${url}`, error);
                    } else {
                        map.addImage(id, image);
                    }
                });
            } else {
                return map.addImage(id, url);
            }            

        }, lockOrientation() {
            map.touchZoomRotate.disableRotation();
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

// Hmm. Using ES2015 export seems to play nicer with Webpack. But then testing within Node doesn't work. Sigh.
// module.exports = utils;
export default utils;