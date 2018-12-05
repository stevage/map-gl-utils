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
        try {
            return jamSession.formulaToExpression(args[0].raw[0]);
        } catch (e) {
            console.log('whoa');
            console.error(e);
        }
    } // else what?
}

function parseSource(source) {
    if (String(source).match('\.(geo)?json') || source.type === 'Feature' || source.type === 'FeatureCollection') {
        return {
            type: 'geojson',
            data: source
        }
    } else {
        return source;
    }
}

utils.init = function(map, directlyIntegrate = false) {
    Object.assign(this, {
        hoverPointer(layers) {
            if (typeof layers === 'string') {
                layers = [layers];
            }
            map.on('mousemove',e => {
                const f = map.queryRenderedFeatures(e.point, {
                    layers: layers
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
        }, 
        setProperty(layer, prop, value) {
            if (typeof prop === 'object') {
                Object.keys(prop).forEach(k => this.setProperty(layer, k, prop[k]));
            } else {
                const kprop = kebabCase(prop);
                const fn = isPaintProp(kprop) ? 'setPaintProperty' : 'setLayoutProperty';
                map[fn](layer, kprop , value);
            }
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
        }, onLoad(cb) {
            if (map.loaded()) {
                cb();
            } else {
                map.on('load', cb);
            }
        }
    });
    
    map.U = this;
    if (directlyIntegrate) {
        Object.assign(map, this);
    }
    return this;
}

module.exports = utils;