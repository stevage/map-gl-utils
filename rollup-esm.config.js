import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/index.esm.js',
                format: 'esm', // ES2015 modules version so consumers can tree-shake
            },
        ],
        plugins: [
            nodeResolve(),
            babel({
                babelHelpers: 'bundled',
                plugins: ['@babel/plugin-proposal-class-properties'],
                presets: ['@babel/preset-flow'],
            }),
        ],
    },
];
