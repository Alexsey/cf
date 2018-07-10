'use strict'

module.exports = {
  setup,
  teardown,
  run,
  validateCode,
}

const errConsole = new console.Console(process.stderr, process.stderr)

let nativeStdoutWrite, nativeStderrWrite, originalStdinOn, originalStdinPush
let originalDebug = console.debug
let originalDir = console.dir

function setup () {
  nativeStdoutWrite = process.stdout.write
  nativeStderrWrite = process.stderr.write
  originalStdinOn = process.stdin.on
  originalStdinPush = process.stdin.push
  console.debug = errConsole.debug
  console.dir = errConsole.dir
}

function teardown () {
  process.stdout.write = nativeStdoutWrite
  process.stderr.write = nativeStderrWrite
  process.stdin.on = originalStdinOn
  process.stdin.push = originalStdinPush
  console.debug = originalDebug
  console.dir = originalDir
}

function run (code, input) {
  const main = new Function('require', 'process',
    `return () => {${code}}`
  )(require, process)
  let error = null
  let stderr = ''
  let stdout = ''

  process.stdout.write = chunk => stdout += chunk
  process.stderr.write = chunk => stderr += chunk

  process.stdin.push = function (data) {
    this.data(data)
    this.end()
  }
  process.stdin.on = function (event, callback) {
    this[event] = callback
  }

  try {
    main()
    process.stdin.push(input)
  } catch (e) {
    error = e
  }

  return {
    stdout,
    stderr,
    error
  }
}

function validateCode (code) {
  return [
    code.includes('console.dir') && 'console.dir'.yellow.bold,
    code.includes('console.debug') && 'console.debug'.yellow.bold
  ].filter(Boolean)
}