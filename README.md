[![NPM](https://nodei.co/npm/mapbox-gl-utils.png)](https://nodei.co/npm/mapbox-gl-utils/)

## Mapbox-GL-Utils

Mapbox-GL-Utils adds a number of utility functions and syntactic sugar to a Mapbox-GL-JS map instance. If you write a lot of Mapbox-GL-JS code, you may appreciate the more concise form, and simpler API.

Major features:

* No need to distinguish between paint, layout and other properties.
* All properties can be expressed as camelCase rather than kebab-case.
* Layer operations can act on an array of layers, not just one.
* Source types, layer types and property names are incorporated into function names: `addGeoJSON()`, `addCircle()`, `setCircleRadius()`...
* Some other convenience functions: `show()`, `hide()`, `onLoad()`, `setData()`,
* Better click and hover functions: `hoverPointer()`, `hoverFeatureState()`, `hoverPopup()`, `clickLayer()`
* Some functions behave better: `removeLayer()` (not an error if layer doesn't exist), `removeSource()` (removes attached layers automatically), `setFilter()` (works on multiple layers at once)

```js
// Adds U property to map, containing these methods.
const U = require('mapbox-gl-utils').init(map);

// Certain methods (eg hoverPopup) require access to the mapboxgl library itself
const mapboxgl = require('mapbox-gl');
const U = require('mapbox-gl-utils').init(map, mapboxgl);

```

### Adding and removing layers

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

// and of course add the layer "before" another layer if needed:
map.U.addLine('mylayer', 'mysource', { lineColor: 'red' }, 'toplayer');

// removeLayer() doesn't throw errors if the layers don't exist
map.U.removeLayer(['towns','town-labels']);
```

### Adding and removing sources

```js
// Simpler way to create GeoJSON source:
map.U.addGeoJSON('mysource', geojson);

// Or create a GeoJSON source with initially blank data. This is very convenient if you're loading 
// the data separately and will call .setData() later.
map.U.addGeoJSON('mysource');

// Simpler ways to create a vector tile source:
map.U.addVector('mysource', 'mapbox://foo.blah');
map.U.addVector('mysource', 'https://example.com/tiles/{z}/{x}/{y}.pbf');

// Additional properties still work
map.U.addVector('mysource', 'https://example.com/tiles/{z}/{x}/{y}.pbf', { maxzoom: 13 });

// There's also addRaster(), addRasterDem(), addImage(), addVideo()


// Automatically removes any layers using these sources. Not an error if sources don't exist.
map.U.removeSource(['buildings', 'roads']);

// You can also use the returned object to add layers conveniently:
map.U.addGeoJSON('buildings', 'data/buildings.geojson')
    .addFillExtrusion('buildings-3d', {
        fillExtrusionHeight: 100,
        fillExtrusionColor: 'grey'
    }).addLine('buildings-footprint', {
        lineColor: 'lightblue'
    });

// Replace the source on an existing layer. (Actually removes and re-adds it.)
map.U.setLayerSource('buildings', 'newsource');
map.U.setLayerSource(['buildings-3d', 'buildings-outline]', 'newsource', 'newsourcelayer');

// To change the source layer, pass a third argument, or null to clear it (if switching from vector tiles to geojson)
map.U.setLayerSource('buildings', 'mylocalbuildings', null);
```

### Setting properties and updating data

```js
// Every property has a setXxx() form:
map.U.setTextSize('mylayer', 12);

// And they all work on multiple layers at once:
map.U.setLineWidth(['mylayer', 'mylayer-highlight'], 4);

// There's also a more familiar setProperty() form.
map.U.setProperty('mylayer', 'line-width', 3);
// Existing properties aren't touched
map.U.setProperty('mylayer', {
    textSize: 12,
    textColor: 'red'
});

// Simpler way to update source data:
map.U.setData('mysource', data);

// Easier to remember way to turn layers on and off:
map.U.show('mylayer');
map.U.hide('mylayer');
map.U.toggle(['mylayer', 'myotherlayer'], isVisible);

// To avoid name clashes such as with 'raster', you can use a longer form ending
// with either ...Layer() or ...Source()

map.U.addRasterSource('myrastersource', { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 256 });
map.U.addRasterLayer('myrasterlayer', 'myrastersource', { rasterSaturation: 0.5 });
```

### Hovering and clicking

```js
// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer');

// Sets a "hover" feature-state to be true or false as the mouse moves over features in this layer.
// Requires that features have an `id`.
map.U.hoverFeatureState('mylayer');

// Want to apply the hover feature-state to a different source?
// For instance, you hover over a label, but want to highlight the surrounding boundary.
map.U.hoverFeatureState('town-labels', 'boundaries', 'town-boundaries');

// You can also add additional event handlers:
map.U.hoverFeatureState('mylayer', 'mysource', 'mysourcelayer',
    e => console.log(`Entered ${e.features[0].id}`),
    e => console.log(`Left ${e.oldFeatureid}`);

// Shows a popup when a feature is hovered over or clicked. 
// The third argument is an options object, passed to the Popup constructor.
// callback is called as: (feature, popup) => htmlString
// Make sure you passed the mapboxgl library itself when initialising: U.init(map, mapboxgl).
map.U.hoverPopup('mylayer', f => `<h3>${f.properties.Name}</h3> ${f.properties.Description}`, { anchor: 'left' });
map.U.clickPopup('mylayer', f => `<h3>${f.properties.Name}</h3> ${f.properties.Description}`, { maxWidth: 500 });

// clickLayer() is like .on('click)', but can take an array and adds a 'features' member
// to the event, for what got clicked on.
map.U.clickLayer(['towns', 'town-labels'], e => panel.selectedId = e.features[0].id);

// clickOneLayer tests multiple layers in order, firing callback on the first one that
// is hit. The callback is passed { feature, features, layer, event }.
map.U.clickOneLayer(['town-labels', 'state-boundaries'], e => {
    if (e.layer === 'town-labels') {
        setView('town');
        panel.selectedId = e.features[0].id;
    } else if (e.layer === 'state-boundaries') {
        setView('state');
        panel.selectedId = e.features[0].id;
    }
});

// Optionally pass in an extra callback which is fired for clicks that miss all layers:
map.U.clickOneLayer(['town-labels', 'state-boundaries'], e => {...}, e => {
    console.log('Missed everything');
});

// All these functions return an "undo" function that removes the handlers added:
const remove = map.U.hoverPopup('mylayer', showPopupFunc);
//...
remove(); // no more hover popup
```

### Other functions

```js
// Like on('load') but fires immediately (and reliably) any time after map already loaded.
map.U.onLoad(callback);

// Gets the layer definition. Mapbox's `getLayer()` has weird paint and layout properties.
const layer = map.U.getLayerStyle('mylayer');

// Resets all other properties to default first. Ignores non-paint, non-layout properties.
map.setLayerStyle('mylayer', {
    lineWidth: 3
});

// properties() converts an object to a layer object accepted by Mapbox-GL-JS
map.addLayer(map.U.properties({
    id: 'mylayer',
    source: 'mysource',
    type: 'line',
    lineWidth: 3,
    lineCap: 'round',
    minzoom: 11,
    filter: ['==', 'status', 'confirmed']
}));

// layerStyle() is flexible, pass as many or as few of id, source, and type (in that order) as you like:
map.U.layerStyle('mylayer', 'mysource', 'line', { ... })
map.U.layerStyle('mylayer', 'mysource', { ... })
map.U.layerStyle('mylayer', { ... })
map.U.layerStyle({ ... })


// Hide/show/toggle all the layers attached to this source
map.U.hideSource('buildings');
map.U.showSource('buildings');
map.U.toggleSource('buildings', true);

// Update several filters at once.
map.U.setFilter(['buildings-fill', 'buildings-outline', 'buildings-label'], [...]);

// Conveniently load an image into the map in one step
map.U.loadImage('marker', '/assets/marker-pin.png');


// Update the map style's root "transition" property
map.U.setTransition({ delay: 1000, delay: 0});
```

### Contrived example
```js
map.U.onload(() => {
    map.U.addGeoJSON('towns');
    map.U.addCircle('small-towns', 'towns', { circleColor: 'green', filter: U`"size" == "small"`});
    map.U.addCircle('large-towns', 'towns', {
        circleColor: 'red',
        filter: U`"size" == "large"`},
        circleStrokeWidth: ['case', ['to-boolean', ['feature-state', 'hover']], 5, 1]
    );
    map.U.setCircleRadius(['small-towns', 'large-towns'], 12);
    map.U.hoverPointer(['small-towns', 'large-towns']);
    map.U.hoverFeatureState('large-towns');
    // update the source layer when data is available
    d3.json('http://example.com/towns.json', data => map.U.update('towns', data));
});

```
