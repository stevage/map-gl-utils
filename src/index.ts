import { Class, $Shape } from 'utility-types';
import allProps from './keys';
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
import type { GeoJSON } from 'geojson';
// import type { StyleImageMetadata } from 'mapbox-gl/src/style/style_image';
import type MapboxGl from 'mapbox-gl';
import type {
    DataDrivenPropertyValueSpecification,
    ExpressionSpecification,
    FunctionSpecification,
    GeoJSONSource,
    LayoutSpecification,
    Map as MapboxGLMap,
    MapMouseEvent,
    PaintSpecification,
} from 'mapbox-gl';
import type { Popup, PopupOptions } from 'mapbox-gl';

// copied from mapbox-gl
type StyleImageMetadata = {
    pixelRatio: number;
    sdf: boolean;
    usvg: boolean;
    stretchX?: Array<[number, number]>;
    stretchY?: Array<[number, number]>;
    content?: [number, number, number, number];
};

export type UtilsMap = MapboxGLMap & {
    U: MapGlUtils | null | undefined;
};
type MapboxGlLib = {
    Map: Class<MapboxGLMap>;
    Popup: Class<Popup>;
};

import type { UtilsFuncs } from './utilsGenerated';
import type { UtilsLayerDef as UtilsLayerDefBasic } from './layerTypeDefsGenerated';
type PropName = string; // todo more specific?

// not currently used - weird, makeSource is really returning something slightly different from normal MapGlUtils
// export type UtilsSource = {
//     map: UtilsMap,
//     mapboxgl: Class<MapboxGl>,
//     // todo add the layer type functions
// };
type SourceBoundUtils = MapGlUtils;

// our more general type for layer definitions, where kebab-case or camelCase allowed, can have layout and paint objects or not, etc

type UtilsLayerDef = UtilsLayerDefBasic | LayerSpecification;

const kebabCase = (s: string) =>
    s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

const upperCamelCase = (s: string) =>
    s.replace(/(^|-)([a-z])/g, (x, y, l) => `${l.toUpperCase()}`);

function isPaintProp(prop: PropName) {
    return allProps.paints.indexOf(prop) >= 0;
}

function isLayoutProp(prop: PropName) {
    return allProps.layouts.indexOf(prop) >= 0;
}

function whichProp(prop: string) {
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
        (source as GeoJSON).type === 'Feature' ||
        (source as GeoJSON).type === 'FeatureCollection'
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
    | ((arg0: LayerSpecification) => boolean);
type SourceRef = LayerRef;
type PropValue = string | ExpressionSpecification | null | number;

// turn a thing, an array of things, a regex or a filter function, into an array
const resolveArray = (things: LayerRef, map: MapboxGLMap): Array<any> => {
    if (Array.isArray(things)) {
        return things;
    } else if (things instanceof RegExp) {
        // @ts-ignore
        return map
            .getStyle()
            .layers.map(l => l.id)
            .filter(id => id.match(things));
    } else if (things instanceof Function) {
        // @ts-ignore
        return map
            .getStyle()
            .layers.filter(layer => things(layer))
            .map(l => l.id);
    } else {
        return [things];
    }
};

const arrayifyMap = (
    f: (arg0: string, ...args: Array<any>) => any
): ((arg0: LayerRef, ...args: Array<any>) => Array<any>) => {
    return function (this: MapGlUtils, thingOrThings, ...args) {
        const things = resolveArray(thingOrThings, this.map);
        return things.map(t => f.call(this, t, ...args));
    };
};

type LayerRefFunc = (arg0: LayerRef, ...args: Array<any>) => void;
// type LayerRefFunc2<Args: $ReadOnlyArray<mixed>> = (
//     (LayerRef, ...args: Args) => void
// )
type LayerRefFunc0 = (arg0: LayerRef) => void;
type LayerRefFunc1<T1> = (arg0: LayerRef, arg1: T1) => void;
type LayerRefFunc2<T1, T2> = (arg0: LayerRef, arg1: T1, arg2: T2) => void;
type LayerRefFunc3<T1, T2, T3> = (
    arg0: LayerRef,
    arg1: T1,
    arg2: T2,
    arg3: T3
) => void;
type SourceRefFunc0 = (arg0: SourceRef) => void;
type SourceRefFunc1<T1> = (arg0: SourceRef, arg1: T1) => void;
type SourceRefFunc2<T1, T2> = (arg0: SourceRef, arg1: T1, arg2: T2) => void;
type SourceRefFunc3<T1, T2, T3> = (
    arg0: SourceRef,
    arg1: T1,
    arg2: T2,
    arg3: T3
) => void;

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
    return function (
        this: MapGlUtils,
        thingOrThings: LayerRef,
        ...args: Array<any>
    ): void {
        const things = resolveArray(
            thingOrThings,
            (this as unknown as MapGlUtils).map
        );
        return things.forEach(t => f.call(this, t, ...args));
    };
};

type OffHandler = () => void;
type LayerCallback = (e: any) => /*{ ... }*/ void; // todo

// assuming each function returns an 'off' handler, returns a function that calls them all
const arrayifyAndOff = (
    f: (arg0: string, ...args: Array<any>) => any
): ((arg0: LayerRef, ...args: Array<any>) => OffHandler) => {
    return function (this: MapGlUtils, thingOrThings: LayerRef, ...args) {
        const things = resolveArray(thingOrThings, this.map as MapboxGLMap);
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
] as LayerSpecification['type'][];

// @ts-expect-error[prop-missing]

class _MapGlUtils implements UtilsFuncs {
    _loaded: boolean = false;
    _mapgl: MapboxGlLib | null | undefined = null;
    // technically map is briefly null before initialisation
    //@ts-expect-error[prop-missing]
    map: UtilsMap; // | null = null;

    //@ts-ignore

    update: (sourceId: string, data?: GeoJSON) => void;

    /** Initialises Map-GL-Utils on existing map object.
      @param mapgl Mapbox-GL-JS or Maplibre-GL-JS library. Only needed for later use by `hoverPopup()` etc.
      @returns Initialised MapGlUtils object.
  */
    static init(map: UtilsMap, mapgl?: MapboxGlLib): MapGlUtils {
        map.U = new _MapGlUtils() as MapGlUtils;
        map.U._mapgl = mapgl;
        map.U.map = map;
        return map.U;
    }

    static async newMap(
        mapboxgl: MapboxGlLib,
        params: {
            style?: {};
            /*...*/
        } = {}, //hrm should be MapOptions but that type seems incomplete?
        options: {
            addLayers?: Array<{}>;
            addSources?: Array<{}>;
            transformStyle?: (arg0: StyleSpecification) => StyleSpecification;
            mixStyles?: {}; // todo refine

            /*...*/
        } = {}
    ): Promise<UtilsMap> {
        function addLayers(
            this: MapGlUtils,
            style: StyleSpecification,
            layers: UtilsLayerDef[] = []
        ) {
            style.layers = [
                ...style.layers,
                ...layers.map(l => this.layerStyle(l)),
            ];
        }

        function addSources(style: StyleSpecification, sources = {}) {
            // sources don't need any special treatment?
            style.sources = { ...style.sources, ...sources };
        }

        function transformStyle(
            style: StyleSpecification,
            transformFunc: (styleSpec: StyleSpecification) => StyleSpecification
        ) {
            style = transformFunc(style);
        }

        function mixStyles(
            this: MapGlUtils,
            style: StyleSpecification,
            mixStyles: { [key: string]: any } = {}
        ) {
            Object.keys(mixStyles).forEach(sourceId => {
                const layers = mixStyles[sourceId].layers;
                delete mixStyles[sourceId].layers;
                style.sources[sourceId] = mixStyles[sourceId];
                style.layers = [
                    ...style.layers,
                    ...layers.map((l: UtilsLayerDef) =>
                        // @ts-ignore too complicated
                        this.layerStyle({
                            source: sourceId,
                            ...l,
                        })
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

            const u = new _MapGlUtils() as MapGlUtils;
            addLayers.call(u, style, options.addLayers);
            addSources(style, options.addSources);
            transformStyle(style, options.transformStyle ?? (x => x));
            mixStyles.call(u, style, options.mixStyles);
            params.style = style;
        }

        const map: UtilsMap = new mapboxgl.Map(params) as UtilsMap;
        _MapGlUtils.init(map, mapboxgl);
        return map;
    }

    static interpolateZoom(
        stops: number | { [s: string]: unknown } | ArrayLike<unknown>,
        ...moreStops: (number | undefined)[]
    ) {
        return this.interpolate(['zoom'], stops, ...moreStops);
    }

    static zoom = _MapGlUtils.interpolateZoom;

    static step(
        expression: ExpressionSpecification,
        lowest: number,
        stops:
            | [number, ExpressionSpecification][]
            | { number: ExpressionSpecification }
            | number,
        ...moreStops: (number | ExpressionSpecification)[]
    ) {
        return [
            'step',
            typeof expression === 'string' ? ['get', expression] : expression,
            ...(Array.isArray(lowest) && !stops ? lowest : [lowest]),
            ...(Array.isArray(stops)
                ? stops
                : typeof stops === 'object'
                ? Object.entries(stops)
                      .map(([z, out]) => [isNaN(+z) ? z : +z, out])
                      // @ts-ignore
                      .flat()
                : [stops, ...moreStops]),
        ];
    }

    static stepZoom(
        lowest: number,
        stops:
            | [number, ExpressionSpecification][]
            | { number: ExpressionSpecification }
            | number,
        ...moreStops: (number | ExpressionSpecification)[]
    ) {
        // @ts-ignore
        return this.step(['zoom'], lowest, stops, ...moreStops);
    }

    static interpolate(
        expression: string | ExpressionSpecification,
        stops: number | { [s: string]: unknown } | ArrayLike<unknown>,
        ...moreStops: (number | undefined)[]
    ) {
        return [
            'interpolate',
            ['linear'],
            typeof expression === 'string' ? ['get', expression] : expression,
            ...(Array.isArray(stops)
                ? stops
                : typeof stops === 'object'
                ? Object.entries(stops)
                      .map(([z, out]) => [+z, out])
                      //@ts-ignore
                      .flat()
                : [stops, ...moreStops]),
        ];
    }

    static match(
        expression: string,
        cases: { [s: string]: unknown; default?: any },
        fallback: number | undefined
    ) {
        if (cases.default) {
            fallback = cases.default;
            delete cases.default;
        }

        return [
            'match',
            typeof expression === 'string' ? ['get', expression] : expression,
            ...Object.entries(cases)
                .map(([z, out]) => [isNaN(+z) ? z : +z, out])
                //@ts-ignore
                .flat(),
            fallback,
        ];
    }

    /** Sets Map's cursor to 'pointer' whenever the mouse is over these layers.
      @returns A function to remove the handler.
   */
    hoverPointer(layerOrLayers: LayerRef): () => void {
        const layers = resolveArray(layerOrLayers, this.map);

        const mouseenter = (e: MapMouseEvent) =>
            (this.map.getCanvas().style.cursor = 'pointer');

        const mouseleave = (e: MapMouseEvent) => {
            // don't de-hover if we're still over a different relevant layer
            if (
                this.map.queryRenderedFeatures(e.point, {
                    layers,
                }).length === 0
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
        enterCb?: (arg0: {}) => void,
        leaveCb?: (arg0: {}) => void
    ) => () => void = arrayifyAndOff(function (
        this: MapGlUtils,
        layer: string,
        source?: string,
        sourceLayer?: string,
        enterCb?,
        /*: function*/
        leaveCb?
        /*: function*/
    ): any {
        if (Array.isArray(source)) {
            // assume we have array of [source, sourceLayer]
            let removeFuncs = source.map(([source, sourceLayer]) =>
                this.hoverFeatureState(layer, source, sourceLayer)
            );
            return () => removeFuncs.forEach(f => f());
        }

        if (source === undefined) {
            const l = this.getLayerStyle(layer) as LayerSpecification;
            source = l.source;
            sourceLayer = l['source-layer'];
        }

        let featureId: number | undefined;

        const setHoverState = (state: boolean) => {
            if (featureId) {
                this.map.setFeatureState(
                    // @ts-ignore
                    {
                        source,
                        sourceLayer,
                        id: featureId,
                    },
                    {
                        hover: state,
                    }
                );
            }
        };

        const mousemove = (e: MapMouseEvent) => {
            const f = e.features?.[0];

            if (f && f.id === featureId) {
                return;
            }

            setHoverState(false);
            if (!f) return;

            if (featureId && leaveCb) {
                leaveCb({ ...e, oldFeatureId: featureId });
            }

            featureId = f.id as number;
            setHoverState(true);

            if (enterCb) {
                enterCb(e);
            }
        };

        const mouseleave = (e?: MapMouseEvent & { oldFeatureId?: number }) => {
            setHoverState(false);

            if (e && e.oldFeatureId) {
                e.oldFeatureId = featureId;
            }

            featureId = undefined;

            if (leaveCb) {
                leaveCb(e);
            }
        };

        // TODO this is a problem, we need to arrayif layer
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
        popupOptions: PopupOptions = {}
    ): OffHandler {
        if (!this._mapgl) {
            throw 'Mapbox GL JS or MapLibre GL JS object required when initialising';
        }

        const popup = new this._mapgl.Popup({
            closeButton: false,
            ...popupOptions,
        });
        return arrayifyAndOff(function (this: MapGlUtils, layer, htmlFunc) {
            const mouseenter = (e: MapMouseEvent) => {
                if (e?.features?.[0]) {
                    popup.setLngLat(e.lngLat);
                    popup.setHTML(htmlFunc(e.features[0], popup));
                    popup.addTo(this.map);
                }
            };

            const mouseout = (e?: MapMouseEvent) => {
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
        htmlFunc: (arg0: {}) => void,
        popupOptions: PopupOptions = {}
    ): OffHandler {
        if (!this._mapgl) {
            throw 'Mapbox GL JS or Maplibre GL JS object required when initialising';
        }

        const popup = new this._mapgl.Popup({ ...popupOptions });
        return arrayifyAndOff(function (this: MapGlUtils, layer, htmlFunc) {
            const click = (e: MapMouseEvent) => {
                if (e.features?.[0]) {
                    // @ts-ignore // geometrycollection v unlikely
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
    clickLayer: (arg0: LayerRef, arg1: LayerCallback) => OffHandler =
        arrayifyAndOff(function (this: MapGlUtils, layer, cb) {
            const click = (e: MapMouseEvent) => {
                e.features = this.map.queryRenderedFeatures(e.point, {
                    layers: [layer],
                });
                cb(e);
            };

            this.map.on('click', layer, click);
            return () => this.map.off('click', layer, click);
        });

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
        noMatchCb: LayerCallback | null | undefined
    ): OffHandler {
        const layers = resolveArray(layerRef, this.map);

        const click = (e: MapMouseEvent) => {
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
        arrayifyAndOff(function (this: MapGlUtils, layer, cb) {
            const click = (e: MapMouseEvent) => {
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
        beforeLayerId: string | null | undefined
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
        props: {},
        before: string | null | undefined
    ): SourceBoundUtils {
        this._mapAddLayerBefore(
            this.layerStyle(id, source, type, props) as LayerSpecification,
            before
        );

        return this._makeSource(source);
    }

    // TODO deprecate/remove?
    add(
        id: string,
        source: SourceOrData,
        type: string,
        props: {},
        before?: string
    ): SourceBoundUtils | null | undefined {
        this._mapAddLayerBefore(
            // $FlowFixMe// technically this doesn't work for layer of type 'background'
            {
                ...this.properties(props),
                id,
                // @ts-ignore
                type,
                // @ts-ignore
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
        props: UtilsLayerDef,
        before?: string
    ): SourceBoundUtils {
        const layerDef = this.layerStyle(
            layerId,
            source,
            type,
            props
        ) as LayerSpecification;
        const style = this.map.getStyle();
        if (!style) throw 'Map has no style';
        const layerIndex = style.layers.findIndex(l => l.id === layerDef.id);
        const beforeIndex = style.layers.findIndex(l => l.id === before);
        const useAddLayer = true; // using addLayer is many times faster than replacing the style, especially if it includes GeoJSON sources literally

        if (useAddLayer) {
            if (layerIndex >= 0) {
                this.map.removeLayer(layerDef.id);
                let readdBefore = before;

                if (!before && style.layers[layerIndex + 1]) {
                    readdBefore = style.layers[layerIndex + 1].id;
                }

                this.map.addLayer(layerDef, readdBefore);
            } else {
                this.map.addLayer(layerDef, before || undefined);
            }
        } else {
            if (layerIndex >= 0) {
                style.layers.splice(layerIndex, 1, layerDef);
            } else if (beforeIndex >= 0) {
                style.layers.splice(beforeIndex, 0, layerDef);
            } else {
                style.layers.push(layerDef);
            }

            this.map.setStyle(style);
        }

        return this._makeSource(source);
    }

    removeLayer: LayerRefFunc = arrayify(function (this: MapGlUtils, layer) {
        const swallowError = (data: { error: { message: string } }) => {
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
    addLineLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `fill`.*/
    addFillLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `circle`.*/
    addCircleLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `symbol`.*/
    addSymbolLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `video`.*/
    addVideoLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `raster`.*/
    addRasterLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `fill-extrusion`.*/
    addFillExtrusionLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `heatmap`.*/
    addHeatmapLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Adds a layer of type `hillshade`.*/
    addHillshadeLayer(
        id: string,
        source: string,
        props: {},
        before?: string
    ): void {}

    /** Create a GeoJSON layer. */
    addGeoJSONSource(
        id: string,
        geojson?: GeoJSON | null | undefined,
        props?: GeoJSONSourceSpecification | null | undefined
    ): SourceBoundUtils {
        if (!geojson)
            geojson = {
                type: 'FeatureCollection',
                features: [],
            };
        return this.addSource(id, {
            type: 'geojson',
            data: geojson ?? undefined,
            ...props,
        });
    }

    addGeoJSON(
        id: string,
        geojson?: GeoJSON | null | undefined,
        props?: GeoJSONSourceSpecification | null | undefined
    ): SourceBoundUtils {
        return this.addGeoJSONSource(id, geojson, props);
    }

    addSource(id: string, sourceDef: SourceSpecification): SourceBoundUtils {
        const style = this.map.getStyle();
        if (!style) throw 'Map has no style';
        style.sources[id] = sourceDef;
        this.map.setStyle(style);
        return this._makeSource(id);
    }

    layersBySource(source: string): Array<string> {
        const style = this.map.getStyle();
        if (!style) throw 'Map has no style';

        return style.layers.filter(l => l.source === source).map(l => l.id);
    }

    /** Adds a `vector` source
  @param sourceId ID of the new source.
  @param {string} [data] Optional URL of source tiles (.../{z}/{x}/{y}...), mapbox:// URL or TileJSON endpoint.
  @param {object} props Properties defining the source, per the style spec.
   @example addVector('mysource', 'http://example.com/tiles/{z}/{x}/{y}.pbf', { maxzoom: 13 });
  */
    addVectorSource(
        sourceId: string,
        props: string | {},
        extraProps: {} = {}
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
            return this.addSource(sourceId, { ...props, type: 'vector' });
        }
    }

    addVector(
        sourceId: string,
        props: string | {},
        extraProps: {} = {}
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
        return this.addSource(sourceId, { ...props, type: 'raster' });
    }

    /** Adds a `raster-dem` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */
    addRasterDemSource(
        sourceId: string,
        props: RasterDEMSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, { ...props, type: 'raster-dem' });
    }

    /** Adds an `image` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */
    addImageSource(
        sourceId: string,
        props: ImageSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, { ...props, type: 'image' });
    }

    /** Adds a `video` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */
    addVideoSource(
        sourceId: string,
        props: VideoSourceSpecification
    ): SourceBoundUtils {
        return this.addSource(sourceId, { ...props, type: 'video' });
    }

    /** Sets a paint or layout property on one or more layers.
  @example setProperty(['buildings-fill', 'parks-fill'], 'fillOpacity', 0.5)
  */
    setProperty: LayerRefFunc2<string, PropValue | undefined> = arrayify(
        function (
            this: MapGlUtils,
            layerRef: LayerRef,
            prop: string | undefined,
            value?: PropValue | undefined // TODO should undefined be coerced to null?
        ) {
            if (typeof prop === 'object') {
                Object.keys(prop).forEach(k =>
                    this.setProperty(layerRef, k, prop[k])
                );
            } else {
                const kprop = kebabCase(prop ?? '');
                const layers = resolveArray(layerRef, this.map);
                for (const layer of layers) {
                    if (isPaintProp(kprop)) {
                        // @ts-ignore
                        this.map.setPaintProperty(layer, kprop, value);
                    } else if (isLayoutProp(kprop)) {
                        // @ts-ignore
                        this.map.setLayoutProperty(layer, kprop, value);
                    } else {
                        // ignore properties such as minzoom, type, filter, etc for now.
                    }
                }
            }
        }
    );

    /** Converts a set of properties in pascalCase or kebab-case into a layer objectwith layout and paint properties. */
    properties(props?: {} /*...*/): {} | null | undefined {
        if (!props) {
            return undefined;
        }

        const out = {} as {
            paint?: PaintSpecification;
            layout?: LayoutSpecification;
            [key: string]: any;
        };

        const which = {
            paint: {},
            layout: {},
            other: {},
        } as {
            paint: PaintSpecification;
            layout: LayoutSpecification;
            other: {};
        };
        Object.keys(props).forEach(prop => {
            const kprop = kebabCase(prop);
            // @ts-expect-error
            which[whichProp(kprop)][kprop] = props[prop];
        });

        if (Object.keys(which.paint).length) {
            out.paint = which.paint as PaintSpecification;
        }

        if (Object.keys(which.layout).length) {
            out.layout = which.layout;
        }

        Object.assign(out, which.other);
        return out;
    }

    // layerStyle([id,] [source,] [type,] props)
    // this is also used for source definitions
    // TODO somehow make this type safe.
    layerStyle(...args: Array<string | UtilsLayerDef>): LayerSpecification {
        const [id, source, type] = args;
        const props = args.find(
            arg => typeof arg === 'object' && !Array.isArray(arg)
        );
        const ret: $Shape<LayerSpecification> =
            typeof props === 'object' ? this.properties(props) || {} : {};
        if (typeof id === 'string') ret.id = id;
        if (typeof source === 'string') ret.source = source;
        // @ts-ignore
        if (typeof type === 'string') ret.type = type;

        //@ts-ignore - yes, maybe we should actually check
        return ret;
    }

    /** Gets the layer definition for a given layer id, as per the style spec..
     */
    getLayerStyle(layerId: string): LayerSpecification | undefined {
        return this.map.getStyle()?.layers?.find(l => l.id === layerId);
    }

    setLayerStyle: LayerRefFunc1<{}> = arrayify(function (
        this: MapGlUtils,
        layer: string | LayerSpecification,
        // | {
        //       id: string;
        //   },
        style?: UtilsLayerDef
    ) {
        const clearProps = (
            oldObj: { [key: string]: any } = {},
            newObj: { [key: string]: any } = {}
        ) =>
            Object.keys(oldObj).forEach(key => {
                if (!(key in newObj)) {
                    this.setProperty(layer as string, key, undefined);
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
        const oldStyle = this.getLayerStyle(layer as string);
        const newStyle: { [key: string]: any } | null | undefined =
            this.properties(style);
        clearProps(oldStyle?.paint, newStyle?.paint);
        clearProps(oldStyle?.layout, newStyle?.layout);
        // Hmm, this gets murky, what exactly is meant to happen with non-paint, non-layout props?
        this.setProperty(
            layer as string,
            { ...newStyle?.paint, ...newStyle?.layout },
            undefined
        );
    });

    /** Replaces the current data for a GeoJSON layer.
  @param sourceId Id of the source being updated.
  @param {GeoJSON} [data] GeoJSON object to set. If not provided, defaults to an empty FeatureCollection.
  */
    setData(
        sourceId: string,
        data: GeoJSON = {
            type: 'FeatureCollection',
            features: [],
        }
    ) {
        (this.map.getSource(sourceId) as GeoJSONSource).setData(data);
    }

    /** Makes the given layers visible.
  @param {string|Array<string>|RegExp|function} Layer to toggle.
  */
    show: LayerRefFunc0 = arrayify(function (
        this: MapGlUtils,
        layer: LayerRef
    ) {
        this.setVisibility(layer, 'visible');
    });

    /** Makes the given layers hidden.
  @param {string|Array<string>|RegExp|function} Layer to toggle.
   */
    hide: LayerRefFunc0 = arrayify(function (this: MapGlUtils, layer) {
        this.setVisibility(layer, 'none');
    });

    /** Makes the given layers hidden or visible, depending on an argument.
  @param {string|Array<string>|RegExp|function} Layer to toggle.
  @param {boolean} state True for visible, false for hidden.
  */
    toggle: LayerRefFunc1<boolean> = arrayify(function (
        this: UtilsFuncs,
        layer,
        state
    ) {
        this.setVisibility(layer, state ? 'visible' : 'none');
    });

    /** Makes all layers depending on a given source visible. */
    showSource: SourceRefFunc0 = arrayify(function (
        this: MapGlUtils & UtilsFuncs,
        source
    ) {
        this.setVisibility(this.layersBySource(source), 'visible');
    });

    /** Makes all layers depending on a given source hidden. */
    hideSource: SourceRefFunc0 = arrayify(function (this: MapGlUtils, source) {
        this.setVisibility(this.layersBySource(source), 'none');
    });

    /** Makes the given layers connected to a given source hidden or visible, depending on an argument.
  @param {string} sourceId Source[s] whose layers will be toggled.
  @param {boolean} state True for visible, false for hidden.*/
    toggleSource: SourceRefFunc1<boolean> = arrayify(function (
        this: MapGlUtils,
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
        this: MapGlUtils,
        layer,
        filter
    ) {
        this.map.setFilter(layer, filter);
    });

    /** Removes one or more sources, first removing all layers that depend on them. Not an error if source doesn't exist.
  @param {SourceRef} sources */
    removeSource: SourceRefFunc0 = arrayify(function (
        this: MapGlUtils,
        source
    ) {
        // remove layers that use this source first
        const layers = this.layersBySource(source);
        this.removeLayer(layers);

        if (this.map.getSource(source)) {
            this.map.removeSource(source);
        }
    });

    /** Changes the source of an existing layer, by removing and readding the source.
     *  @example setLayerSource(['trees-circle', 'trees-label'], 'allpoints', 'trees')
     *  @param {string|Array<string>|RegExp|function} layerId Layer[s] whose source will be changed.
     *  @param {string} sourceId New source ID to set.
     *  @param {string} [sourceLayer] New source layer to set.
     *
     */
    setLayerSource: LayerRefFunc2<string, string> = arrayify(function (
        this: MapGlUtils,
        layerId,
        source,
        sourceLayer
    ) {
        const oldLayers = this.map.getStyle()!.layers;
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
    onLoad(cb?: (arg0: void) => void): void | Promise<void> {
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
    setRootProperty(
        propName: string,
        val: PropValue | TransitionSpecification
    ) {
        const style = this.map.getStyle();
        // @ts-ignore
        style[kebabCase(propName)] = val;
        // @ts-ignore
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
        if (
            typeof url === 'string'
            /* && url.match(/\.[a-z]+$/)*/
        ) {
            return new Promise((resolve, reject) => {
                this.map.loadImage(url, (error, image) => {
                    if (error || !image) {
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
        function findLiterals(expr: ExpressionSpecification) {
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
        const style = this.map.getStyle();
        if (!style) throw 'Map has no style';
        const fontExprs = style.layers
            .map(
                (l: LayerSpecification) =>
                    l.type === 'symbol' && l.layout && l.layout['text-font']
            )
            .filter(Boolean) as (
            | DataDrivenPropertyValueSpecification<string[]>
            | FunctionSpecification<string[]>
        )[]; // as any[]; // TODO better type

        for (const fontExpr of fontExprs) {
            // if top level expression is an array of strings, it's hopefully ['Arial', ...] and not ['get', 'font']

            if ((fontExpr as FunctionSpecification<any>).stops) {
                // old-school base/stops
                // TODO verify we have got all the cases
                try {
                    fonts.push(
                        ...(fontExpr as FunctionSpecification<any>).stops
                            // @ts-ignore
                            .flat()
                            .filter(Array.isArray)
                            .flat()
                    );
                } catch (e) {
                    console.log("Couldn't process font expression:", fontExpr);
                }
                //@ts-ignore
            } else if (fontExpr.every(f => typeof f === 'string')) {
                //@ts-ignore

                fonts.push(...fontExpr);
            } else {
                // @ts-ignore
                findLiterals(fontExpr);
            }
        }

        return [...new Set(fonts)];
    }

    _makeSource(sourceId: string): SourceBoundUtils {
        // returns an object on which we can call .addLine() etc.
        const out = new _MapGlUtils();
        out.map = this.map;
        out._mapgl = this._mapgl;
        layerTypes.forEach(function (type) {
            makeAddLayer(type, out, sourceId);
        });
        return out as MapGlUtils;
    }
} // idempotent version

const makeAddLayer = (
    layerType: LayerSpecification['type'],
    obj: _MapGlUtils,
    fixedSource?: string
) => {
    let func;

    if (fixedSource) {
        func = function (
            this: MapGlUtils,
            id: string,
            options: UtilsLayerDef,
            before: string
        ) {
            return this.setLayer(id, fixedSource, layerType, options, before);
        };
    } else {
        func = function (
            this: MapGlUtils,
            id: string,
            source: string,
            options: UtilsLayerDef,
            before: string
        ) {
            return this.setLayer(id, source, layerType, options, before);
        };
    }

    const upType = upperCamelCase(layerType);
    // too complicated...
    // @ts-ignore
    obj[`add${upType}`] = func;
    // @ts-ignore
    obj[`add${upType}Layer`] = func;
};

// Object.assign(Utils.prototype, UtilsExtra);
function initClass(U: _MapGlUtils) {
    const makeSetProp = (
        prop: PropName,
        setPropFunc: 'setPaintProperty' | 'setLayoutProperty'
    ) => {
        const funcName = 'set' + upperCamelCase(prop);
        // too complicated for me right now
        // @ts-ignore
        U[funcName] = arrayify(function (
            this: MapGlUtils,
            layer: LayerRef,
            value
        ) {
            // @ts-ignore
            return this.map[setPropFunc](layer, prop, value);
        });
    };

    const makeGetProp = (
        prop: PropName,
        getPropFunc: 'getPaintProperty' | 'getLayoutProperty'
    ) => {
        const funcName = 'get' + upperCamelCase(prop);
        // @ts-ignore
        U[funcName] = arrayify(function (this: MapGlUtils, layer: LayerRef) {
            // @ts-ignore
            return this.map[getPropFunc](layer, prop);
        });
    };

    function makeAddSource(sourceType: string) {
        const funcName = 'add' + upperCamelCase(sourceType);

        // @ts-ignore
        U[funcName] = function (id, props) {
            return this.addSource(id, {
                type: sourceType,
                ...props,
            });
        };

        // @ts-ignore
        U[funcName + 'Source'] = U[funcName];
    }

    // Turn every property into a 'setTextSize()', 'setLineColor()' etc.
    allProps.paints.forEach(prop => makeSetProp(prop, 'setPaintProperty'));
    allProps.layouts.forEach(prop => makeSetProp(prop, 'setLayoutProperty'));
    allProps.paints.forEach(prop => makeGetProp(prop, 'getPaintProperty'));
    allProps.layouts.forEach(prop => makeGetProp(prop, 'getLayoutProperty'));
    layerTypes.forEach(layerType => makeAddLayer(layerType, U));
}

export type MapGlUtils = _MapGlUtils & UtilsFuncs;

const U = _MapGlUtils.prototype as MapGlUtils;
initClass(U);
export default _MapGlUtils;
