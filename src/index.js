//@flow
import allProps from './keys.js';
import type { Source } from 'mapbox-gl/src/source/source';
import type {
    StyleSpecification,
    SourceSpecification,
    GeoJSONSourceSpecification,
    LayerSpecification,
    FilterSpecification,
    TransitionSpecification,
    RasterSourceSpecification,
    RasterDEMSourceSpecification,
    ImageSourceSpecification,
    VideoSourceSpecification,
} from '@mapbox/mapbox-gl-style-spec/types';
import type { GeoJSON } from '@mapbox/geojson-types';
import type { StyleImageMetadata } from 'mapbox-gl/src/style/style_image';
import type MapboxGl from 'mapbox-gl/src';
import type Map from 'mapbox-gl/src/ui/map';
import type Popup, { PopupOptions } from 'mapbox-gl/src/ui/popup';
type UtilsMap = MapboxGl.Map & { U: ?Utils };
type MapboxGlLib = {
    Map: Class<Map>,
    Popup: Class<Popup>,
    ...
};
import type { UtilsFuncs } from './utilsGenerated.flow';
type PropName = string; // todo more specific?
// not currently used - weird, makeSource is really returning something slightly different from normal MapGlUtils
// export type UtilsSource = {
//     map: UtilsMap,
//     mapboxgl: Class<MapboxGl>,
//     // todo add the layer type functions
// };
type SourceBoundUtils = MapGlUtils;

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
type SourceOrData = SourceSpecification | string | GeoJSON;
function parseSource(source: SourceOrData) {
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

export type LayerRef =
    | string
    | Array<string>
    | RegExp
    | (LayerSpecification => boolean);
type SourceRef = LayerRef;
type PropValue = string | Array<any> | null | number | { ... }; // so basically any

// turn a thing, an array of things, a regex or a filter function, into an array
const resolveArray = (things: LayerRef, map: MapboxGl.Map): Array<any> => {
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

const arrayifyMap = (
    f: (string, ...args: Array<any>) => any
): ((LayerRef, ...args: Array<any>) => Array<any>) => {
    return function (thingOrThings, ...args) {
        const things = resolveArray(thingOrThings, this.map);
        return things.map(t => f.call(this, t, ...args));
    };
};

type LayerRefFunc = (LayerRef, ...args: Array<any>) => void;
// type LayerRefFunc2<Args: $ReadOnlyArray<mixed>> = (
//     (LayerRef, ...args: Args) => void
// )
type LayerRefFunc0 = LayerRef => void;
type LayerRefFunc1<T1> = (LayerRef, T1) => void;
type LayerRefFunc2<T1, T2> = (LayerRef, T1, T2) => void;
type LayerRefFunc3<T1, T2, T3> = (LayerRef, T1, T2, T3) => void;

type SourceRefFunc0 = SourceRef => void;
type SourceRefFunc1<T1> = (SourceRef, T1) => void;
type SourceRefFunc2<T1, T2> = (SourceRef, T1, T2) => void;
type SourceRefFunc3<T1, T2, T3> = (SourceRef, T1, T2, T3) => void;

// Magically turn a function that works on one layer into one that works on multiple layers
// specified as: an array, a regex (on layer id), or filter function (on layer definition)
/*
Cannot return function because in the first argument: [incompatible-return] Either function type [1] is incompatible with `RegExp` [2].
Or `FillLayerSpecification` [3] is incompatible with `RegExp` [2] in the first argument.
Or a call signature declaring the expected parameter / return type is missing in `FillLayerSpecification` [3] but exists in function type [4] in the first argument. (index.js:131:12)flow
*/
const arrayify = (
    f: (layerId: string, ...args: Array<any>) => void
): LayerRefFunc => {
    return function (thingOrThings: LayerRef, ...args: Array<any>): void {
        const things = resolveArray(thingOrThings, this.map);
        return things.forEach(t => f.call(this, t, ...args));
    };
};

type OffHandler = () => void;
type LayerCallback = ({ ... }) => void; // todo

// assuming each function returns an 'off' handler, returns a function that calls them all
const arrayifyAndOff = (
    f: (string, ...args: Array<any>) => any
): ((LayerRef, ...args: Array<any>) => OffHandler) => {
    return function (thingOrThings: LayerRef, ...args) {
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
class MapGlUtils implements UtilsFuncs {
    _loaded: boolean = false;
    _mapgl: ?MapboxGlLib = null;
    // $FlowFixMe[incompatible-type] // technically map is briefly null before initialisation
    map: UtilsMap = null;
    /** Initialises Map-GL-Utils on existing map object.
        @param mapgl Mapbox-GL-JS or Maplibre-GL-JS library. Only needed for later use by `hoverPopup()` etc.
        @returns Initialised MapGlUtils object.
    */
    static init(map: UtilsMap, mapgl?: MapboxGlLib): MapGlUtils {
        map.U = new MapGlUtils();
        map.U._mapgl = mapgl;
        map.U.map = map;
        return map.U;
    }

    static async newMap(
        mapboxgl: MapboxGlLib,
        params?: { style?: { ... }, ... } = {}, //hrm should be MapOptions but that type seems incomplete?
        options?: {
            addLayers?: Array<{ ... }>,
            addSources?: Array<{ ... }>,
            transformStyle?: StyleSpecification => StyleSpecification,
            mixStyles?: { ... }, // todo refine
            ...
        } = {}
    ): Promise<UtilsMap> {
        function addLayers(style: StyleSpecification, layers = []) {
            style.layers = [
                ...style.layers,
                // $FlowFixMe[incompatible-type]
                ...layers.map(l => this.layerStyle(l)),
            ];
        }
        function addSources(style: StyleSpecification, sources = {}) {
            // sources don't need any special treatment?
            style.sources = { ...style.sources, ...sources };
        }
        function transformStyle(
            style: StyleSpecification,
            transformFunc = StyleSpecification => StyleSpecification
        ) {
            style = transformFunc(style);
        }

        function mixStyles(style: StyleSpecification, mixStyles = {}) {
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
            const u = new MapGlUtils();
            addLayers.call(u, style, options.addLayers);
            addSources(style, options.addSources);
            transformStyle(style, options.transformStyle);
            mixStyles.call(u, style, options.mixStyles);
            params.style = style;
        }

        const map: UtilsMap = new mapboxgl.Map(params);
        MapGlUtils.init(map, mapboxgl);
        return map;
    }

    /** Sets Map's cursor to 'pointer' whenever the mouse is over these layers.
        @returns A function to remove the handler.
     */
    hoverPointer(layerOrLayers: LayerRef): () => void {
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

    /**
    Updates feature-state of features in the connected source[s] whenever hovering over a feature in these layers.
    @param layer Layer(s) to add handler to.
    @param {string|Array} [source] Source whose features will be updated. If not provided, use the source defined for the layer.
    @param {string} [sourceLayer] Source layer (if using vector source)
    */
    hoverFeatureState: (
        layer: LayerRef,
        source?: string,
        sourceLayer?: string,
        enterCb: ({ ... }) => void,
        leaveCb: ({ ... }) => void
    ) => () => void = arrayifyAndOff(function (
        layer: LayerRef,
        source?: string,
        sourceLayer: string,
        enterCb: function,
        leaveCb: function
    ): any {
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
        const setHoverState = state => {
            if (featureId) {
                this.map.setFeatureState(
                    { source, sourceLayer, id: featureId },
                    { hover: state }
                );
            }
        };

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
    });
    /** Show a popup whenever hovering over a feature in these layers.
    @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
    @param htmlFunc Function that receives feature and popup, returns HTML.
    @param {Object<PopupOptions>} popupOptions Options passed to `Popup()` to customise popup.
    @example hoverPopup('mylayer', f => `<h3>${f.properties.Name}</h3> ${f.properties.Description}`, { anchor: 'left' });
    */
    hoverPopup(
        layers: LayerRef,
        htmlFunc: LayerCallback,
        popupOptions?: PopupOptions = {}
    ): OffHandler {
        if (!this._mapgl) {
            throw 'Mapbox GL JS or MapLibre GL JS object required when initialising';
        }

        const popup = new this._mapgl.Popup({
            closeButton: false,
            ...popupOptions,
        });
        return arrayifyAndOff(function (layer, htmlFunc) {
            const mouseenter = e => {
                if (e.features[0]) {
                    popup.setLngLat(e.lngLat);
                    popup.setHTML(htmlFunc(e.features[0], popup));
                    popup.addTo(this.map);
                }
            };

            const mouseout = e => {
                popup.remove();
            };

            this.map.on('mouseenter', layer, mouseenter);
            this.map.on('mouseout', layer, mouseout);
            return () => {
                this.map.off('mouseenter', layer, mouseenter);
                this.map.off('mouseout', layer, mouseout);
                mouseout();
            };
        }).call(this, layers, htmlFunc);
    }
    /** Show a popup whenever a feature in these layers is clicked.
        @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
        @param htmlFunc Function that receives feature and popup, returns HTML.
        @param {Object<PopupOptions>} popupOptions Options passed to `Popup()` to customise popup.

        @returns A function that removes the handler.
        @example clickPopup('mylayer', f => `<h3>${f.properties.Name}</h3> ${f.properties.Description}`, { maxWidth: 500 });

    */
    clickPopup(
        layers: LayerRef,
        htmlFunc: ({ ... }) => void,
        popupOptions?: PopupOptions = {}
    ): OffHandler {
        if (!this._mapgl) {
            throw 'Mapbox GL JS or Maplibre GL JS object required when initialising';
        }
        const popup = new this._mapgl.Popup({
            ...popupOptions,
        });
        return arrayifyAndOff(function (layer, htmlFunc) {
            const click = e => {
                if (e.features[0]) {
                    popup.setLngLat(e.features[0].geometry.coordinates.slice());
                    popup.setHTML(htmlFunc(e.features[0], popup));
                    popup.addTo(this.map);
                }
            };
            this.map.on('click', layer, click);
            return () => this.map.off('click', layer, click);
        }).call(this, layers, htmlFunc);
    }
    /** Fire a callback whenever a feature in these layers is clicked.
        @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
        @param {function} cb Callback that receives event with .features property
        @returns A function that removes the handler.
    */
    clickLayer: (LayerRef, LayerCallback) => OffHandler = arrayifyAndOff(
        function (layer, cb) {
            const click = e => {
                e.features = this.map.queryRenderedFeatures(e.point, {
                    layers: [layer],
                });
                cb(e);
            };
            this.map.on('click', layer, click);
            return () => this.map.off('click', layer, click);
        }
    );
    /**
    Detects a click in the first of a series of layers given, and fires a callback.
    @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
    @param cb Callback, receives `{ event, layer, feature, features }`.
    @param noMatchCb Callback when a click happens that misses all these layers. Receives `{ event }`.
    @returns A function to remove the handler.
    */
    clickOneLayer(
        layerRef: LayerRef,
        cb: LayerCallback,
        noMatchCb: ?LayerCallback
    ): OffHandler {
        const layers = resolveArray(layerRef, this.map);
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
    }
    /**
    Fires a callback when mouse hovers over a feature in these layers.
    @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
    @returns A function to remove the handler.
    */
    hoverLayer: (layers: LayerRef, cb: LayerCallback) => OffHandler =
        arrayifyAndOff(function (layer, cb) {
            const click = e => {
                e.features = this.map.queryRenderedFeatures(e.point, {
                    layers: [layer],
                });
                cb(e);
            };
            this.map.on('click', layer, click);
            return () => this.map.off('click', layer, click);
        });

    _mapAddLayerBefore(
        layerDef: LayerSpecification,
        beforeLayerId: ?string
    ): void {
        if (beforeLayerId) {
            this.map.addLayer(layerDef, beforeLayerId);
        } else {
            this.map.addLayer(layerDef);
        }
    }
    /** Adds a layer, given an id, source, type, and properties.

    */
    addLayer(
        id: string,
        source: string,
        type: string,
        props: { ... },
        before: ?string
    ): SourceBoundUtils {
        this._mapAddLayerBefore(
            this.layerStyle(id, source, type, props),
            before
        );
        return this._makeSource(source);
    }
    // TODO deprecate/remove?
    add(
        id: string,
        source: SourceOrData,
        type: string,
        props: { ... },
        before?: string
    ): ?SourceBoundUtils {
        this._mapAddLayerBefore(
            // $FlowFixMe// technically this doesn't work for layer of type 'background'
            {
                ...this.properties(props),
                id,
                type,
                source: parseSource(source),
            },
            before
        );
        if (typeof source === 'string') {
            return this._makeSource(source);
        }
    }

    setLayer(
        layerId: string,
        source: string,
        type: string,
        props: SourceSpecification,
        before?: string
    ): SourceBoundUtils {
        const layerDef = this.layerStyle(layerId, source, type, props);
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
        return this._makeSource(source);
    }
    removeLayer: LayerRefFunc = arrayify(function (layer) {
        const swallowError = data => {
            if (!data.error.message.match(/does not exist/)) {
                console.error(data.error);
            }
        };
        this.map.once('error', swallowError);
        this.map.removeLayer(layer);
        this.map.off('error', swallowError);
    });
    // The bodies of these functions are added later by `makeAddLayer`
    /** Adds a layer of type `line`.*/
    addLineLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `fill`.*/
    addFillLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `circle`.*/
    addCircleLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `symbol`.*/
    addSymbolLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `video`.*/
    addVideoLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `raster`.*/
    addRasterLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `fill-extrusion`.*/
    addFillExtrusionLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `heatmap`.*/
    addHeatmapLayer(id: string, props: { ... }, before?: string): void {}
    /** Adds a layer of type `hillshade`.*/
    addHillshadeLayer(id: string, props: { ... }, before?: string): void {}

    /** Create a GeoJSON layer. */
    addGeoJSONSource(
        id: string,
        geojson: ?GeoJSON = { type: 'FeatureCollection', features: [] },
        props: ?GeoJSONSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(id, {
            type: 'geojson',
            data: geojson,
            ...props,
        });
    }
    addGeoJSON(
        id: string,
        geojson: ?GeoJSON = { type: 'FeatureCollection', features: [] },
        props: ?GeoJSONSourceSpecification
    ): SourceBoundUtils {
        return this.addGeoJSONSource(id, geojson, props);
    }
    addSource(id: string, sourceDef: SourceSpecification): SourceBoundUtils {
        const style = this.map.getStyle();
        style.sources[id] = sourceDef;
        this.map.setStyle(style);
        return this._makeSource(id);
    }
    layersBySource(source: string): Array<string> {
        return this.map
            .getStyle()
            .layers.filter(l => l.source === source)
            .map(l => l.id);
    }
    /** Adds a `vector` source
    @param sourceId ID of the new source.
    @param {string} [data] Optional URL of source tiles (.../{z}/{x}/{y}...), mapbox:// URL or TileJSON endpoint.
    @param {object} props Properties defining the source, per the style spec.

    @example addVector('mysource', 'http://example.com/tiles/{z}/{x}/{y}.pbf', { maxzoom: 13 });
    */
    addVectorSource(
        sourceId: string,
        props: string | { ... },
        extraProps?: { ... } = {}
    ): SourceBoundUtils {
        if (typeof props === 'string') {
            if (props.match(/\{z\}/)) {
                return this.addSource(sourceId, {
                    ...extraProps,
                    type: 'vector',
                    tiles: [props],
                });
            } else {
                // mapbox://, http://.../index.json
                return this.addSource(sourceId, {
                    ...extraProps,
                    type: 'vector',
                    url: props,
                });
            }
        } else {
            return this.addSource(sourceId, {
                ...props,
                type: 'vector',
            });
        }
    }
    addVector(
        sourceId: string,
        props: string | { ... },
        extraProps?: { ... } = {}
    ): SourceBoundUtils {
        return this.addVectorSource(sourceId, props, extraProps);
    }
    /** Adds a `raster` source
    @param sourceId ID of the new source.
    @param {object} props Properties defining the source, per the style spec.
    */
    addRasterSource(
        sourceId: string,
        props: RasterSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, {
            ...props,
            type: 'raster',
        });
    }
    /** Adds a `raster-dem` source
    @param sourceId ID of the new source.
    @param {object} props Properties defining the source, per the style spec.
    */
    addRasterDemSource(
        sourceId: string,
        props: RasterDEMSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, {
            ...props,
            type: 'raster-dem',
        });
    }
    /** Adds a `raster` source
    @param sourceId ID of the new source.
    @param {object} props Properties defining the source, per the style spec.
    */
    addRasterSource(
        sourceId: string,
        props: RasterSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, {
            ...props,
            type: 'raster',
        });
    }
    /** Adds an `image` source
    @param sourceId ID of the new source.
    @param {object} props Properties defining the source, per the style spec.
    */
    addImageSource(
        sourceId: string,
        props: ImageSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, {
            ...props,
            type: 'image',
        });
    }
    /** Adds a `video` source
    @param sourceId ID of the new source.
    @param {object} props Properties defining the source, per the style spec.
    */
    addVideoSource(
        sourceId: string,
        props: VideoSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, {
            ...props,
            type: 'video',
        });
    }

    /** Sets a paint or layout property on one or more layers.
    @example setProperty(['buildings-fill', 'parks-fill'], 'fillOpacity', 0.5)
    */
    setProperty: LayerRefFunc2<string, PropValue> = arrayify(function (
        layer: LayerRef,
        prop: string,
        value: PropValue
    ) {
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
    });
    /** Converts a set of properties in pascalCase or kebab-case into a layer objectwith layout and paint properties. */
    properties(props?: { ... }): ?{ ... } {
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
    }
    // layerStyle([id,] [source,] [type,] props)
    // TODO somehow make this type safe.
    layerStyle(...args: Array<mixed>): $Shape<LayerSpecification> {
        const [id, source, type] = args;
        const props = args.find(
            arg => typeof arg === 'object' && !Array.isArray(arg)
        );
        const ret: $Shape<LayerSpecification> =
            typeof props === 'object' ? this.properties(props) || {} : {};
        if (typeof id === 'string') ret.id = id;
        if (typeof source === 'string') ret.source = source;
        if (typeof type === 'string') ret.type = type;
        return ret;
    }
    /** Gets the layer definition for a given layer id, as per the style spec..
     */
    getLayerStyle(layerId: string): LayerSpecification {
        return this.map.getStyle().layers.find(l => l.id === layerId);
    }
    setLayerStyle: LayerRefFunc1<{ ... }> = arrayify(function (
        layer: LayerRef | { id: string, ... },
        style: { ... }
    ) {
        const clearProps = (oldObj = {}, newObj = {}) =>
            Object.keys(oldObj).forEach(key => {
                if (!(key in newObj)) {
                    this.setProperty(layer, key, undefined);
                }
            });
        if (
            typeof layer === 'object' &&
            !Array.isArray(layer) &&
            layer.id &&
            !style
        ) {
            style = layer;
            // $FlowFixMe[incompatible-type]
            // $FlowFixMe[prop-missing]
            layer = style.id;
        }
        const oldStyle = this.getLayerStyle(layer);
        const newStyle = this.properties(style);
        clearProps(oldStyle.paint, newStyle.paint);
        clearProps(oldStyle.layout, newStyle.layout);
        // Hmm, this gets murky, what exactly is meant to happen with non-paint, non-layout props?
        this.setProperty(layer, { ...newStyle.paint, ...newStyle.layout });
    });
    /** Replaces the current data for a GeoJSON layer.
    @param sourceId Id of the source being updated.
    @param {GeoJSON} [data] GeoJSON object to set. If not provided, defaults to an empty FeatureCollection.
    */
    setData(
        sourceId: string,
        data?: GeoJSON = { type: 'FeatureCollection', features: [] }
    ) {
        this.map.getSource(sourceId).setData(data);
    }
    /** Makes the given layers visible.
    @param {string|Array<string>|RegExp|function} Layer to toggle.
    */
    show: LayerRefFunc0 = arrayify(function (layer: LayerRef) {
        this.setVisibility(layer, 'visible');
    });
    /** Makes the given layers hidden.
    @param {string|Array<string>|RegExp|function} Layer to toggle.
     */

    hide: LayerRefFunc0 = arrayify(function (layer) {
        this.setVisibility(layer, 'none');
    });
    /** Makes the given layers hidden or visible, depending on an argument.
    @param {string|Array<string>|RegExp|function} Layer to toggle.
    @param {boolean} state True for visible, false for hidden.
    */
    toggle: LayerRefFunc1<boolean> = arrayify(function (layer, state) {
        this.setVisibility(layer, state ? 'visible' : 'none');
    });
    /** Makes all layers depending on a given source visible. */
    showSource: SourceRefFunc0 = arrayify(function (source) {
        this.setVisibility(this.layersBySource(source), 'visible');
    });
    /** Makes all layers depending on a given source hidden. */
    hideSource: SourceRefFunc0 = arrayify(function (source) {
        this.setVisibility(this.layersBySource(source), 'none');
    });
    /** Makes the given layers connected to a given source hidden or visible, depending on an argument.
    @param {string} sourceId Source[s] whose layers will be toggled.
    @param {boolean} state True for visible, false for hidden.*/
    toggleSource: SourceRefFunc1<boolean> = arrayify(function (
        sourceId,
        state
    ) {
        this.setVisibility(
            this.layersBySource(sourceId),
            state ? 'visible' : 'none'
        );
    });
    /** Replace the filter for one or more layers.
    @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
    @param {Array} filter New filter to set.
    @example map.U.setFilter(['buildings-fill', 'buildings-outline', 'buildings-label'], ['==','level','0']]);
    */
    setFilter: LayerRefFunc1<FilterSpecification> = arrayify(function (
        layer,
        filter
    ) {
        this.map.setFilter(layer, filter);
    });
    /** Removes one or more sources, first removing all layers that depend on them. Not an error if source doesn't exist.
    @param {SourceRef} sources */
    removeSource: SourceRefFunc0 = arrayify(function (source) {
        // remove layers that use this source first
        const layers = this.layersBySource(source);
        this.removeLayer(layers);
        if (this.map.getSource(source)) {
            this.map.removeSource(source);
        }
    });
    setLayerSource: LayerRefFunc2<string, string> = arrayify(function (
        layerId,
        source,
        sourceLayer
    ) {
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
        this._mapAddLayerBefore(layerDef, before);
    });
    /** Callback that fires when map loads, or immediately if map is already loaded.
    @returns {Promise} Promise, if callback not provided.
    */
    onLoad(cb?: void => void): void | Promise<void> {
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
    }
    /** Set a property on the style's root, such as `light` or `transition`. */
    setRootProperty(propName: string, val: PropValue) {
        const style = this.map.getStyle();
        style[kebabCase(propName)] = val;
        this.map.setStyle(style);
    }
    /** Sets root transition property.
    @example setTransition({ duration: 500, delay: 100 })
    */
    setTransition(val: TransitionSpecification) {
        this.setRootProperty('transition', val);
    }
    /** Adds an image for use as a symbol layer, from a URL.
    @example loadImage('marker', '/assets/marker-pin@2x.png', { pixelRatio: 2})
    */
    loadImage(id: string, url: string, options?: StyleImageMetadata): any {
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
    }
    lockOrientation(): void {
        this.map.touchZoomRotate.disableRotation();
        this.map.dragRotate.disable();
    }
    /** Gets array of font names in use, determined by traversing style. Does not detect fonts in all possible situations.
    @returns {Array[string]}  */
    fontsInUse(): Array<string> {
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
    }

    _makeSource(sourceId: string): SourceBoundUtils {
        // returns an object on which we can call .addLine() etc.
        const out = new MapGlUtils();
        out.map = this.map;
        out._mapgl = this._mapgl;
        layerTypes.forEach(function (type) {
            makeAddLayer(type, out, sourceId);
        });
        return out;
    }
}

// idempotent version
const makeAddLayer = (layerType, obj, fixedSource) => {
    let func;
    if (fixedSource) {
        func = function (id, options, before) {
            return this.setLayer(id, fixedSource, layerType, options, before);
        };
    } else {
        func = function (id, source, options, before) {
            return this.setLayer(id, source, layerType, options, before);
        };
    }
    const upType = upperCamelCase(layerType);
    //$FlowFixMe[prop-missing]
    obj[`add${upType}`] = func;
    //$FlowFixMe[prop-missing]
    obj[`add${upType}Layer`] = func;
};

// Object.assign(Utils.prototype, UtilsExtra);
function initClass(U: MapGlUtils) {
    const makeSetProp = (prop: PropName, setPropFunc) => {
        const funcName = 'set' + upperCamelCase(prop);
        //$FlowFixMe[prop-missing]
        U[funcName] = arrayify(function (layer, value) {
            return this.map[setPropFunc](layer, prop, value);
        });
    };
    const makeGetProp = (prop: PropName, getPropFunc) => {
        const funcName = 'get' + upperCamelCase(prop);
        //$FlowFixMe[prop-missing]
        U[funcName] = arrayify(function (layer) {
            return this.map[getPropFunc](layer, prop);
        });
    };
    function makeAddSource(sourceType) {
        const funcName = 'add' + upperCamelCase(sourceType);
        //$FlowFixMe[prop-missing]
        U[funcName] = function (id, props) {
            return this.addSource(id, {
                type: sourceType,
                ...props,
            });
        };
        //$FlowFixMe[prop-missing]
        U[funcName + 'Source'] = U[funcName];
    }

    //$FlowFixMe[prop-missing]
    U.update = U.setData; // deprecated
    // Turn every property into a 'setTextSize()', 'setLineColor()' etc.
    allProps.paints.forEach(prop => makeSetProp(prop, 'setPaintProperty'));
    allProps.layouts.forEach(prop => makeSetProp(prop, 'setLayoutProperty'));
    allProps.paints.forEach(prop => makeGetProp(prop, 'getPaintProperty'));
    allProps.layouts.forEach(prop => makeGetProp(prop, 'getLayoutProperty'));

    layerTypes.forEach(layerType => makeAddLayer(layerType, U));
}

const U = MapGlUtils.prototype;
initClass(U);

export default MapGlUtils;
