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

// this is the deprecated U`foo == blah` jam-session syntax.
// function utils(...args) {
//     if (args[0] && Array.isArray(args[0]) && args[0].raw) {
//         // We're being used as a tagged template
//         return jamSession.formulaToExpression(args[0].raw[0]);
//     } else
//         throw 'Mapbox-gl-utils unexpectedly called as a function. Use .init(map)';
// }

function parseSource(source) {
    if (
        String(source).match(/\.(geo)?json/) ||
        source.type === 'Feature' ||
        source.type === 'FeatureCollection'
    ) {
        return {
            type: 'geojson',
            data: source,
        };
    } else if (String(source).match(/^mapbox:\/\//)) {
        return {
            type: 'vector',
            url: source,
        };
    } else {
        return source;
    }
}

// Magically turn a function that works on one layer into one that works on array of layers.
const arrayify = f => {
    return function (things, ...args) {
        return Array.isArray(things)
            ? things.map(t => f.bind(this)(t, ...args))
            : f.bind(this)(things, ...args);
    };
};
function upperCamelCase(s) {
    return s[0].toUpperCase() + kebabCase.reverse(s).slice(1);
}

const layerTypes = [
    'line',
    'fill',
    'circle',
    'symbol',
    'video',
    'raster',
    'fill-extrusion',
    'heatmap',
    'hillshade',
];

class Utils {
    constructor() {
        this._loaded = false;

        // return this;
    }
    static init(map, mapboxgl) {
        map.U = new Utils();
        map.U.mapboxgl = mapboxgl;
        map.U.map = map;
        return map.U;
    }

    static async newMap(mapboxgl, params = {}, options = {}) {
        function addLayers(style, layers = []) {
            style.layers = [
                ...style.layers,
                ...layers.map(l => this.layerStyle(l)),
            ];
        }
        function addSources(style, sources = {}) {
            // sources don't need any special treatment?
            style.sources = { ...style.sources, ...sources };
        }
        function transformStyle(style, transformFunc = x => x) {
            style = transformFunc(style);
        }

        function mixStyles(style, mixStyles = {}) {
            Object.keys(mixStyles).forEach(sourceId => {
                const layers = mixStyles[sourceId].layers;
                delete mixStyles[sourceId].layers;
                style.sources[sourceId] = mixStyles[sourceId];
                style.layers = [
                    ...style.layers,
                    ...layers.map(l =>
                        this.layerStyle({ source: sourceId, ...l })
                    ),
                ];
            });
            console.log(style);
        }

        if (!params.style) {
            params.style = {
                version: 8,
                layers: [],
                sources: {},
            };
        }
        if (
            options.addLayers ||
            options.addSources ||
            options.transformStyle ||
            options.mixStyles
        ) {
            let styleParam = params.style;
            let style;
            if (typeof styleParam === 'string') {
                const styleUrl = styleParam.replace(
                    /^mapbox:\/\/styles\//,
                    'https://api.mapbox.com/styles/v1/'
                );
                const response = await fetch(styleUrl);
                style = await response.json();
            } else {
                style = styleParam;
            }
            const u = new Utils();
            addLayers.call(u, style, options.addLayers);
            addSources(style, options.addSources);
            transformStyle(style, options.transformStyle);
            mixStyles.call(u, style, options.mixStyles);
            params.style = style;
        }

        const map = new mapboxgl.Map(params);
        Utils.init(map, mapboxgl);
        return map;
    }
}
Object.assign(Utils.prototype, {
    hoverPointer: arrayify(function (layer) {
        const oldCursor = this.map.getCanvas().style.cursor;
        const mouseenter = e => (this.map.getCanvas().style.cursor = 'pointer');
        const mouseleave = e => (this.map.getCanvas().style.cursor = oldCursor);

        this.map.on('mouseenter', layer, mouseenter);
        this.map.on('mouseleave', layer, mouseleave);
        return () => {
            this.map.off('mouseenter', layer, mouseenter);
            this.map.off('mouseleave', layer, mouseleave);
            mouseleave();
        };
    }),
    hoverFeatureState: arrayify(function (
        layer,
        source,
        sourceLayer,
        enterCb,
        leaveCb
    ) {
        if (Array.isArray(source)) {
            // assume we have array of [source, sourceLayer]
            let removeFuncs = source.map(([source, sourceLayer]) =>
                this.hoverFeatureState(layer, source, sourceLayer)
            );
            return () => removeFuncs.forEach(f => f());
        }
        if (source === undefined) {
            const l = this.getLayerStyle(layer);
            source = l.source;
            sourceLayer = l['source-layer'];
        }
        let featureId;
        function setHoverState(state) {
            if (featureId) {
                this.map.setFeatureState(
                    { source, sourceLayer, id: featureId },
                    { hover: state }
                );
            }
        }

        const mousemove = e => {
            const f = e.features[0];
            if (f && f.id === featureId) {
                return;
            }
            setHoverState(false);
            if (!f) return;
            if (featureId && leaveCb) {
                leaveCb({ ...e, oldFeatureId: featureId });
            }
            featureId = f.id;
            setHoverState(true);
            if (enterCb) {
                enterCb(e);
            }
        };

        const mouseleave = e => {
            setHoverState(false);
            if (e && e.oldFeatureId) {
                e.oldFeatureId = featureId;
            }
            featureId = undefined;
            if (leaveCb) {
                leaveCb(e);
            }
        };

        this.map.on('mousemove', layer, mousemove);
        this.map.on('mouseleave', layer, mouseleave);

        return () => {
            this.map.off('mousemove', layer, mousemove);
            this.map.off('mouseleave', layer, mouseleave);
            mouseleave();
        };
    }),
    hoverPopup(layers, cb, popupOptions = {}) {
        const popup = new this.mapboxgl.Popup({
            closeButton: false,
            ...popupOptions,
        });
        return arrayify((layer, cb) => {
            function mouseenter(e) {
                if (e.features[0]) {
                    popup.setLngLat(e.lngLat);
                    popup.setHTML(cb(e.features[0], popup));
                    popup.addTo(map);
                }
            }

            function mouseout(e) {
                popup.remove();
            }

            this.map.on('mouseenter', layer, mouseenter);
            this.map.on('mouseout', layer, mouseout);
            return () => {
                this.map.off('mouseenter', layer, mouseenter);
                this.map.off('mouseout', layer, mouseout);
                mouseout();
            };
        })(layers, cb);
    },
    clickPopup(layers, cb, popupOptions = {}) {
        const popup = new this.mapboxgl.Popup({
            ...popupOptions,
        });
        return arrayify((layer, cb) => {
            function click(e) {
                if (e.features[0]) {
                    popup.setLngLat(e.features[0].geometry.coordinates.slice());
                    popup.setHTML(cb(e.features[0], popup));
                    popup.addTo(map);
                }
            }
            this.map.on('click', layer, click);
            return () => {
                this.map.off('click', layer, click);
            };
        })(layers, cb);
    },
    clickLayer: arrayify(function (layer, cb) {
        const click = e => {
            e.features = this.map.queryRenderedFeatures(e.point, {
                layers: [layer],
            });
            cb(e);
        };
        this.map.on('click', layer, click);
        return () => {
            this.map.off('click', layer, click);
        };
    }),
    clickOneLayer(layers, cb, noMatchCb) {
        const click = e => {
            let match = false;

            for (const layer of layers) {
                const features = this.map.queryRenderedFeatures(e.point, {
                    layers: [layer],
                });
                if (features[0]) {
                    try {
                        cb({
                            event: e,
                            layer,
                            feature: features[0],
                            features,
                        });
                    } finally {
                        match = true;
                        break;
                    }
                }
            }

            if (!match && noMatchCb) {
                noMatchCb(e);
            }
        };
        this.map.on('click', click);
        return () => {
            this.map.off('click', click);
        };
    },
    hoverLayer: arrayify(function (layer, cb) {
        const click = e => {
            e.features = this.map.queryRenderedFeatures(e.point, {
                layers: [layer],
            });
            cb(e);
        };
        this.map.on('click', layer, click);
        return () => {
            this.map.off('click', layer, click);
        };
    }),

    mapAddLayerBefore(layer, before) {
        if (before) {
            this.map.addLayer(layer, before);
        } else {
            this.map.addLayer(layer);
        }
    },

    addLayer(id, source, type, props, before) {
        this.mapAddLayerBefore(
            this.layerStyle(id, source, type, props),
            before
        );
        return this.makeSource(source);
    },
    add(id, source, type, props, before) {
        this.mapAddLayerBefore(
            {
                id,
                source: parseSource(source),
                type,
                ...this.properties(props),
            },
            before
        );
        return this.makeSource(source); // Could get very weird if source is not a string...
    },
    removeLayer: arrayify(function (layer) {
        const swallowError = data => {
            if (!data.error.message.match(/does not exist/)) {
                console.error(data.error);
            }
        };
        this.map.once('error', swallowError);
        this.map.removeLayer(layer);
        this.map.off('error', swallowError);
    }),
    addGeoJSON(
        id,
        geojson = { type: 'FeatureCollection', features: [] },
        props
    ) {
        return this.addSource(id, {
            type: 'geojson',
            data: geojson,
            ...props,
        });
    },
    addSource(id, props) {
        this.map.addSource(id, props);
        return this.makeSource(id);
    },
    layersBySource(source) {
        return this.map
            .getStyle()
            .layers.filter(l => l.source === source)
            .map(l => l.id);
    },

    addVector(id, props) {
        if (typeof props === 'string') {
            if (props.match(/\{z\}/)) {
                return this.addSource(id, {
                    type: 'vector',
                    tiles: [props],
                });
            } else {
                // mapbox://, http://.../index.json
                return this.addSource(id, {
                    type: 'vector',
                    url: props,
                });
            }
        } else {
            return this.addSource(id, {
                type: 'vector',
                ...this.properties(props),
            });
        }
    },
    setProperty: arrayify(function (layer, prop, value) {
        if (typeof prop === 'object') {
            Object.keys(prop).forEach(k => this.setProperty(layer, k, prop[k]));
        } else {
            const kprop = kebabCase(prop);
            if (isPaintProp(kprop)) {
                this.map.setPaintProperty(layer, kprop, value);
            } else if (isLayoutProp(kprop)) {
                this.map.setLayoutProperty(layer, kprop, value);
            } else {
                // ignore properties such as minzoom, type, filter, etc for now.
            }
        }
    }),
    properties(props) {
        if (!props) {
            return undefined;
        }
        const out = {},
            which = { paint: {}, layout: {}, other: {} };
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
    },
    // layerStyle([id,] [source,] [type,] props)
    layerStyle(...args) {
        const [id, source, type] = args;
        const props = args.find(
            arg => typeof arg === 'object' && !Array.isArray(arg)
        );
        const ret = this.properties(props) || {};
        if (typeof id === 'string') ret.id = id;
        if (typeof source === 'string') ret.source = source;
        if (typeof type === 'string') ret.type = type;
        return ret;
    },
    getLayerStyle(layer) {
        return this.map.getStyle().layers.find(l => l.id === layer);
    },
    setLayerStyle: arrayify(function (layer, style) {
        const clearProps = (oldObj = {}, newObj = {}) =>
            Object.keys(oldObj).forEach(key => {
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
    }),
    setData(source, data) {
        this.map.getSource(source).setData(data);
    },
    show: arrayify(function (layer) {
        this.setVisibility(layer, 'visible');
    }),
    hide: arrayify(function (layer) {
        this.setVisibility(layer, 'none');
    }),
    toggle: arrayify(function (layer, state) {
        this.setVisibility(layer, state ? 'visible' : 'none');
    }),
    showSource: arrayify(function (source) {
        this.setVisibility(this.layersBySource(source), 'visible');
    }),
    hideSource: arrayify(function (source) {
        this.setVisibility(this.layersBySource(source), 'none');
    }),
    toggleSource: arrayify(function (source, state) {
        this.setVisibility(
            this.layersBySource(source),
            state ? 'visible' : 'none'
        );
    }),
    setFilter: arrayify(function (layer, filter) {
        this.map.setFilter(layer, filter);
    }),
    removeSource: arrayify(function (source) {
        // remove layers that use this source first
        const layers = this.layersBySource(source);
        this.removeLayer(layers);
        if (this.map.getSource(source)) {
            this.map.removeSource(source);
        }
    }),
    setLayerSource: arrayify(function (layerId, source, sourceLayer) {
        const oldLayers = this.map.getStyle().layers;
        const layerIndex = oldLayers.findIndex(l => l.id === layerId);
        const layerDef = oldLayers[layerIndex];
        const before =
            oldLayers[layerIndex + 1] && oldLayers[layerIndex + 1].id;
        layerDef.source = source;
        if (sourceLayer) {
            layerDef['source-layer'] = sourceLayer;
        } else if (sourceLayer !== undefined) {
            delete layerDef['source-layer'];
        }
        this.map.removeLayer(layerId);
        this.mapAddLayerBefore(layerDef, before);
    }),
    onLoad(cb) {
        if (this.map.loaded() || this._loaded) {
            cb();
        } else {
            this.map.once('load', () => {
                this._loaded = true;
                cb();
            });
        }
    },
    setRootProperty(propName, val) {
        const style = this.map.getStyle();
        style[kebabCase(propName)] = val;
        this.map.setStyle(style);
    },
    setTransition(val) {
        this.setRootProperty('transition', val);
    },
    loadImage(id, url, options) {
        if (typeof url === 'string' && url.match(/\.[a-z]+$/)) {
            this.map.loadImage(url, (error, image) => {
                if (error) {
                    console.error(`Error loading image ${url}`, error);
                } else {
                    this.map.addImage(id, image, options);
                }
            });
        } else {
            return this.map.addImage(id, url, options);
        }
    },
    lockOrientation() {
        this.map.touchZoomRotate.disableRotation();
        this.map.dragRotate.disable();
    },
});
/* options:
    addLayers: [{ id: ..., ... }, ...]

*/
// ok this doesn't work for now because we have to call utils.init() in order to get all function and properties
// but that requires an initialised map object...which this function is going to do.
// so we need to rewrite utils as a prototype or constructor or class or something

/*
What do I want here:
a static class that can do style manipulation etc
an instance bound to a specific map

exported: U.init() needs to work as it always did, so:
  - U is a class
  - U.init(map) is a static method that instantiates utils and binds it to map
*/

function initClass(U) {
    const makeSetProp = (prop, setPropFunc) => {
        const funcName = 'set' + upperCamelCase(prop);
        U[funcName] = arrayify(function (layer, value) {
            return this.map[setPropFunc](layer, prop, value);
        });
    };

    const makeAddLayer = (layerType, obj, fixedSource) => {
        const funcName = 'add' + upperCamelCase(layerType);
        if (fixedSource) {
            obj[funcName] = function (id, options, before) {
                return this.addLayer(
                    id,
                    fixedSource,
                    layerType,
                    options,
                    before
                );
            };
        } else {
            obj[funcName] = function (id, source, options, before) {
                return this.addLayer(id, source, layerType, options, before);
            };
        }
        obj[funcName + 'Layer'] = obj[funcName];
    };

    function makeSource(id) {
        // returns an object on which we can call .addLine() etc.
        const out = new Utils();
        out.map = this.map;
        out.mapboxgl = this.mapboxgl;
        layerTypes.forEach(function (type) {
            makeAddLayer(type, out, id);
        });
        return out;
    }

    function makeAddSource(sourceType) {
        const funcName = 'add' + upperCamelCase(sourceType);
        U[funcName] = function (id, props) {
            return this.addSource(id, {
                type: sourceType,
                ...props,
            });
        };
        U[funcName + 'Source'] = U[funcName];
    }

    U.makeSource = makeSource;
    U.update = U.setData; // deprecated
    // Turn every property into a 'setTextSize()', 'setLineColor()' etc.
    allProps.paints.forEach(prop => makeSetProp(prop, 'setPaintProperty'));
    allProps.layouts.forEach(prop => makeSetProp(prop, 'setLayoutProperty'));

    layerTypes.forEach(layerType => makeAddLayer(layerType, U));

    ['raster', 'raster-dem', 'image', 'video'] // vector, geojson taken care of
        .forEach(sourceType => makeAddSource(sourceType));
}

const U = Utils.prototype;
initClass(U);

// Hmm. Using ES2015 export seems to play nicer with Webpack. But then testing within Node doesn't work. Sigh.
// module.exports = Utils;
export default Utils;
