const tape = require('tape')
const fs = require('fs')
const path = require('path')
const join = require('./')

clean()

tape('one file', function (t) {
  write('node_trace.1.log', [{a: true}])
  join('node_trace.1.log', 'output.log', function (err) {
    t.error(err, 'no error')
    t.same(read('output.log'), {traceEvents: [{a: true}]})
    t.same(logs(), ['output.log'])
    clean()
    t.end()
  })
})

tape('multiple files', function (t) {
  write('node_trace.1.log', [{a: true}])
  write('node_trace.2.log', [{b: true}])
  write('node_trace.3.log', [{c: true}])
  join('node_trace.*.log', 'output.log', function (err) {
    t.error(err, 'no error')
    t.same(read('output.log'), {traceEvents: [{a: true}, {b: true}, {c: true}]})
    t.same(logs(), ['output.log'])
    clean()
    t.end()
  })
})

tape('multiple files as array', function (t) {
  write('node_trace.1.log', [{a: true}])
  write('node_trace.2.log', [{b: true}])
  write('node_trace.3.log', [{c: true}])
  join(['node_trace.1.log', 'node_trace.2.log'], 'output.log', function (err) {
    t.error(err, 'no error')
    t.same(read('output.log'), {traceEvents: [{a: true}, {b: true}]})
    t.same(logs().sort(), ['node_trace.3.log', 'output.log'])
    clean()
    t.end()
  })
})

tape('lots of files', function (t) {
  const expected = []
  for (var i = 0; i < 15; i++) {
    expected.push(i)
    write(`node_trace.${i}.log`, [i])
  }
  join('node_trace.*.log', 'output.log', function (err) {
    t.error(err, 'no error')
    t.same(read('output.log'), {traceEvents: expected})
    t.same(logs(), ['output.log'])
    clean()
    t.end()
  })
})

tape('no files', function (t) {
  join('node_trace.*.log', 'output.log', function (err) {
    t.ok(err)
    t.same(err.code, 'ENOENT')
    clean()
    t.end()
  })
})

function logs () {
  return fs.readdirSync(__dirname).filter(f => /\.log$/.test(f))
}

function read (name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name)))
}

function clean () {
  logs().forEach(name => fs.unlinkSync(path.join(__dirname, name)))
}

function write (name, json) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify({traceEvents: json}))
}
