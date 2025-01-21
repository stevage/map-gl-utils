import { terser } from 'rollup-plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import ts from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
export default [
    {
        input: 'src/index.ts',
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
            commonjs(),
            nodeResolve(),
            ts({
                declarationDir: 'umd/types',
            }),
            json(),
            babel({
                babelHelpers: 'bundled',
                presets: [['@babel/preset-env'], ['@babel/preset-typescript']],
            }),
        ],
    },
];
