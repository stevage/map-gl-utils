//@flow
import allProps from './keys.js';
// import type { Source } from 'mapbox-gl/dist/mapbox-gl.js.flow';

import type { Source } from 'mapbox-gl/src/source/source';
import type { SourceSpecification } from '@mapbox/mapbox-gl-style-spec/types';
import type { GeoJSON } from '@mapbox/geojson-types';
import type { UtilsFuncs } from './utils.flow';
type PropName = string; // todo more specific?
export type LayerRef = string | Array<string> | RegExp | (({}) => boolean);

const kebabCase = s => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
const upperCamelCase = s =>
    s.replace(/(^|-)([a-z])/g, (x, y, l) => `${l.toUpperCase()}`);

function isPaintProp(prop: PropName) {
    return allProps.paints.indexOf(prop) >= 0;
}

function isLayoutProp(prop: PropName) {
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

function parseSource(source: SourceSpecification | string | GeoJSON) {
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

// turn a thing, an array of things, a regex or a filter function, into an array
const resolveArray = (things, map) => {
    if (Array.isArray(things)) {
        return things;
    } else if (things instanceof RegExp) {
        return map
            .getStyle()
            .layers.map(l => l.id)
            .filter(id => id.match(things));
    } else if (things instanceof Function) {
        return map
            .getStyle()
            .layers.filter(layer => things(layer))
            .map(l => l.id);
    } else {
        return [things];
    }
};
// Magically turn a function that works on one layer into one that works on multiple layers
// specified as: an array, a regex (on layer id), or filter function (on layer definition)
const arrayify = f => {
    return function (thingOrThings, ...args) {
        const things = resolveArray(thingOrThings, this.map);
        return things.map(t => f.call(this, t, ...args));
    };
};

// assuming each function returns an 'off' handler, returns a function that calls them all
const arrayifyAndOff = f => {
    return function (thingOrThings, ...args) {
        const things = resolveArray(thingOrThings, this.map);
        const offs = things.map(t => f.call(this, t, ...args));
        return () => offs.forEach(off => off());
    };
};

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

// $FlowFixMe[prop-missing]
class Utils implements UtilsFuncs {
    _loaded: boolean = false;
    mapboxgl = null;
    map = null;
    /** Initialises Mapbox-GL-Utils on existing map object.
     * @returns Something useful.
     */
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

    hoverPointer(layerOrLayers) {
        const layers = resolveArray(layerOrLayers, this.map);
        const mouseenter = e => (this.map.getCanvas().style.cursor = 'pointer');
        const mouseleave = e => {
            // don't de-hover if we're still over a different relevant layer
            if (
                this.map.queryRenderedFeatures(e.point, { layers }).length === 0
            ) {
                this.map.getCanvas().style.cursor = oldCursor;
            }
        };
        const oldCursor = this.map.getCanvas().style.cursor;
        for (const layer of layers) {
            this.map.on('mouseleave', layer, mouseleave);
            this.map.on('mouseenter', layer, mouseenter);
        }
        return () => {
            for (const layer of layers) {
                this.map.off('mouseenter', layer, mouseenter);
                this.map.off('mouseleave', layer, mouseleave);
            }
            this.map.getCanvas().style.cursor = oldCursor;
        };
    }
}
// FlowFixMe[prop-missing]
const UtilsExtra = {
    /**
    Applies a `hover` feature-state while hovering over a feature.
    @param layer Layer(s) to add handler to.
    @param source Source whose features will be updated.
    @param sourceLayer Source layer (if using vector source)
    */
    hoverFeatureState: arrayifyAndOff(function (
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
        return arrayifyAndOff(function (layer, cb) {
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
        }).call(this, layers, cb);
    },
    clickPopup(layers, cb, popupOptions = {}) {
        const popup = new this.mapboxgl.Popup({
            ...popupOptions,
        });
        return arrayifyAndOff(function (layer, cb) {
            function click(e) {
                if (e.features[0]) {
                    popup.setLngLat(e.features[0].geometry.coordinates.slice());
                    popup.setHTML(cb(e.features[0], popup));
                    popup.addTo(map);
                }
            }
            this.map.on('click', layer, click);
            return () => this.map.off('click', layer, click);
        }).call(this, layers, cb);
    },
    clickLayer: arrayifyAndOff(function (layer, cb) {
        const click = e => {
            e.features = this.map.queryRenderedFeatures(e.point, {
                layers: [layer],
            });
            cb(e);
        };
        this.map.on('click', layer, click);
        return () => this.map.off('click', layer, click);
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
        return () => this.map.off('click', click);
    },
    hoverLayer: arrayifyAndOff(function (layer, cb) {
        const click = e => {
            e.features = this.map.queryRenderedFeatures(e.point, {
                layers: [layer],
            });
            cb(e);
        };
        this.map.on('click', layer, click);
        return () => this.map.off('click', layer, click);
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
    // idempotent addLayer
    setLayer(id, source, type, props, before) {
        const layerDef = this.layerStyle(id, source, type, props);
        const style = this.map.getStyle();
        const layerIndex = style.layers.findIndex(l => l.id === layerDef.id);
        const beforeIndex = style.layers.findIndex(l => l.id === before);
        if (layerIndex >= 0) {
            style.layers.splice(layerIndex, 1, layerDef);
        } else if (beforeIndex >= 0) {
            style.layers.splice(beforeIndex, 0, layerDef);
        } else {
            style.layers.push(layerDef);
        }
        this.map.setStyle(style);
        return this.makeSource(source);
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
    addSource(id, sourceDef) {
        const style = this.map.getStyle();
        style.sources[id] = sourceDef;
        this.map.setStyle(style);
        return this.makeSource(id);
    },
    layersBySource(source) {
        return this.map
            .getStyle()
            .layers.filter(l => l.source === source)
            .map(l => l.id);
    },

    addVector(id, props, extraProps = {}) {
        if (typeof props === 'string') {
            if (props.match(/\{z\}/)) {
                return this.addSource(id, {
                    type: 'vector',
                    tiles: [props],
                    ...extraProps,
                });
            } else {
                // mapbox://, http://.../index.json
                return this.addSource(id, {
                    type: 'vector',
                    url: props,
                    ...extraProps,
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
    setData(source, data = { type: 'FeatureCollection', features: [] }) {
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
        if (!cb) {
            return new Promise(resolve => this.onLoad(resolve));
        } else {
            if (this.map.loaded() || this._loaded) {
                cb();
            } else {
                this.map.once('load', () => {
                    this._loaded = true;
                    cb();
                });
            }
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
        if (typeof url === 'string' /* && url.match(/\.[a-z]+$/)*/) {
            return new Promise((resolve, reject) => {
                this.map.loadImage(url, (error, image) => {
                    if (error) {
                        console.error(`Error loading image ${url}`, error);
                        reject(`Error loading image ${url}`);
                    } else {
                        this.map.addImage(id, image, options);
                        resolve(id);
                    }
                });
            });
        } else {
            return this.map.addImage(id, url, options);
        }
    },
    lockOrientation() {
        this.map.touchZoomRotate.disableRotation();
        this.map.dragRotate.disable();
    },
    fontsInUse() {
        // TODO add tests
        // TODO: find fonts burried within ['format', ... { 'text-font': ... }] expressions
        function findLiterals(expr) {
            if (Array.isArray(expr)) {
                if (expr[0] === 'literal') {
                    ///
                    fonts.push(...expr[1]);
                } else {
                    expr.forEach(findLiterals);
                }
            }
        }
        let fonts = [];
        const fontExprs = this.map
            .getStyle()
            .layers.map(l => l.layout && l.layout['text-font'])
            .filter(Boolean);
        for (const fontExpr of fontExprs) {
            // if top level expression is an array of strings, it's hopefully ['Arial', ...] and not ['get', 'font']
            if (fontExpr.stops) {
                // old-school base/stops
                // TODO verify we have got all the cases
                try {
                    fonts.push(
                        ...fontExpr.stops.flat().filter(Array.isArray).flat()
                    );
                } catch {
                    console.log("Couldn't process font expression:", fontExpr);
                }
            } else if (fontExpr.every(f => typeof f === 'string')) {
                fonts.push(...fontExpr);
            } else {
                findLiterals(fontExpr);
            }
        }
        return [...new Set(fonts)];
    },
};

Object.assign(Utils.prototype, UtilsExtra);
function initClass(U: Utils) {
    const makeSetProp = (prop: PropName, setPropFunc) => {
        const funcName = 'set' + upperCamelCase(prop);
        U[funcName] = arrayify(function (layer, value) {
            return this.map[setPropFunc](layer, prop, value);
        });
    };
    const makeGetProp = (prop: PropName, getPropFunc) => {
        const funcName = 'get' + upperCamelCase(prop);
        U[funcName] = arrayify(function (layer) {
            return this.map[getPropFunc](layer, prop);
        });
    };
    // idempotent version
    const makeAddLayer = (layerType, obj, fixedSource) => {
        let func;
        if (fixedSource) {
            func = function (id, options, before) {
                return this.setLayer(
                    id,
                    fixedSource,
                    layerType,
                    options,
                    before
                );
            };
        } else {
            func = function (id, source, options, before) {
                return this.setLayer(id, source, layerType, options, before);
            };
        }
        const upType = upperCamelCase(layerType);
        obj[`add${upType}`] = func;
        obj[`add${upType}Layer`] = func;
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
    allProps.paints.forEach(prop => makeGetProp(prop, 'getPaintProperty'));
    allProps.layouts.forEach(prop => makeGetProp(prop, 'getLayoutProperty'));

    layerTypes.forEach(layerType => makeAddLayer(layerType, U));

    ['raster', 'raster-dem', 'image', 'video'] // vector, geojson taken care of
        .forEach(sourceType => makeAddSource(sourceType));
}

const U = Utils.prototype;
initClass(U);

export default Utils;
