declare module '@clinic/trace-events-parser' {
  import {Transform} from 'node:stream'

  function parser (): Transform

  export = parser
}
