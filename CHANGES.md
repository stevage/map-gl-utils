## Changelog

### 0.40.0
- rename to Map-GL-JS and explicitly support Maplibre GL JS
- add Flow types
- add JSdocs and use documentation.js to make documentation
- change the packaging again, so `dist/index.esm.js` is the default, ES module, and `umd/index.js` is the UMD module.

### 0.39.0
- remove kebab-case dependency

### 0.38.0

- scrapped the CommonJS build. NodeJS is able to handle ES modules these days.
- rewrote the "arrayify" logic
- correctly handle 'hover' transitions across overlapping layers
- probably correctly gives an "off" handler so this kind of thing works:
    `const off = map.U.hoverPointer(['layer1','layer2']); /* ... */ off()`
- more tests

### 0.37.0

- `onLoad()` now returns a promise if no callback provided.

### 0.36.0

- added UMD build so you can use directly in the browser at https://unpkg.com/mapbox-gl-utils or https://unpkg.com/mapbox-gl-utils@0.36.0/dist/index.min.js . https://github.com/stevage/mapbox-gl-utils/issues/27
- added es6 build as "module" parameter in package.json

### 0.35.0

- added `fontsInUse()` function https://github.com/stevage/mapbox-gl-utils/issues/26
- added `getLineColor()`, getTextFont() etc https://github.com/stevage/mapbox-gl-utils/issues/24
- change: `addXLayer()` and `addX()` are now idempotent: call once to add layer/source, again to update. https://github.com/stevage/mapbox-gl-utils/issues/25
- change: allow passing no data to `setData()` https://github.com/stevage/mapbox-gl-utils/issues/19
- bugfix: `addVector()` with extra argument didn't work https://github.com/stevage/mapbox-gl-utils/issues/22
- new change log :)
