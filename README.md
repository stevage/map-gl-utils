### Mapbox-gl-utils

Utility functions for Mapbox-GL-JS.

```js
require(mapbox-gl-utils)(map);

// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer'); 

// Set a property without worrying about whether it's a paint or layout property.
map.U.setProperty('mylayer', 'line-width', 3);

// Set several properties without worrying about whether they're paint or layout
map.U.setProperty('mylayer', {
    'line-width': 3,
    'line-color': 'red'
});

// Also supports camelCase
map.U.setProperty('mylayer', {
    lineWidth: 3,
    lineColor: 'red'
});

// If you don't mind mixing namespaces, you can integrate the functions directly onto the map object:

require(mapbox-gl-utils)(map, true);
map.setProperty('mylayer', 'lineWidth', 3);
```

