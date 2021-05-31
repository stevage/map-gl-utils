To use without any build process:

```html
<script src="https://unpkg.com/mapbox-gl-utils"></script>
```

then

```js
U.init(map)
```

With Webpack etc:

```js
const mapgl = require('maplibre-gl'); // or require('mapbox-gl');
const map = new mapgl.Map({ ... });

// or:
import U from 'mapbox-gl-utils';
U.init(map);

// A small number of methods (eg hoverPopup) require access to the maplibre-gl/mapbox-gl library itself, in order to instantiate other objects.
require('mapbox-gl-utils').init(map, mapgl);
```

The default distribution is an ES2015 module with no transpiling. If you experience any syntax issues (such as using older JavaScript versions), use the UMD bundle instead:

```js
// Adds U property to map, containing these methods.
require('mapbox-gl-utils/umd').init(map);
```

