Mapbox-GL-Utils adds a number of utility functions and syntactic sugar to a Mapbox GL JS or Maplibre GL map instance. If you write a lot of interactive map code, you may appreciate the more concise form, and simpler API.

Major features:

* No need to distinguish between paint, layout and other properties.
* All properties can be expressed as camelCase rather than kebab-case.
* Layer operations can act on multiple layers (given by array, regex or filter function), not just one.
* Source types, layer types and property names are incorporated into function names: `addGeoJSON()`, `addCircleLayer()`, `setCircleRadius()`, `getTextFont()`...
* Adding layers and sources is idempotent: call `addLineLayer()` multiple times to create, then update the layer.
* Some other convenience functions: `show()`, `hide()`, `onLoad()`, `setData()`, `fontsInUse()`
* Better click and hover functions: `hoverPointer()`, `hoverFeatureState()`, `hoverPopup()`, `clickLayer()`
* Some functions behave better: `removeLayer()` (not an error if layer doesn't exist), `removeSource()` (removes attached layers automatically), `setFilter()` (works on multiple layers at once), `setData()` clears data if no GeoJSON provided.

