const addJoinCase = require('./join-case')

module.exports = function (bench, fixtures) {
  addJoinCase(bench, fixtures, undefined, {
    name: 'production glob matching with 4,096 rejected files',
    noiseCount: fixtures.noiseNames.length
  })
}
