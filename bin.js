#!/usr/bin/env node

const join = require('./')
const output = process.argv.pop()

if (!output) throw new Error('An output filename is required')

/** Reports a command-line join failure by throwing it. @param {Error|null} err */
function onJoin (err) {
  if (err) throw err
}

join(process.argv.slice(2), output, onJoin)
