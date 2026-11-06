const fs = require('fs')
const path = require('path')
const { cleanupFixtures, createFixtures } = require('./trace-fixtures')

/** Loads each benchmark case, runs Tinybench, and removes the fixtures. */
async function main () {
  const { Bench } = await import('tinybench')
  const fixtures = createFixtures()
  const bench = new Bench({
    name: 'Trace join stream and filename sorting benchmarks',
    time: 1_000,
    iterations: 32,
    warmup: true,
    warmupTime: 500,
    warmupIterations: 16,
    concurrency: null,
    throws: true
  })

  try {
    const directoryEntries = fs.readdirSync(__dirname)
    const cases = []
    for (const filename of directoryEntries) {
      if (filename.endsWith('.bench.js')) cases.push(filename)
    }
    cases.sort()

    for (const filename of cases) {
      require(path.join(__dirname, filename))(bench, fixtures)
    }

    console.log('Join fixtures use prewarmed file pages; setup, output checks, and cleanup are outside timed samples.')
    await bench.run()
    console.table(bench.table())
  } finally {
    cleanupFixtures(fixtures)
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
