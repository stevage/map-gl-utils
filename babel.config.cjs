module.exports = {
    plugins: [
        '@babel/plugin-proposal-class-properties',
        ...(process.env.NODE_ENV === 'test'
            ? ['@babel/plugin-transform-modules-commonjs']
            : []),
    ],
};
