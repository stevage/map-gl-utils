const v8 = require('@mapbox/mapbox-gl-style-spec/reference/v8.json');
const fs = require('fs');
const out = {
    paints: [],
    layouts: []
};
Object.keys(v8)
    .filter(x => /^paint_/.test(x))
    .forEach(key => out.paints.push(...Object.keys(v8[key])));

Object.keys(v8)
    .filter(x => /^layout_/.test(x))
    .forEach(key => out.layouts.push(...Object.keys(v8[key])));
    
out.paints = Array.from(new Set(out.paints));
out.layouts = Array.from(new Set(out.layouts));
fs.writeFileSync('keys.json', JSON.stringify(out));