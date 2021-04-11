## Changelog

### 0.35.0

- added `fontsInUse()` function https://github.com/stevage/mapbox-gl-utils/issues/26
- added `getLineColor()`, getTextFont() etc https://github.com/stevage/mapbox-gl-utils/issues/24
- change: `addXLayer()` and `addX()` are now idempotent: call once to add layer/source, again to update. https://github.com/stevage/mapbox-gl-utils/issues/25
- change: allow passing no data to `setData()` https://github.com/stevage/mapbox-gl-utils/issues/19
- bugfix: `addVector()` with extra argument didn't work https://github.com/stevage/mapbox-gl-utils/issues/22
- new change log :)