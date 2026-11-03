const parser = require('@clinic/trace-events-parser')
const fs = require('fs')
const path = require('path')
const {pipeline, Readable, Transform} = require('stream')

module.exports = nodeTraceJoin

function nodeTraceJoin (pattern, output, cb) {
  if (!cb) cb = noop
  if (Array.isArray(pattern)) return combine(pattern)

  const dir = path.dirname(pattern)
  const filePattern = path.basename(pattern).split('*')

  fs.readdir(dir, function (err, files) {
    if (err) return cb(err)
    files = files.filter(filterPattern).sort(sort).map(file => path.join(dir, file))
    combine(files)
  })

  function combine (files) {
    if (!files.length) return cb(notFound('No files matching the pattern found'))
    if (files.length === 1) return fs.rename(files[0], output, cb)

    pipeline(
      Readable.from(readFiles(files)),
      stringify(),
      fs.createWriteStream(output),
      onunlink
    )

    function onunlink (err) {
      if (err) return cb(err)

      let missing = files.length
      let error = null

      for (let i = 0; i < files.length; i++) fs.unlink(files[i], done)

      function done (err) {
        if (err && err.code !== 'ENOENT') error = err
        if (--missing) return
        cb(error)
      }
    }
  }

  function filterPattern (file) {
    let offset = 0
    for (let i = 0; i < filePattern.length; i++) {
      const next = file.indexOf(filePattern[i], offset)
      if (next === -1) return false
      offset = next + filePattern[i].length
    }
    if (filePattern[filePattern.length - 1]) {
      if (offset !== file.length) return false
    }
    return true
  }
}

function notFound (msg) {
  const err = new Error(msg)
  err.code = 'ENOENT'
  err.status = 404
  err.notFound = true
  return err
}

function index (n) {
  const m = n.match(/node_trace\.(\d+)\.log/)
  if (m) return Number(m[1])
  return 0
}

function sort (a, b) {
  const ai = index(a)
  const bi = index(b)
  if (ai && bi) return ai - bi
  if (a === b) return 0
  return a < b ? -1 : 1
}

function stringify () {
  let sep = false

  const s = new Transform({
    writableObjectMode: true,
    transform: write,
    flush
  })
  s.push('{"traceEvents":[')
  return s

  function write (data, enc, cb) {
    const s = sep ? ',' : ''
    sep = true
    cb(null, s + JSON.stringify(data))
  }

  function flush (cb) {
    this.push(']}')
    cb(null)
  }
}

function parse (filename) {
  return pipeline(fs.createReadStream(filename), parser(), noop)
}

async function * readFiles (files) {
  for (const filename of files) {
    for await (const event of parse(filename)) yield event
  }
}

function noop () {}
