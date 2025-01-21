/*
Generates the list of paint and layout properties from the Mapbox-GL-JS style spec.
Should be run when new properties are added to that spec.
*/
import fs from 'fs';
// const kebabCase = s => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
const upperCamelCase = s =>
    s.replace(/(^|-)([a-z])/g, (x, y, l) => `${l.toUpperCase()}`);

// write a typescript file
function writeLayerTypeDefs(fileName, propNames) {
    let out = '';
    out += '// Automatically generated type file. \n';
    out += `export type UtilsLayerDef = Partial<Record<\n`;
    out += propNames.map(p => `  '${upperCamelCase(p)}' `).join('|\n');
    out += '|\n';
    out += propNames.map(p => `  '${p}' `).join('|\n');
    out += ', any>>\n';
    fs.writeFileSync(fileName, out);
}

function writeUtilsFuncsTS(fileName, propNames) {
    function setFunc(propName) {
        return `  set${upperCamelCase(
            propName
        )}: (layer: LayerRef, value: any) => void`;
    }
    function getFunc(propName) {
        return `  get${upperCamelCase(propName)}: (layer: LayerRef) => any`;
    }
    let out = '';
    out += '// Automatically generated type file. \n';
    out += `import type { LayerRef } from './index';\n`;
    out += `export interface UtilsFuncs {\n`;
    out += propNames.map(setFunc).join(',\n') + `,\n`;
    out += propNames.map(getFunc).join(',\n') + `\n`;
    out += `}`;
    fs.writeFileSync(fileName, out);
}

// writes a fake JS library just for generating documentation
function writeUtilsFuncsJS(fileName, paints, layouts) {
    function setFunc(propName, type) {
        return `
          /** Sets the \`${propName}\` ${type} property for one or more layers. */
          set${upperCamelCase(
              propName
          )} (layer: LayerRef, value: any): void {}`;
    }
    function getFunc(propName, type) {
        return `
          /** Gets the \`${propName}\` ${type} property for a layer. */
          get${upperCamelCase(propName)} (layer: LayerRef): any {}`;
    }
    let out = '';
    out += '// Automatically generated for documentation.';
    out += `import type { LayerRef } from './index';\n`;
    out += `export const UtilsFuncs = {\n`;
    out += paints.map(p => setFunc(p, 'paint')).join(',\n') + `,\n`;
    out += layouts.map(p => setFunc(p, 'layout')).join(',\n') + `,\n`;
    out += paints.map(p => getFunc(p, 'paint')).join(',\n') + `\n,`;
    out += layouts.map(p => getFunc(p, 'layout')).join(',\n') + `\n`;
    out += `}`;
    fs.writeFileSync(fileName, out);
}

const styleSpec = JSON.parse(
    fs.readFileSync(
        './node_modules/@mapbox/mapbox-gl-style-spec/reference/v8.json'
    )
);
// import styleSpec from '@mapbox/mapbox-gl-style-spec/reference/v8.json';
const styleSpecVersion = JSON.parse(
    fs.readFileSync('./node_modules/@mapbox/mapbox-gl-style-spec/package.json')
).version;

// import { styleSpecVersion } from './node_modules/@mapbox/mapbox-gl-style-spec/package.json';
const out = {
    paints: [],
    layouts: [],
};
Object.keys(styleSpec)
    .filter(x => /^paint_/.test(x))
    .forEach(key => out.paints.push(...Object.keys(styleSpec[key])));

Object.keys(styleSpec)
    .filter(x => /^layout_/.test(x))
    .forEach(key => out.layouts.push(...Object.keys(styleSpec[key])));

out.paints = Array.from(new Set(out.paints));
out.layouts = Array.from(new Set(out.layouts));

const outFileES = 'src/keys-js.js';
// fs.writeFileSync(outFileES, 'export default ' + JSON.stringify(out));
fs.writeFileSync(
    outFileES,
    `
export default {
    paints: '${out.paints.join(',')}'.split(','),
    layouts: '${out.layouts.join(',')}'.split(','),
}`
);
writeUtilsFuncsTS('src/utilsGenerated.ts', [...out.paints, ...out.layouts]);
writeUtilsFuncsJS('src/utilsGenerated.js', out.paints, out.layouts);
writeLayerTypeDefs('src/layerTypeDefsGenerated.ts', [
    ...out.paints,
    ...out.layouts,
]);
console.log(
    `Wrote updated ${outFileES} based on Mapbox-GL style spec ${styleSpecVersion}.`
);
