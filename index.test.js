const { after, test } = require('node:test')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Writable } = require('stream')
const join = require('./')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-trace-log-join-'))

after(() => fs.rmSync(tempDir, { recursive: true, force: true }))

test('one file', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  try {
    const err = await joinFiles('node_trace.1.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }] })
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('multiple files', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  write('node_trace.3.log', [{ c: true, d: {} }])
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }, { b: true, d: {} }, { c: true, d: {} }] })
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('multiple files as array', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  write('node_trace.3.log', [{ c: true, d: {} }])
  try {
    const err = await joinFiles(['node_trace.1.log', 'node_trace.2.log'])
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }, { b: true, d: {} }] })
    t.assert.deepStrictEqual(logs().sort(), ['node_trace.3.log', 'output.log'])
  } finally {
    clean()
  }
})

test('lots of files', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  const expected = []
  for (let i = 0; i < 15; i++) {
    expected.push({ a: i, d: {} })
    write(`node_trace.${i}.log`, [{ a: i, d: {} }])
  }
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: expected })
    t.assert.deepStrictEqual(logs(), ['output.log'])
  } finally {
    clean()
  }
})

test('no files', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    if (!err) throw new Error('Expected no-files error')
    t.assert.strictEqual(err.code, 'ENOENT')
  } finally {
    clean()
  }
})

test('files without trace indexes', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('trace-a.log', [{ a: true, d: {} }])
  write('trace-b.log', [{ b: true, d: {} }])
  try {
    const err = await joinFiles('trace-*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }, { b: true, d: {} }] })
  } finally {
    clean()
  }
})

test('missing callback is optional', /** @param {import('node:test').TestContext} t */ function (t) {
  t.plan(0)
  join([], path.join(tempDir, 'output.log'))
})

test('directory read errors are returned', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(1)
  const err = await joinFiles('missing-directory/node_trace.*.log')
  if (!err) throw new Error('Expected directory read error')
  t.assert.strictEqual(err.code, 'ENOENT')
})

test('suffix must match the end of a filename', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log.extra', [{ a: true, d: {} }])
  fs.writeFileSync(path.join(tempDir, 'unrelated.txt'), '')
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    if (!err) throw new Error('Expected no-files error')
    t.assert.strictEqual(err.code, 'ENOENT')
  } finally {
    clean()
  }
})

test('prefix before the first wildcard must match the filename start', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('prefix-node_trace.2.log', [{ b: true, d: {} }])
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }] })
    t.assert.deepStrictEqual(logs().sort(), ['output.log', 'prefix-node_trace.2.log'])
  } finally {
    clean()
  }
})

test('existing output matching a glob is excluded from inputs', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(3)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  write('node_trace.output.log', [{ old: true, d: {} }])
  try {
    const err = await joinFiles('node_trace.*.log', 'node_trace.output.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('node_trace.output.log'), { traceEvents: [{ a: true, d: {} }, { b: true, d: {} }] })
    t.assert.deepStrictEqual(logs(), ['node_trace.output.log'])
  } finally {
    clean()
  }
})

test('output path in explicit inputs is rejected', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  write('output.log', [{ old: true, d: {} }])
  try {
    const err = await joinFiles(['node_trace.1.log', 'output.log', 'node_trace.2.log'])
    if (!err) throw new Error('Expected input/output collision error')
    t.assert.strictEqual(err.message, 'Output file cannot also be an input file')
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ old: true, d: {} }] })
  } finally {
    clean()
  }
})

test('sorts unindexed files in lexical order', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('trace-z.log', [{ z: true, d: {} }])
  write('trace-a.log', [{ a: true, d: {} }])
  const readdir = fs.readdir
  /**
   * @param {string} dir
   * @param {object} options
   * @param {any} cb
   */
  function mockReaddir (dir, options, cb) {
    process.nextTick(() => cb(null, ['trace-z.log', 'trace-a.log']))
  }
  fs.readdir = /** @type {*} */ (mockReaddir)
  try {
    const err = await joinFiles('trace-*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }, { z: true, d: {} }] })
  } finally {
    fs.readdir = readdir
    clean()
  }
})

test('duplicate input names compare equal when sorted', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('trace-a.log', [{ a: true, d: {} }])
  const readdir = fs.readdir
  /**
   * @param {string} dir
   * @param {object} options
   * @param {any} cb
   */
  function mockReaddir (dir, options, cb) {
    process.nextTick(() => cb(null, ['trace-a.log', 'trace-a.log']))
  }
  fs.readdir = /** @type {*} */ (mockReaddir)
  try {
    const err = await joinFiles('trace-*.log')
    t.assert.ifError(err)
    t.assert.deepStrictEqual(read('output.log'), { traceEvents: [{ a: true, d: {} }, { a: true, d: {} }] })
  } finally {
    fs.readdir = readdir
    clean()
  }
})

test('write errors are returned', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  const createWriteStream = fs.createWriteStream
  fs.createWriteStream = /** @type {*} */ (function () {
    return new Writable({ write (chunk, enc, cb) { cb(new Error('write failed')) } })
  })
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.message, 'write failed')
  } finally {
    fs.createWriteStream = createWriteStream
    clean()
  }
})

test('unlink errors are returned', /** @param {import('node:test').TestContext} t */ async function (t) {
  t.plan(2)
  clean()
  write('node_trace.1.log', [{ a: true, d: {} }])
  write('node_trace.2.log', [{ b: true, d: {} }])
  const unlink = fs.unlink
  /**
   * @param {import('node:fs').PathLike} filename
   * @param {import('node:fs').NoParamCallback} cb
   */
  function mockUnlink (filename, cb) {
    process.nextTick(() => cb(new Error('unlink failed')))
  }
  fs.unlink = /** @type {*} */ (mockUnlink)
  try {
    const err = await joinFiles('node_trace.*.log')
    t.assert.ok(err)
    t.assert.strictEqual(err.message, 'unlink failed')
  } finally {
    fs.unlink = unlink
    clean()
  }
})

/**
 * Runs the public join API against files in the test temporary directory.
 *
 * @param {string|string[]} files Input filename or filenames relative to tempDir.
 * @param {string} [output='output.log'] Output filename relative to tempDir.
 * @returns {Promise<NodeJS.ErrnoException|null>} Join callback error, if any.
 */
function joinFiles (files, output = 'output.log') {
  if (Array.isArray(files)) {
    const names = files
    files = []
    for (const name of names) files.push(path.join(tempDir, name))
  } else {
    files = path.join(tempDir, files)
  }
  return new Promise(resolve => join(files, path.join(tempDir, output), err => resolve(err)))
}

/** @returns {string[]} Log filenames currently in the test directory. */
function logs () {
  const files = fs.readdirSync(tempDir)
  const logFiles = []
  for (const file of files) {
    if (/\.log$/.test(file)) logFiles.push(file)
  }
  return logFiles
}

/** Reads and parses a JSON file from the test directory. @param {string} name */
function read (name) {
  return JSON.parse(fs.readFileSync(path.join(tempDir, name), 'utf8'))
}

/** Removes log files left in the test directory. @returns {void} */
function clean () {
  for (const name of logs()) fs.unlinkSync(path.join(tempDir, name))
}

/** Writes trace events to a fixture log file. @param {string} name @param {object[]} json */
function write (name, json) {
  fs.writeFileSync(path.join(tempDir, name), JSON.stringify({ traceEvents: json }))
}
