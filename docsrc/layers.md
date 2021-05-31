The `props` object passed when adding a layer can freely mix paint, layout and other properties. Property keys can be specified in camelCase or kebab-case:

```js
map.U.addCircleLayer('trees-circle', 'trees', {
    circleColor: 'green', // paint property
    circleRadius: ['interpolate', ['zoom'], 12, 3, 15, 5], // paint property
    circleSortKey: ['get', 'tree-sort-key'], // layout property
    filter: ['!=', 'type', 'stump'], // other property
});
```

Almost every method that works with existing layers (eg, `show()`) can work with multiple layers. There are four ways to specify the layer(s) you want to modify:
  * string: `map.U.show('trees-label'); map.U.show('trees-circle');`
  * array of strings: `map.U.show(['trees-label', 'trees-circle'])`;
  * regular expression: `map.U.show(/^trees-/)`;
  * function that takes a layer, and returns truthy: `map.U.show(layer => layer.source === 'trees');`

