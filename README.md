# node-trace-log-join

Easily combine multiple node_trace files into a single one

```
npm install @clinic/node-trace-log-join
```

[![Build Status](https://travis-ci.org/mafintosh/node-trace-log-join.svg?branch=master)](https://travis-ci.org/mafintosh/node-trace-log-join)

## Usage

``` js
var join = require('@clinic/node-trace-log-join')

join('node_trace.*.log', 'combined.log', function (err) {
  if (err) throw err
  console.log('All node_trace.*.log files have been combined into combined.log')
})
```

## API

#### `join(files, output, [callback])`

Combines all trace files into the output file and calls the callback.
All files are combined in a streaming fashion so the memory footprint is pretty small.

Alternatively you can pass a file pattern instead of the the files array.

After the files are combined, the input files are unlinked as well.

## License

MIT
