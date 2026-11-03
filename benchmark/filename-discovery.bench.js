const addJoinCase = require('./join-case')

/** Registers a production glob benchmark with many rejected directory entries. */
/**
 * @param {import('tinybench').Bench} bench Benchmark suite.
 * @param {import('./trace-fixtures').BenchmarkFixtures} fixtures Prepared input fixtures.
 * @returns {void}
 */
module.exports = function (bench, fixtures) {
  addJoinCase(bench, fixtures, undefined, {
    name: 'production glob matching with 4,096 rejected files',
    noiseCount: fixtures.noiseNames.length
  })
}
