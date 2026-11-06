const addJoinCase = require('./join-case')

/** Registers the production join benchmark at three stream buffer sizes. */
/**
 * @param {import('tinybench').Bench} bench Benchmark suite.
 * @param {import('./trace-fixtures').BenchmarkFixtures} fixtures Prepared input fixtures.
 * @returns {void}
 */
module.exports = function (bench, fixtures) {
  for (const highWaterMark of [1, 16, 256]) {
    addJoinCase(bench, fixtures, highWaterMark)
  }
}
