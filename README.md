## Mapbox-GL-Utils

Mapbox-GL-Utils adds a number of itility functions and syntactic sugar to a Mapbox-GL-JS map instance. If you write a lot of Mapbox-GL-JS code, you may appreciate the more concise form, and simpler API.

Major features:

* Paint, layout and other properties are all merged.
* All properties can be expressed as camelCase rather than kebab-case.
* Layer operations can act on an array of layers, not just one.
* Source types, layer types and property names are incorporated into function names: `addGeoJSON()`, `addCircle()`, `setCircleRadius()`
* Some other convenience functions: `show()`, `onLoad()`, `update()`, `hoverPointer()`

```js
// Adds U property to map, containing these methods.
const U = require('mapbox-gl-utils').init(map);
```

### Adding layers

```js
// Conveniently add a line feature, mixing paint, layout and other properties.
// Notice you can use camelCase for all property names.
map.U.addLine('mylines', 'mysource', { 
    lineWidth: 3, 
    lineCap: 'round',
    minzoom: 11 
});
map.U.addCircle('mycircles', 'mysource', { circleStrokeColor: 'red' });
// Also addFill, addFillExtrusion, addRaster, addVideo, addSymbol, addHillshade, addHeatmap

// You can sneakily create a datasource (with the same id), by passing in...
// ...a URL to a GeoJSON
map.U.addLine('mylayer', 'my.geojson');

// ... a GeoJSON as a data structure
const geojson = { type: 'Feature', ... };
map.U.addLine('mylayer', geojson);

// ...or a vector tile source hosted on Mapbox.
map.U.addLine('mylayer', 'mapbox://myuser.aoeuaoeu12341234');
```

### Adding sources

```js
// Simpler way to create GeoJSON source:
map.U.addGeoJSON('mysource', geojson);

// Or create a GeoJSON source with initially blank data:
map.U.addGeoJSON('mysource');

// Simpler ways to create a vector tile source:
map.U.addVector('mysource', 'mapbox://foo.blah');
map.U.addVector('mysource', 'https://example.com/tiles/{z}/{x}/{y}.pbf');

// There's also addRaster(), addRasterDem(), addImage(), addVideo()
```

### Setting properties and updating data

```js
// Every property has a setXxx() form:
map.U.setTextSize('mylayer', 12);

// And they all work on multiple layers at once:
map.U.setLineWidth(['mylayer', 'mylayer-highlight'], 4);

// There's also a more familiar setProperty() form.
map.U.setProperty('mylayer', 'line-width', 3);
map.U.setProperty('mylayer', {
    'text-size': 12,
    'text-color': 'red'
});
map.U.setProperty('mylayer', {
    textSize: 12,
    textColor: 'red'
});

// Simpler way to update source data:
map.U.update('mysource', data);

// Easier to remember way to turn layers on and off:
map.U.show('mylayer');
map.U.hide('mylayer');
map.U.toggle(['mylayer', 'myotherlayer'], isVisible);
```

### Other functions

```js
// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer'); 

// Like on('load') but fires immediately (and reliably) any time after map already loaded.
map.U.onLoad(callback);

// properties() converts an object to a properties object accepted by Mapbox-GL-JS
map.addLayer(map.U.properties({
    id: 'mylayer',
    source: 'mysource',
    type: 'line',
    lineWidth: 3,
    lineCap: 'round',
    minzoom: 11,
    filter: ['==', 'status', 'confirmed']
}));

// Seamlessly incorporate [Jam Session](https://github.com/mapbox/expression-jamsession) expressions:
const U = require('mapbox-gl-utils').init(map);
map.U.addLine('mylines', 'mysource', { 
    lineWidth: U`get("size") + 3`
});
```

### Contrived example
```js
map.U.onload(() => {
    map.U.addGeoJSON('towns');
    map.U.addCircle('small-towns', 'towns', { circleColor: 'green', filter: U`"size" == "small"`});
    map.U.addCircle('large-towns', 'towns', { circleColor: 'red', filter: U`"size" == "large"`});
    map.U.setCircleRadius(['small-towns', 'large-towns'], 12);
    map.U.hoverPointer(['small-towns', 'large-towns']);
    // update the source layer when data is available
    d3.json('http://example.com/towns.json', data => map.U.update('towns', data);
});


```


