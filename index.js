const parser = require('@clinic/trace-events-parser')
const fs = require('fs')
const path = require('path')
const { pipeline, Readable, Transform } = require('stream')

/** @typedef {import('node:fs').NoParamCallback} JoinCallback */
/** @typedef {Error & {code: string, status: number, notFound: boolean}} NotFoundError */

/** Matches the complete filename of a numbered Node trace log. */
const TRACE_FILE_PATTERN = /^node_trace\.(\d+)\.log$/

module.exports = nodeTraceJoin

/**
 * Combines trace log files into one output file and removes consumed inputs.
 *
 * @param {string|string[]} pattern A filename pattern or explicit input paths.
 * @param {string} output Path to the combined trace file.
 * @param {JoinCallback} [cb] Called when the operation finishes.
 * @returns {void}
 */
function nodeTraceJoin (pattern, output, cb = noop) {
  if (Array.isArray(pattern)) {
    const outputPath = path.resolve(output)
    for (const file of pattern) {
      if (path.resolve(file) === outputPath) {
        const err = new Error('Output file cannot also be an input file')
        return cb(err)
      }
    }
    return combine(pattern)
  }

  const dir = path.dirname(pattern)
  const filePattern = path.basename(pattern).split('*')

  fs.readdir(dir, { encoding: 'utf8' }, onReadDirectory)

  /**
   * Filters, orders, and resolves the directory entries returned by readdir.
   *
   * @param {NodeJS.ErrnoException|null} err Directory read error, if any.
   * @param {string[]} files Directory entry names.
   * @returns {void}
   */
  function onReadDirectory (err, files) {
    if (err) return cb(err)
    const outputPath = path.resolve(output)
    const inputs = []
    for (const file of files) {
      if (!filterPattern(file)) continue
      if (path.resolve(dir, file) === outputPath) continue
      inputs.push(file)
    }
    inputs.sort(sort)
    for (let i = 0; i < inputs.length; i++) inputs[i] = path.join(dir, inputs[i])
    combine(inputs)
  }

  /**
   * Combines an ordered list of input files and removes them after success.
   *
   * @param {string[]} files Input file paths.
   * @returns {void}
   */
  function combine (files) {
    if (!files.length) return cb(notFound('No files matching the pattern found'))
    if (files.length === 1) return fs.rename(files[0], output, cb)

    pipeline(
      Readable.from(readFiles(files)),
      stringify(),
      fs.createWriteStream(output),
      onunlink
    )

    /** Handles completion of the output stream pipeline. @param {Error|null} err */
    function onunlink (err) {
      if (err) return cb(err)

      let missing = files.length
      /** @type {NodeJS.ErrnoException|null} */
      let error = null

      for (let i = 0; i < files.length; i++) fs.unlink(files[i], done)

      /**
       * Records an input unlink result and calls back after all inputs finish.
       *
       * @param {NodeJS.ErrnoException|null} err Input unlink error, if any.
       * @returns {void}
       */
      function done (err) {
        if (err && err.code !== 'ENOENT') error = err
        if (--missing) return
        cb(error)
      }
    }
  }

  /**
   * Checks whether a directory entry matches the supplied filename pattern.
   *
   * @param {string} file Directory entry name.
   * @returns {boolean} Whether the entry matches the pattern.
   */
  function filterPattern (file) {
    let offset = 0
    for (let i = 0; i < filePattern.length; i++) {
      const next = file.indexOf(filePattern[i], offset)
      if (next === -1 || (i === 0 && next !== 0)) return false
      offset = next + filePattern[i].length
    }
    if (filePattern[filePattern.length - 1]) {
      if (offset !== file.length) return false
    }
    return true
  }
}

/**
 * Creates the standard error returned when no input files match.
 *
 * @param {string} msg Error message.
 * @returns {NotFoundError} An ENOENT error marked as not found.
 */
function notFound (msg) {
  const err = Object.assign(new Error(msg), {
    code: 'ENOENT',
    status: 404,
    notFound: true
  })
  return err
}

/**
 * Extracts the numeric sequence from an exactly named trace log.
 *
 * @param {string} name Trace log filename.
 * @returns {number|null} Sequence number, or null when the name is unindexed.
 */
function index (name) {
  const m = TRACE_FILE_PATTERN.exec(name)
  return m ? Number(m[1]) : null
}

/**
 * Orders numbered trace logs numerically and other names lexically.
 *
 * @param {string} a First filename.
 * @param {string} b Second filename.
 * @returns {number} Sort comparator result.
 */
function sort (a, b) {
  const ai = index(a)
  const bi = index(b)
  if (ai !== null && bi !== null) return ai - bi
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Creates a transform that writes parsed trace events as one JSON document.
 *
 * @returns {import('node:stream').Transform} JSON output transform.
 */
function stringify () {
  let sep = false

  const s = new Transform({
    writableObjectMode: true,
    transform: write,
    flush
  })
  s.push('{"traceEvents":[')
  return s

  /**
   * Serializes one parsed trace event.
   *
   * @param {object} data Parsed trace event.
   * @param {string} enc Input encoding.
   * @param {import('node:stream').TransformCallback} cb Transform callback.
   * @returns {void}
   */
  function write (data, enc, cb) {
    const s = sep ? ',' : ''
    sep = true
    cb(null, s + JSON.stringify(data))
  }

  /**
   * Closes the traceEvents array and JSON document.
   *
   * @this {import('node:stream').Transform}
   * @param {import('node:stream').TransformCallback} cb Transform flush callback.
   * @returns {void}
   */
  function flush (cb) {
    this.push(']}')
    cb(null)
  }
}

/**
 * Connects a file reader to the trace event parser.
 *
 * @param {string} filename Input trace log path.
 * @returns {import('node:stream').Transform} Readable parser output stream.
 */
function parse (filename) {
  return pipeline(fs.createReadStream(filename), parser(), noop)
}

/**
 * Yields parsed events from each file in sequence.
 *
 * @param {string[]} files Ordered input paths.
 * @yields {object} Parsed trace event.
 */
async function * readFiles (files) {
  for (const filename of files) {
    for await (const event of parse(filename)) yield event
  }
}

/**
 * Ignores an optional stream pipeline callback error.
 *
 * @returns {void}
 */
function noop () {}
