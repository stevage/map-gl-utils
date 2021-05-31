import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import flow from 'rollup-plugin-flow';
export default [
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/index.esm.js',
                format: 'esm', // ES2015 modules version so consumers can tree-shake
            },
        ],
        plugins: [flow(), commonjs(), nodeResolve()],
    },
];
