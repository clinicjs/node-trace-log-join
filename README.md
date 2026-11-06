# node-trace-log-join

Easily combine multiple node_trace files into a single one

```
npm install @clinic/node-trace-log-join
```

[![CI](https://github.com/clinicjs/node-trace-log-join/actions/workflows/ci.yml/badge.svg)](https://github.com/clinicjs/node-trace-log-join/actions/workflows/ci.yml)

## Usage

``` js
var join = require('@clinic/node-trace-log-join')

join('node_trace.*.log', 'combined.log', function (err) {
  if (err) throw err
  console.log('All node_trace.*.log files have been combined into combined.log')
})
```

The callback is optional. You can also pass an array of input filenames:

``` js
join(['node_trace.1.log', 'node_trace.2.log'], 'combined.log', function (err) {
  if (err) throw err
})
```

When a filename pattern is used, matching files are processed in numeric order
for names such as `node_trace.1.log`, `node_trace.2.log`, and so on. Other
matching filenames are processed in lexical order. The output file is excluded
from pattern matches. If no files match, the callback receives an `ENOENT`
error. After a successful join, consumed input files are removed (or renamed
directly when there is only one input file).

## Command line

The package also provides a command-line interface. Pass input files followed
by the output filename:

``` sh
node-trace-log-join node_trace.1.log node_trace.2.log combined.log
```

## API

#### `join(patternOrFiles, output, [callback])`

Combines all trace files into the output file and calls the callback, when one
is supplied. `patternOrFiles` can be a filename pattern containing `*` or an
array of explicit input paths.
All files are combined in a streaming fashion so the memory footprint is pretty small.

## License

MIT
