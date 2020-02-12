### Deprecated

These features will probably be removed. These kinds of shortcuts probably just lead to bad code and poor mental models.

```js
// You can sneakily create a datasource (with the same id), by passing in...
// ...a URL to a GeoJSON
map.U.addLine('mylayer', 'my.geojson');

// ... a GeoJSON as a data structure
const geojson = { type: 'Feature', ... };
map.U.addLine('mylayer', geojson);

// ...or a vector tile source hosted on Mapbox.
map.U.addLine('mylayer', 'mapbox://myuser.aoeuaoeu12341234');


// Seamlessly incorporate [Jam Session](https://github.com/mapbox/expression-jamsession) expressions:
const U = require('mapbox-gl-utils').init(map);
map.U.addLine('mylines', 'mysource', {
    lineWidth: U`get("size") + 3`
});
// JamSession has a couple of major syntax issues that make it more trouble than it's worth, imho.
```