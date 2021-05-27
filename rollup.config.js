import { terser } from 'rollup-plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import flow from 'rollup-plugin-flow';
export default [
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/index.js',
                format: 'umd', // UMD version for browser
                name: 'U',
                plugins: [babel({ babelHelpers: 'bundled' })],
            },
            {
                file: 'dist/index.min.js',
                format: 'umd', // minified UMD version for browser
                name: 'U',
                plugins: [terser(), babel({ babelHelpers: 'bundled' })],
            },
            {
                file: 'dist/index.esm.js',
                format: 'esm', // ES2015 modules version so consumers can tree-shake
            },
        ],
        plugins: [flow(), commonjs(), nodeResolve()],
    },
];
