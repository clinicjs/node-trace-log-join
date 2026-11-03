const fs = require('fs')
const os = require('os')
const path = require('path')

const fileCount = 8
const eventsPerFile = 10_000
const noiseFileCount = 4_096

function createFixtures () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'node-trace-log-join-bench-'))
  const templateDir = path.join(root, 'templates')
  const noiseNames = []
  const inputNames = []
  for (let i = 0; i < fileCount; i++) inputNames.push(`node_trace.${i + 1}.log`)

  let eventList = ''
  for (let i = 0; i < eventsPerFile; i++) {
    if (i) eventList += ','
    eventList += JSON.stringify({a: i, d: {}})
  }
  const contents = `{"traceEvents":[${eventList}]}`
  let expectedEventList = ''
  for (let i = 0; i < fileCount; i++) {
    if (i) expectedEventList += ','
    expectedEventList += eventList
  }
  const expectedBytes = Buffer.byteLength(`{"traceEvents":[${expectedEventList}]}`)

  try {
    fs.mkdirSync(templateDir)
    for (const name of inputNames) fs.writeFileSync(path.join(templateDir, name), contents)
    for (let i = 0; i < noiseFileCount; i++) {
      const name = `node_trace.noise-${i}.log.extra`
      noiseNames.push(name)
      fs.writeFileSync(path.join(templateDir, name), '')
    }

    // Warm the fixture pages so every case sees the same filesystem cache state.
    for (const name of inputNames) fs.readFileSync(path.join(templateDir, name))

    return {root, templateDir, inputNames, noiseNames, expectedBytes}
  } catch (err) {
    fs.rmSync(root, {recursive: true, force: true})
    throw err
  }
}

function cleanupFixtures (fixtures) {
  fs.rmSync(fixtures.root, {recursive: true, force: true})
}

module.exports = {cleanupFixtures, createFixtures}
