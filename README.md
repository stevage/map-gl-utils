### Mapbox-gl-utils

Utility functions for Mapbox-GL-JS.

```
require(mapbox-gl-utils)(map);

// Use the mouse 'finger' cursor when hovering over this layer.
map.U.hoverPointer('mylayer'); 

// Set a property without worrying about whether it's a paint or layout property.
map.U.setProp('mylayer', 'line-width', 3);

// Set several properties without worrying about whether they're paint or layout
map.U.setProp('mylayer', {
    'line-width': 3,
    'line-color': 'red'
});

// Also supports camelCase
map.U.setProp('mylayer', {
    lineWidth: 3,
    lineColor: 'red'
});
```

