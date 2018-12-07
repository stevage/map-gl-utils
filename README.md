### Mapbox-GL-Utils

Utility functions and syntactic sugar for Mapbox-GL-JS.

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
};

// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer'); 

// Like on('load') but fires immediately if map already loaded.
map.U.onLoad(callback)

// Simpler way to create GeoJSON source:
map.u.addGeoJSON('mysource', geojson);

// Or create a GeoJSON source with initially blank data:
map.u.addGeoJSON('mysource');

// Simpler way to update source data:
map.U.update('mysource', data);

// If you don't mind mixing namespaces, you can integrate the functions directly onto the map object:

const U = require('mapbox-gl-utils').init(map, true);
map.setProperty('mylayer', 'lineWidth', 3);
```

