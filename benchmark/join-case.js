const fs = require('fs')
const path = require('path')
const {Readable} = require('stream')
const join = require('../index')

module.exports = function addJoinCase (bench, fixtures, highWaterMark, options = {}) {
  let workDir
  let output
  let pattern
  const originalFrom = Readable.from

  const name = options.name || `Readable.from highWaterMark=${highWaterMark}`
  const noiseCount = options.noiseCount || 0

  bench.add(name, async function () {
    await new Promise((resolve, reject) => {
      join(pattern, output, err => err ? reject(err) : resolve())
    })
  }, {
    beforeEach: function () {
      workDir = fs.mkdtempSync(path.join(fixtures.root, `hwm-${highWaterMark}-`))
      for (const name of fixtures.inputNames) {
        const file = path.join(workDir, name)
        fs.linkSync(path.join(fixtures.templateDir, name), file)
      }
      for (let i = 0; i < noiseCount; i++) {
        const name = fixtures.noiseNames[i]
        fs.linkSync(path.join(fixtures.templateDir, name), path.join(workDir, name))
      }
      pattern = path.join(workDir, 'node_trace.*.log')
      output = path.join(workDir, 'combined.log')

      // Override only this case's HWM; production keeps Node's default.
      if (highWaterMark !== undefined) {
        Readable.from = function (iterable, options) {
          return originalFrom.call(this, iterable, {...options, highWaterMark})
        }
      }
    },
    afterEach: function () {
      Readable.from = originalFrom
      try {
        if (!fs.existsSync(output) || fs.statSync(output).size !== fixtures.expectedBytes) {
          throw new Error(`Unexpected benchmark output for ${name}`)
        }
      } finally {
        if (workDir) fs.rmSync(workDir, {recursive: true, force: true})
      }
    }
  })
}
