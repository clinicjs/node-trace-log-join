const addJoinCase = require('./join-case')

module.exports = function (bench, fixtures) {
  for (const highWaterMark of [1, 16, 256]) {
    addJoinCase(bench, fixtures, highWaterMark)
  }
}
