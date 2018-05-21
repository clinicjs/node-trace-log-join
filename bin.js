#!/usr/bin/env node

const join = require('./')
const output = process.argv.pop()

join(process.argv.slice(2), output, function (err) {
  if (err) throw err
})
