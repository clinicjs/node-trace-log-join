const {after, test} = require('node:test')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {Writable} = require('stream')
const join = require('./')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-trace-log-join-'))

after(() => fs.rmSync(tempDir, {recursive: true, force: true}))

test('one file', async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{a: true, d: {}}])
  try {
    const err = await joinFiles('node_trace.1.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}]})
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('multiple files', async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{a: true, d: {}}])
  write('node_trace.2.log', [{b: true, d: {}}])
  write('node_trace.3.log', [{c: true, d: {}}])
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}, {b: true, d: {}}, {c: true, d: {}}]})
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('multiple files as array', async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{a: true, d: {}}])
  write('node_trace.2.log', [{b: true, d: {}}])
  write('node_trace.3.log', [{c: true, d: {}}])
  try {
    const err = await joinFiles(['node_trace.1.log', 'node_trace.2.log'])
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}, {b: true, d: {}}]})
    t.assert.deepStrictEqual(logs().sort(), ['node_trace.3.log', 'output.log'])
  } finally {
    clean()
  }
})

test('lots of files', async function (t) {
  t.plan(3)
  clean()
  const expected = []
  for (var i = 0; i < 15; i++) {
    expected.push({a: i, d: {}})
    write(`node_trace.${i}.log`, [{a: i, d: {}}])
  }
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: expected})
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('no files', async function (t) {
  t.plan(2)
  clean()
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.code, 'ENOENT')
  } finally {
    clean()
  }
})

test('files without trace indexes', async function (t) {
  t.plan(2)
  clean()
  write('trace-a.log', [{a: true, d: {}}])
  write('trace-b.log', [{b: true, d: {}}])
  try {
    const err = await joinFiles('trace-*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}, {b: true, d: {}}]})
  } finally {
    clean()
  }
})

test('missing callback is optional', function (t) {
  t.plan(0)
  join([], path.join(tempDir, 'output.log'))
})

test('directory read errors are returned', async function (t) {
  t.plan(1)
  const err = await joinFiles('missing-directory/node_trace.*.log')
  t.assert.strictEqual(err.code, 'ENOENT')
})

test('suffix must match the end of a filename', async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log.extra', [{a: true, d: {}}])
  fs.writeFileSync(path.join(tempDir, 'unrelated.txt'), '')
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.code, 'ENOENT')
  } finally {
    clean()
  }
})

test('sorts unindexed files in lexical order', async function (t) {
  t.plan(2)
  clean()
  write('trace-z.log', [{z: true, d: {}}])
  write('trace-a.log', [{a: true, d: {}}])
  const readdir = fs.readdir
  fs.readdir = function (dir, cb) {
    process.nextTick(() => cb(null, ['trace-z.log', 'trace-a.log']))
  }
  try {
    const err = await joinFiles('trace-*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}, {z: true, d: {}}]})
  } finally {
    fs.readdir = readdir
    clean()
  }
})

test('duplicate input names compare equal when sorted', async function (t) {
  t.plan(2)
  clean()
  write('node_trace.0.log', [{a: true, d: {}}])
  const readdir = fs.readdir
  fs.readdir = function (dir, cb) {
    process.nextTick(() => cb(null, ['node_trace.0.log', 'node_trace.0.log']))
  }
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), {traceEvents: [{a: true, d: {}}, {a: true, d: {}}]})
  } finally {
    fs.readdir = readdir
    clean()
  }
})

test('write errors are returned', async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log', [{a: true, d: {}}])
  write('node_trace.2.log', [{b: true, d: {}}])
  const createWriteStream = fs.createWriteStream
  fs.createWriteStream = function () {
    return new Writable({write (chunk, enc, cb) { cb(new Error('write failed')) }})
  }
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.message, 'write failed')
  } finally {
    fs.createWriteStream = createWriteStream
    clean()
  }
})

test('unlink errors are returned', async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log', [{a: true, d: {}}])
  write('node_trace.2.log', [{b: true, d: {}}])
  const unlink = fs.unlink
  fs.unlink = function (filename, cb) {
    process.nextTick(() => cb(new Error('unlink failed')))
  }
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.message, 'unlink failed')
  } finally {
    fs.unlink = unlink
    clean()
  }
})

function joinFiles (files) {
  if (Array.isArray(files)) files = files.map(name => path.join(tempDir, name))
  else files = path.join(tempDir, files)
  return new Promise(resolve => join(files, path.join(tempDir, 'output.log'), err => resolve(err)))
}

function logs () {
  return fs.readdirSync(tempDir).filter(f => /\.log$/.test(f))
}

function read (name) {
  return JSON.parse(fs.readFileSync(path.join(tempDir, name)))
}

function clean () {
  logs().forEach(name => fs.unlinkSync(path.join(tempDir, name)))
}

function write (name, json) {
  fs.writeFileSync(path.join(tempDir, name), JSON.stringify({traceEvents: json}))
}
