'use strict'

module.exports = {
  setup,
  teardown,
  run,
  validateCode,
}

let nativeStdoutWrite

function setup () {
  nativeStdoutWrite = process.stdout.write
}

function teardown () {
  process.stdout.write = nativeStdoutWrite
}

function run (code, input) {
  const main = new Function('readline', 'write', 'print', code)
  let stderr = ''
  let stdout = ''
  let error = null

  process.stdout.write = chunk => stderr += chunk
  const inputByLine = input.split('\n').reverse()
  const readline = () => inputByLine.pop()
  const write = str => stdout += str
  const print = str => stdout += str + '\n'

  try {
    main(readline, write, print)
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
    code.includes('console.log') && 'console.log'.yellow.bold
  ].filter(Boolean)
}