import babel from '@rollup/plugin-babel';
import ts from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.esm.js',
                format: 'esm', // ES2015 modules version so consumers can tree-shake
            },
        ],
        plugins: [
            nodeResolve(),
            ts({
                declarationDir: 'dist/types',
            }),
            json(),
            babel({
                babelHelpers: 'bundled',
                plugins: ['@babel/plugin-proposal-class-properties'],
                presets: ['@babel/preset-typescript'],
            }),
        ],
    },
];
