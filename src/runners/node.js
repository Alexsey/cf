'use strict'

module.exports = {
  run,
  validateCode,
}

function run (code, input) {
  const main = new Function(code)
  let error = null
  let stderr = ''
  let stdout = ''

  process.stdout.write = chunk => stdout += chunk
  process.stderr.write = chunk => stderr += chunk

  process.stdin.setEncoding('utf-8')
  process.stdin.push(input)

  const origLog = console.log

  try {
    main()
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