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
                file: 'umd/index.js',
                format: 'umd', // UMD version for browser
                name: 'U',
            },
            {
                file: 'umd/index.min.js',
                format: 'umd', // minified UMD version for browser
                name: 'U',
                plugins: [terser()],
            },
        ],
        plugins: [
            flow(),
            commonjs(),
            nodeResolve(),
            babel({ babelHelpers: 'bundled' }),
        ],
    },
];
