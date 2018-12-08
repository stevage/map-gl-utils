### Mapbox-GL-Utils

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

// Set a property without worrying about whether it's a paint or layout property.
map.U.setProperty('mylayer', 'line-width', 3);

// Set several properties without worrying about whether they're paint or layout
map.U.setProperty('mylayer', {
    'text-size': 12,
    'text-color': 'red'
});

// Also supports camelCase
map.U.setProperty('mylayer', {
    textSize: 12,
    textColor: 'red'
});

// Or mix paint, layout, and other properties
map.addLayer(map.U.properties({
    id: 'mylayer',
    source: 'mysource',
    type: 'line',
    lineWidth: 3,
    lineCap: 'round',
    minzoom: 11,
    filter: ['==', 'status', 'confirmed']
}));

// Or even:
map.U.setTextSize('mylayer', 12);

// Or multiple layers at once:
map.U.setLineWidth(['mylayer', 'mylayer-highlight'], 4);

// More streamlined way to add map layers:
map.U.add('mylayer', 'mysource', 'line', { lineWidth: 3, minzoom: 11 });

// And even more streamlined:
map.U.addLine('mylines', 'mysource', { lineWidth: 3, minzoom: 11 });
map.U.addCircle('mycircles', 'mysource', { circleStrokeColor: 'red' });

// Sneakily incorporate GeoJSONs by URL
map.U.add('mylayer', 'my.geojson', 'line');

// Or by data structure
const geojson = { type: 'Feature', ... };
map.U.add('mylayer', geojson, 'line');

// Seamlessly incorporate [Jam Session](https://github.com/mapbox/expression-jamsession) expressions:
const U = require('mapbox-gl-utils').init(map);
map.U.addLine('mylines', 'mysource', { 
    lineWidth: U`get("size") + 3`
});

// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer'); 

// Like on('load') but fires immediately if map already loaded.
map.U.onLoad(callback)

// Simpler way to create GeoJSON source:
map.U.addGeoJSON('mysource', geojson);

// Or create a GeoJSON source with initially blank data:
map.U.addGeoJSON('mysource');

// Simpler way to update source data:
map.U.update('mysource', data);

// Easier to remember way to turn layers on and off:
map.U.show('mylayer');
map.U.hide('mylayer');
map.U.toggle(['mylayer', 'myotherlayer'], isVisible);

// If you don't mind mixing namespaces, you can integrate the functions directly onto the map object.
// This is probably a terrible idea.
const U = require('mapbox-gl-utils').init(map, true);
map.setProperty('mylayer', 'lineWidth', 3);
```

### Contrived example
```js
map.U.onload(() => {
    map.U.addGeoJSON('towns');
    map.U.addCircle('small-towns', 'towns', { circleColor: 'green', filter: U`"size" == "small"`});
    map.U.addCircle('large-towns', 'towns', { circleColor: 'red', filter: U`"size" == "large"`});
    map.U.setData('towns', townData);
    map.U.setCircleRadius(['small-towns', 'large-towns'], 12);
    map.U.hoverPointer(['small-towns', 'large-towns']);
});

```


