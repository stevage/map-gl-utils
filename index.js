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
    } else {
        return source;
    }
}

const all = (things, f) =>
    Array.isArray(things) ? things.forEach(f) : f(things);

utils.init = function(map, directlyIntegrate = false) {
    const U = this;
    function makeSetProp(prop, setPropFunc) {
        const funcName = 'set' + prop[0].toUpperCase() + kebabCase.reverse(prop).slice(1);
        U[funcName] = function(layers, value) {
            all(layers, layer =>
                map[setPropFunc](layer, prop, value)
            );
        };
    };

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
        }, addLine(id, source, options) {
            return this.add(id, source, 'line', options);
        }, addFill(id, source, options) {
            return this.add(id, source, 'fill', options);
        }, addCircle(id, source, options) {
            return this.add(id, source, 'circle', options);
        }, addSymbol(id, source, options) {
            return this.add(id, source, 'symbol', options);
        }, addVideo(id, source, options) {
            return this.add(id, source, 'video', options);
        }, addRaster(id, source, options) {
            return this.add(id, source, 'raster', options);
        }, addFillExtrusion(id, source, options) {
            return this.add(id, source, 'fill-extrusion', options);
        }, addHeatmap(id, source, options) {
            return this.add(id, source, 'heatmap', options);
        }, addHillshade(id, source, options) {
            return this.add(id, source, 'hillshade', options);
        },  addGeoJSON(id, geojson = { type: 'FeatureCollection', features: [] }) {
            return map.addSource(id, {
                type: 'geojson',
                data: geojson
            });
        },
        setProperty(layers, prop, value) {
            all(layers, layer => {
                if (typeof prop === 'object') {
                    Object.keys(prop).forEach(k => this.setProperty(layer, k, prop[k]));
                } else {
                    const kprop = kebabCase(prop);
                    const fn = isPaintProp(kprop) ? 'setPaintProperty' : 'setLayoutProperty';
                    map[fn](layer, kprop , value);
                }
            });
        }, properties(props) {
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
        }, show(layers) {
            all(layers, layer => 
                map.setLayoutProperty(layer, 'visibility', 'visible')
            );
        }, hide(layers) {
            all(layers, layer => 
                map.setLayoutProperty(layer, 'visibility', 'none')
            );
        }, toggle(layers, state) {
            all(layers, layer => 
                map.setLayoutProperty(layer, 'visibility', state ? 'visible' : 'none')
            );
        }, onLoad(cb) {
            if (map.loaded()) {
                cb();
            } else {
                map.on('load', cb);
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
    map.U = this;
    if (directlyIntegrate) {
        Object.assign(map, this);
    }
    return this;
}

module.exports = utils;