function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var allProps = {
  paints: 'fill-antialias,fill-opacity,fill-color,fill-outline-color,fill-translate,fill-translate-anchor,fill-pattern,fill-extrusion-opacity,fill-extrusion-color,fill-extrusion-translate,fill-extrusion-translate-anchor,fill-extrusion-pattern,fill-extrusion-height,fill-extrusion-base,fill-extrusion-vertical-gradient,line-opacity,line-color,line-translate,line-translate-anchor,line-width,line-gap-width,line-offset,line-blur,line-dasharray,line-pattern,line-gradient,circle-radius,circle-color,circle-blur,circle-opacity,circle-translate,circle-translate-anchor,circle-pitch-scale,circle-pitch-alignment,circle-stroke-width,circle-stroke-color,circle-stroke-opacity,heatmap-radius,heatmap-weight,heatmap-intensity,heatmap-color,heatmap-opacity,icon-opacity,icon-color,icon-halo-color,icon-halo-width,icon-halo-blur,icon-translate,icon-translate-anchor,text-opacity,text-color,text-halo-color,text-halo-width,text-halo-blur,text-translate,text-translate-anchor,raster-opacity,raster-hue-rotate,raster-brightness-min,raster-brightness-max,raster-saturation,raster-contrast,raster-resampling,raster-fade-duration,hillshade-illumination-direction,hillshade-illumination-anchor,hillshade-exaggeration,hillshade-shadow-color,hillshade-highlight-color,hillshade-accent-color,background-color,background-pattern,background-opacity,sky-type,sky-atmosphere-sun,sky-atmosphere-sun-intensity,sky-gradient-center,sky-gradient-radius,sky-gradient,sky-atmosphere-halo-color,sky-atmosphere-color,sky-opacity'.split(','),
  layouts: 'visibility,fill-sort-key,circle-sort-key,line-cap,line-join,line-miter-limit,line-round-limit,line-sort-key,symbol-placement,symbol-spacing,symbol-avoid-edges,symbol-sort-key,symbol-z-order,icon-allow-overlap,icon-ignore-placement,icon-optional,icon-rotation-alignment,icon-size,icon-text-fit,icon-text-fit-padding,icon-image,icon-rotate,icon-padding,icon-keep-upright,icon-offset,icon-anchor,icon-pitch-alignment,text-pitch-alignment,text-rotation-alignment,text-field,text-font,text-size,text-max-width,text-line-height,text-letter-spacing,text-justify,text-radial-offset,text-variable-anchor,text-anchor,text-max-angle,text-writing-mode,text-rotate,text-padding,text-keep-upright,text-transform,text-offset,text-allow-overlap,text-ignore-placement,text-optional'.split(',')
};

const kebabCase = s => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

const upperCamelCase = s => s.replace(/(^|-)([a-z])/g, (x, y, l) => `${l.toUpperCase()}`);

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

function parseSource(source) {
  if (String(source).match(/\.(geo)?json/) || source.type === 'Feature' || source.type === 'FeatureCollection') {
    return {
      type: 'geojson',
      data: source
    };
  } else if (String(source).match(/^mapbox:\/\//)) {
    return {
      type: 'vector',
      url: source
    };
  } else {
    return source;
  }
}

// so basically any
// turn a thing, an array of things, a regex or a filter function, into an array
const resolveArray = (things, map) => {
  if (Array.isArray(things)) {
    return things;
  } else if (things instanceof RegExp) {
    return map.getStyle().layers.map(l => l.id).filter(id => id.match(things));
  } else if (things instanceof Function) {
    return map.getStyle().layers.filter(layer => things(layer)).map(l => l.id);
  } else {
    return [things];
  }
};

// Magically turn a function that works on one layer into one that works on multiple layers
// specified as: an array, a regex (on layer id), or filter function (on layer definition)

/*
Cannot return function because in the first argument: [incompatible-return] Either function type [1] is incompatible with `RegExp` [2].
Or `FillLayerSpecification` [3] is incompatible with `RegExp` [2] in the first argument.
Or a call signature declaring the expected parameter / return type is missing in `FillLayerSpecification` [3] but exists in function type [4] in the first argument. (index.js:131:12)flow
*/
const arrayify = f => {
  return function (thingOrThings, ...args) {
    const things = resolveArray(thingOrThings, this.map);
    return things.forEach(t => f.call(this, t, ...args));
  };
};

// todo
// assuming each function returns an 'off' handler, returns a function that calls them all
const arrayifyAndOff = f => {
  return function (thingOrThings, ...args) {
    const things = resolveArray(thingOrThings, this.map);
    const offs = things.map(t => f.call(this, t, ...args));
    return () => offs.forEach(off => off());
  };
};

const layerTypes = ['line', 'fill', 'circle', 'symbol', 'video', 'raster', 'fill-extrusion', 'heatmap', 'hillshade']; // $FlowFixMe[prop-missing]

class MapGlUtils {
  constructor() {
    _defineProperty(this, "_loaded", false);

    _defineProperty(this, "_mapgl", null);

    _defineProperty(this, "map", null);

    _defineProperty(this, "hoverFeatureState", arrayifyAndOff(function (layer, source, sourceLayer, enterCb, leaveCb) {
      if (Array.isArray(source)) {
        // assume we have array of [source, sourceLayer]
        let removeFuncs = source.map(([source, sourceLayer]) => this.hoverFeatureState(layer, source, sourceLayer));
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
          this.map.setFeatureState({
            source,
            sourceLayer,
            id: featureId
          }, {
            hover: state
          });
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
          leaveCb({ ...e,
            oldFeatureId: featureId
          });
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
    }));

    _defineProperty(this, "clickLayer", arrayifyAndOff(function (layer, cb) {
      const click = e => {
        e.features = this.map.queryRenderedFeatures(e.point, {
          layers: [layer]
        });
        cb(e);
      };

      this.map.on('click', layer, click);
      return () => this.map.off('click', layer, click);
    }));

    _defineProperty(this, "hoverLayer", arrayifyAndOff(function (layer, cb) {
      const click = e => {
        e.features = this.map.queryRenderedFeatures(e.point, {
          layers: [layer]
        });
        cb(e);
      };

      this.map.on('click', layer, click);
      return () => this.map.off('click', layer, click);
    }));

    _defineProperty(this, "removeLayer", arrayify(function (layer) {
      const swallowError = data => {
        if (!data.error.message.match(/does not exist/)) {
          console.error(data.error);
        }
      };

      this.map.once('error', swallowError);
      this.map.removeLayer(layer);
      this.map.off('error', swallowError);
    }));

    _defineProperty(this, "setProperty", arrayify(function (layer, prop, value) {
      if (typeof prop === 'object') {
        Object.keys(prop).forEach(k => this.setProperty(layer, k, prop[k]));
      } else {
        const kprop = kebabCase(prop);

        if (isPaintProp(kprop)) {
          this.map.setPaintProperty(layer, kprop, value);
        } else if (isLayoutProp(kprop)) {
          this.map.setLayoutProperty(layer, kprop, value);
        } else ;
      }
    }));

    _defineProperty(this, "setLayerStyle", arrayify(function (layer, style) {
      const clearProps = (oldObj = {}, newObj = {}) => Object.keys(oldObj).forEach(key => {
        if (!(key in newObj)) {
          this.setProperty(layer, key, undefined);
        }
      });

      if (typeof layer === 'object' && !Array.isArray(layer) && layer.id && !style) {
        style = layer; // $FlowFixMe[incompatible-type]
        // $FlowFixMe[prop-missing]

        layer = style.id;
      }

      const oldStyle = this.getLayerStyle(layer);
      const newStyle = this.properties(style);
      clearProps(oldStyle.paint, newStyle.paint);
      clearProps(oldStyle.layout, newStyle.layout); // Hmm, this gets murky, what exactly is meant to happen with non-paint, non-layout props?

      this.setProperty(layer, { ...newStyle.paint,
        ...newStyle.layout
      });
    }));

    _defineProperty(this, "show", arrayify(function (layer) {
      this.setVisibility(layer, 'visible');
    }));

    _defineProperty(this, "hide", arrayify(function (layer) {
      this.setVisibility(layer, 'none');
    }));

    _defineProperty(this, "toggle", arrayify(function (layer, state) {
      this.setVisibility(layer, state ? 'visible' : 'none');
    }));

    _defineProperty(this, "showSource", arrayify(function (source) {
      this.setVisibility(this.layersBySource(source), 'visible');
    }));

    _defineProperty(this, "hideSource", arrayify(function (source) {
      this.setVisibility(this.layersBySource(source), 'none');
    }));

    _defineProperty(this, "toggleSource", arrayify(function (sourceId, state) {
      this.setVisibility(this.layersBySource(sourceId), state ? 'visible' : 'none');
    }));

    _defineProperty(this, "setFilter", arrayify(function (layer, filter) {
      this.map.setFilter(layer, filter);
    }));

    _defineProperty(this, "removeSource", arrayify(function (source) {
      // remove layers that use this source first
      const layers = this.layersBySource(source);
      this.removeLayer(layers);

      if (this.map.getSource(source)) {
        this.map.removeSource(source);
      }
    }));

    _defineProperty(this, "setLayerSource", arrayify(function (layerId, source, sourceLayer) {
      const oldLayers = this.map.getStyle().layers;
      const layerIndex = oldLayers.findIndex(l => l.id === layerId);
      const layerDef = oldLayers[layerIndex];
      const before = oldLayers[layerIndex + 1] && oldLayers[layerIndex + 1].id;
      layerDef.source = source;

      if (sourceLayer) {
        layerDef['source-layer'] = sourceLayer;
      } else if (sourceLayer !== undefined) {
        delete layerDef['source-layer'];
      }

      this.map.removeLayer(layerId);

      this._mapAddLayerBefore(layerDef, before);
    }));
  }

  /** Initialises Map-GL-Utils on existing map object.
      @param mapgl Mapbox-GL-JS or Maplibre-GL-JS library. Only needed for later use by `hoverPopup()` etc.
      @returns Initialised MapGlUtils object.
  */
  static init(map, mapgl) {
    map.U = new MapGlUtils();
    map.U._mapgl = mapgl;
    map.U.map = map;
    return map.U;
  }

  static async newMap(mapboxgl, params = {}, //hrm should be MapOptions but that type seems incomplete?
  options = {}) {
    function addLayers(style, layers = []) {
      style.layers = [...style.layers, // $FlowFixMe[incompatible-type]
      ...layers.map(l => this.layerStyle(l))];
    }

    function addSources(style, sources = {}) {
      // sources don't need any special treatment?
      style.sources = { ...style.sources,
        ...sources
      };
    }

    function transformStyle(style, transformFunc = StyleSpecification => StyleSpecification) {
      style = transformFunc(style);
    }

    function mixStyles(style, mixStyles = {}) {
      Object.keys(mixStyles).forEach(sourceId => {
        const layers = mixStyles[sourceId].layers;
        delete mixStyles[sourceId].layers;
        style.sources[sourceId] = mixStyles[sourceId];
        style.layers = [...style.layers, ...layers.map(l => this.layerStyle({
          source: sourceId,
          ...l
        }))];
      });
    }

    if (!params.style) {
      params.style = {
        version: 8,
        layers: [],
        sources: {}
      };
    }

    if (options.addLayers || options.addSources || options.transformStyle || options.mixStyles) {
      let styleParam = params.style;
      let style;

      if (typeof styleParam === 'string') {
        const styleUrl = styleParam.replace(/^mapbox:\/\/styles\//, 'https://api.mapbox.com/styles/v1/');
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

    const map = new mapboxgl.Map(params);
    MapGlUtils.init(map, mapboxgl);
    return map;
  }
  /** Sets Map's cursor to 'pointer' whenever the mouse is over these layers.
      @returns A function to remove the handler.
   */


  hoverPointer(layerOrLayers) {
    const layers = resolveArray(layerOrLayers, this.map);

    const mouseenter = e => this.map.getCanvas().style.cursor = 'pointer';

    const mouseleave = e => {
      // don't de-hover if we're still over a different relevant layer
      if (this.map.queryRenderedFeatures(e.point, {
        layers
      }).length === 0) {
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


  /** Show a popup whenever hovering over a feature in these layers.
  @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
  @param htmlFunc Function that receives feature and popup, returns HTML.
  @param {Object<PopupOptions>} popupOptions Options passed to `Popup()` to customise popup.
  @param {string} showEvent mouse event to trigger the popup, defaults to "mouseenter"
  @example hoverPopup('mylayer', f => `<h3>${f.properties.Name}</h3> ${f.properties.Description}`, { anchor: 'left' });
  */
  hoverPopup(layers, htmlFunc, popupOptions = {}, showEvent = 'mouseenter') {
    if (!this._mapgl) {
      throw 'Mapbox GL JS or MapLibre GL JS object required when initialising';
    }

    const popup = new this._mapgl.Popup({
      closeButton: false,
      ...popupOptions
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

      this.map.on(showEvent, layer, mouseenter);
      this.map.on('mouseout', layer, mouseout);
      return () => {
        this.map.off(showEvent, layer, mouseenter);
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


  clickPopup(layers, htmlFunc, popupOptions = {}) {
    if (!this._mapgl) {
      throw 'Mapbox GL JS or Maplibre GL JS object required when initialising';
    }

    const popup = new this._mapgl.Popup({ ...popupOptions
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


  /**
  Detects a click in the first of a series of layers given, and fires a callback.
  @param {string|Array<string>|RegExp|function} layers Layers to attach handler to.
  @param cb Callback, receives `{ event, layer, feature, features }`.
  @param noMatchCb Callback when a click happens that misses all these layers. Receives `{ event }`.
  @returns A function to remove the handler.
  */
  clickOneLayer(layerRef, cb, noMatchCb) {
    const layers = resolveArray(layerRef, this.map);

    const click = e => {
      let match = false;

      for (const layer of layers) {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: [layer]
        });

        if (features[0]) {
          try {
            cb({
              event: e,
              layer,
              feature: features[0],
              features
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


  _mapAddLayerBefore(layerDef, beforeLayerId) {
    if (beforeLayerId) {
      this.map.addLayer(layerDef, beforeLayerId);
    } else {
      this.map.addLayer(layerDef);
    }
  }
  /** Adds a layer, given an id, source, type, and properties.
   */


  addLayer(id, source, type, props, before) {
    this._mapAddLayerBefore(this.layerStyle(id, source, type, props), before);

    return this._makeSource(source);
  } // TODO deprecate/remove?


  add(id, source, type, props, before) {
    this._mapAddLayerBefore( // $FlowFixMe// technically this doesn't work for layer of type 'background'
    { ...this.properties(props),
      id,
      type,
      source: parseSource(source)
    }, before);

    if (typeof source === 'string') {
      return this._makeSource(source);
    }
  }

  setLayer(layerId, source, type, props, before) {
    const layerDef = this.layerStyle(layerId, source, type, props);
    const style = this.map.getStyle();
    const layerIndex = style.layers.findIndex(l => l.id === layerDef.id);
    style.layers.findIndex(l => l.id === before);

    {
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
    }

    return this._makeSource(source);
  }

  // The bodies of these functions are added later by `makeAddLayer`

  /** Adds a layer of type `line`.*/
  addLineLayer(id, props, before) {}
  /** Adds a layer of type `fill`.*/


  addFillLayer(id, props, before) {}
  /** Adds a layer of type `circle`.*/


  addCircleLayer(id, props, before) {}
  /** Adds a layer of type `symbol`.*/


  addSymbolLayer(id, props, before) {}
  /** Adds a layer of type `video`.*/


  addVideoLayer(id, props, before) {}
  /** Adds a layer of type `raster`.*/


  addRasterLayer(id, props, before) {}
  /** Adds a layer of type `fill-extrusion`.*/


  addFillExtrusionLayer(id, props, before) {}
  /** Adds a layer of type `heatmap`.*/


  addHeatmapLayer(id, props, before) {}
  /** Adds a layer of type `hillshade`.*/


  addHillshadeLayer(id, props, before) {}
  /** Create a GeoJSON layer. */


  addGeoJSONSource(id, geojson = {
    type: 'FeatureCollection',
    features: []
  }, props) {
    return this.addSource(id, {
      type: 'geojson',
      data: geojson,
      ...props
    });
  }

  addGeoJSON(id, geojson = {
    type: 'FeatureCollection',
    features: []
  }, props) {
    return this.addGeoJSONSource(id, geojson, props);
  }

  addSource(id, sourceDef) {
    const style = this.map.getStyle();
    style.sources[id] = sourceDef;
    this.map.setStyle(style);
    return this._makeSource(id);
  }

  layersBySource(source) {
    return this.map.getStyle().layers.filter(l => l.source === source).map(l => l.id);
  }
  /** Adds a `vector` source
  @param sourceId ID of the new source.
  @param {string} [data] Optional URL of source tiles (.../{z}/{x}/{y}...), mapbox:// URL or TileJSON endpoint.
  @param {object} props Properties defining the source, per the style spec.
   @example addVector('mysource', 'http://example.com/tiles/{z}/{x}/{y}.pbf', { maxzoom: 13 });
  */


  addVectorSource(sourceId, props, extraProps = {}) {
    if (typeof props === 'string') {
      if (props.match(/\{z\}/)) {
        return this.addSource(sourceId, { ...extraProps,
          type: 'vector',
          tiles: [props]
        });
      } else {
        // mapbox://, http://.../index.json
        return this.addSource(sourceId, { ...extraProps,
          type: 'vector',
          url: props
        });
      }
    } else {
      return this.addSource(sourceId, { ...props,
        type: 'vector'
      });
    }
  }

  addVector(sourceId, props, extraProps = {}) {
    return this.addVectorSource(sourceId, props, extraProps);
  }
  /** Adds a `raster` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */


  addRasterSource(sourceId, props) {
    return this.addSource(sourceId, { ...props,
      type: 'raster'
    });
  }
  /** Adds a `raster-dem` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */


  addRasterDemSource(sourceId, props) {
    return this.addSource(sourceId, { ...props,
      type: 'raster-dem'
    });
  }
  /** Adds a `raster` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */


  addRasterSource(sourceId, props) {
    return this.addSource(sourceId, { ...props,
      type: 'raster'
    });
  }
  /** Adds an `image` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */


  addImageSource(sourceId, props) {
    return this.addSource(sourceId, { ...props,
      type: 'image'
    });
  }
  /** Adds a `video` source
  @param sourceId ID of the new source.
  @param {object} props Properties defining the source, per the style spec.
  */


  addVideoSource(sourceId, props) {
    return this.addSource(sourceId, { ...props,
      type: 'video'
    });
  }
  /** Sets a paint or layout property on one or more layers.
  @example setProperty(['buildings-fill', 'parks-fill'], 'fillOpacity', 0.5)
  */


  /** Converts a set of properties in pascalCase or kebab-case into a layer objectwith layout and paint properties. */
  properties(props) {
    if (!props) {
      return undefined;
    }

    const out = {},
          which = {
      paint: {},
      layout: {},
      other: {}
    };
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
  } // layerStyle([id,] [source,] [type,] props)
  // TODO somehow make this type safe.


  layerStyle(...args) {
    const [id, source, type] = args;
    const props = args.find(arg => typeof arg === 'object' && !Array.isArray(arg));
    const ret = typeof props === 'object' ? this.properties(props) || {} : {};
    if (typeof id === 'string') ret.id = id;
    if (typeof source === 'string') ret.source = source;
    if (typeof type === 'string') ret.type = type;
    return ret;
  }
  /** Gets the layer definition for a given layer id, as per the style spec..
   */


  getLayerStyle(layerId) {
    return this.map.getStyle().layers.find(l => l.id === layerId);
  }

  /** Replaces the current data for a GeoJSON layer.
  @param sourceId Id of the source being updated.
  @param {GeoJSON} [data] GeoJSON object to set. If not provided, defaults to an empty FeatureCollection.
  */
  setData(sourceId, data = {
    type: 'FeatureCollection',
    features: []
  }) {
    this.map.getSource(sourceId).setData(data);
  }
  /** Makes the given layers visible.
  @param {string|Array<string>|RegExp|function} Layer to toggle.
  */


  /** Callback that fires when map loads, or immediately if map is already loaded.
  @returns {Promise} Promise, if callback not provided.
  */
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
  }
  /** Set a property on the style's root, such as `light` or `transition`. */


  setRootProperty(propName, val) {
    const style = this.map.getStyle();
    style[kebabCase(propName)] = val;
    this.map.setStyle(style);
  }
  /** Sets root transition property.
  @example setTransition({ duration: 500, delay: 100 })
  */


  setTransition(val) {
    this.setRootProperty('transition', val);
  }
  /** Adds an image for use as a symbol layer, from a URL.
  @example loadImage('marker', '/assets/marker-pin@2x.png', { pixelRatio: 2})
  */


  loadImage(id, url, options) {
    if (typeof url === 'string'
    /* && url.match(/\.[a-z]+$/)*/
    ) {
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

  lockOrientation() {
    this.map.touchZoomRotate.disableRotation();
    this.map.dragRotate.disable();
  }
  /** Gets array of font names in use, determined by traversing style. Does not detect fonts in all possible situations.
  @returns {Array[string]}  */


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
    const fontExprs = this.map.getStyle().layers.map(l => l.layout && l.layout['text-font']).filter(Boolean);

    for (const fontExpr of fontExprs) {
      // if top level expression is an array of strings, it's hopefully ['Arial', ...] and not ['get', 'font']
      if (fontExpr.stops) {
        // old-school base/stops
        // TODO verify we have got all the cases
        try {
          fonts.push(...fontExpr.stops.flat().filter(Array.isArray).flat());
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

  _makeSource(sourceId) {
    // returns an object on which we can call .addLine() etc.
    const out = new MapGlUtils();
    out.map = this.map;
    out._mapgl = this._mapgl;
    layerTypes.forEach(function (type) {
      makeAddLayer(type, out, sourceId);
    });
    return out;
  }

} // idempotent version


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

  const upType = upperCamelCase(layerType); //$FlowFixMe[prop-missing]

  obj[`add${upType}`] = func; //$FlowFixMe[prop-missing]

  obj[`add${upType}Layer`] = func;
}; // Object.assign(Utils.prototype, UtilsExtra);


function initClass(U) {
  const makeSetProp = (prop, setPropFunc) => {
    const funcName = 'set' + upperCamelCase(prop); //$FlowFixMe[prop-missing]

    U[funcName] = arrayify(function (layer, value) {
      return this.map[setPropFunc](layer, prop, value);
    });
  };

  const makeGetProp = (prop, getPropFunc) => {
    const funcName = 'get' + upperCamelCase(prop); //$FlowFixMe[prop-missing]

    U[funcName] = arrayify(function (layer) {
      return this.map[getPropFunc](layer, prop);
    });
  };


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
