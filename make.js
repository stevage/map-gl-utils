/*
Generates the list of paint and layout properties from the Mapbox-GL-JS style spec.
Should be run when new properties are added to that spec.
*/

const v8 = require('@mapbox/mapbox-gl-style-spec/reference/v8.json');
const fs = require('fs');
const styleSpecVersion = require('./node_modules/@mapbox/mapbox-gl-style-spec/package.json').version;
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
const outFile = 'dist/keys.json';
fs.writeFileSync(outFile, JSON.stringify(out));

console.log(`Wrote updated ${outFile} based on Mapbox-GL style spec ${styleSpecVersion}.`);