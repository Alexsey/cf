#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const util = require('util')
const {EOL} = require('os')

const _ = require('lodash')
setupColors()

const runners = require('./runners') // todo pass where needed

const code = readCodeFile()
const {testsToRun, testsQuantity, params, paramsWarningsStr} = parseTestsFile()
const testsResults = runTests(code, testsToRun, params)
const testResultsStr = getTestsResultsStr(testsResults)
const warningsStr = getWarningsStr(code, testsResults, testsQuantity, params)
print(paramsWarningsStr, testResultsStr, warningsStr)
process.stdin.destroy() // ensure stdin will not hang the program

function setupColors () {
  const colors = require('colors')
  colors.setTheme({
    warn: ['cyan', 'bold']
  })
}

function readCodeFile () {
  const rawCodeFilePath = process.argv[2]
  if (!rawCodeFilePath) terminate('provide code file as first argument')
  const codeFilePath = formatCodeFilePath(rawCodeFilePath)
  const code = readFile(codeFilePath)

  if (!code) {
    const codeFileFullPath = path.join(process.cwd(), codeFilePath)
    terminate(`ENOENT: no such file or directory '${codeFileFullPath}'`)
  }

  if (!code.trim()) terminate('code file is empty')

  return code
}

function parseTestsFile () {
  const testFilePath = process.argv[3]
  const codeFilePath = formatCodeFilePath(process.argv[2])
  const testsStr = readFile(testFilePath)
    || readFile(codeFilePath.slice(0, -3))          // 1A.js -> 1A
    || readFile(codeFilePath.slice(0, -2) + 'test') // 1A.js -> 1A.test
    || readFile('tests')
    || readFile('test')

  if (!testsStr) terminate('file with tests not found')

  const paragraphs = testsStr.trim().split(/\s*(?:\n\s*){2,}/g)
  const testParagraphs = paragraphs.slice(paragraphs.length % 2)
  const paramsLine = paragraphs.slice(0, paragraphs.length % 2)[0]

  const rawParams = parseParams(paramsLine)
  const paramsWarningsStr = getParamsWarningsStr(rawParams)
  const params = setDefaultParams(rawParams)
  const tests = parseTests(testParagraphs, params)

  return {
    testsToRun: tests.testsToRun,
    testsQuantity: tests.testsQuantity,
    paramsWarningsStr,
    params
  }

  function parseTests (paragraphs, params) {
    const tests = _(paragraphs)
      .chunk(2)
      .map(([input, expectation]) => ({
        input: input
          .replace(RegExp(params['\\'], 'g'), '')
          .replace(/\r|\n|\r\n/g, EOL)
          + EOL,
        expectation: expectation.replace(RegExp(params['\\'], 'g'), '')
      })).value()

    const {testsRunOnly = [], testsCommon = []} = _.groupBy(tests, v => {
      const ioNewLine = v.input.indexOf('\n')
      switch (v.input.slice(0, ioNewLine).trim()) {
        case params['+']: return 'testsRunOnly'
        case params['-']: return 'testsSkip'
        default         : return 'testsCommon'
      }
    })
    testsRunOnly.forEach(v => v.input = v.input.slice(1).trimStart())
    const testsToRun = testsRunOnly.length ? testsRunOnly : testsCommon
    if (!testsToRun) terminate('no tests to run')

    return {
      testsToRun,
      testsQuantity: tests.length
    }
  }

  function parseParams (paramsLine = '') {
    const u = _(paramsLine).invokeMap('charCodeAt', 0).max() + 1
    const escapedGroups = []
    const quoted = /(?<!\\)"(.*?)(?<!\\)"/g
    const escaped = RegExp(`${u}\\d+${u}`, 'g')
    return _.chain(paramsLine)
      .replace(quoted, (m, s) => u + (escapedGroups.push(s) - 1) + u)
      .split('=')
      .invokeMap('trim')
      .join('=')
      .split(' ')
      .filter(Boolean)
      .map(p => p.split('='))
      .map(p => [p[0], p[1] &&
        p[1].replace(/\\n/g, '\n')
            .replace(escaped, s => escapedGroups[s.slice(1, -1)])
            .replace(/\\"/g, '"')])
      .fromPairs()
      .value() || {}
  }

  function getParamsWarningsStr (params) {
    const warnings = []
    const validParams = ['r', 'p', 'f', 'l', 's', '@', '+', '-', 'k', '\\']
    const unknownParams = _.difference(_.keys(params), validParams)
    if (unknownParams.length)
      warnings.push((`unknown parameter${sForPlural(unknownParams)}: ` +
        `${unknownParams.join(', ')}`))
    if ('p' in params && !isFinite(params.p))
      warnings.push(`parameter 'p' should be a number`)
    if (params.r && !runners.get(params.r))
      warnings.push(`parameter 'r' should be one of\n${runners.list()}`)
    paramsShouldHaveValueWarnings(['s', '@', '+', '-', '\\'], params, warnings)
    return _(warnings).map('warn').join('\n')

    function sForPlural (arr) {
      return arr.length > 1 ? 's' : ''
    }

    function paramsShouldHaveValueWarnings (paramsToTest, params, warnings) {
      paramsToTest.forEach(param => {
        if (param in params && !params[param])
          warnings.push(`parameter '${param}' should have a value`)
      })
    }
  }

  function setDefaultParams (params) {
    _.defaults(params, {'@': '@', '+': '+', '-': '-', '\\': '\\\\'})
    if (!params.r) params.r = 'node'
    if ('f' in params) params.f = true
    if ('l' in params) params.l = true
    if (params.s) params.s = params.s.cyan.bold
    if (!('k' in params) || params.k) params.k = (params.k || 'OK!').green.bold
    return params
  }
}

function runTests (code, tests, params) {
  tests = _(tests).cloneDeep()
  const {run, setup, teardown} = runners.get(params.r)

  setup()
  const testResults = _(tests).transform((testsResults, testResult) => {
    testsResults.push(testResult)
    testResult.isSuccess = true
    const {input, expectation} = testResult

    const {stdout, stderr, error} = run(code, input)
    if (error) {
      teardown()
      if (stderr) console.log(stderr, '\n')
      terminate(error)
    }

    if (expectation == params['@']) { // expect empty output
      if (stdout) {
        testResult.isSuccess = false
        testResult.expectation = 'empty result expected'
      }
    } else if (stdout && !stdout.endsWith('\n')) {
      testResult.isSuccess = false
      testResult.expectation = 'test output must ends with \\n'
    } else if (params.p) {            // compare with precision
      testResult.isSuccess =
        _(stdout).split('\n').initial().zip(expectation.split('\n'))
          .map(([actLine, expLine]) => Math.abs(actLine - expLine))
          .every(diff => diff < 10 ** -params.p)
    } else {                          // compare as is
      testResult.isSuccess = stdout == expectation + '\n'
    }
    testResult.input = input.replace(RegExp(`${EOL}$`), '')
    testResult.stdout = stdout.replace(/\n$/, '')
    testResult.stderr = stderr

    if (!testResult.isSuccess && !params.f) return false
  }).value()
  teardown()

  return testResults
}

function getWarningsStr (code, testResult, testsQuantity, params) {
  if (!_.every(testResult, 'isSuccess')) return
  const warnings = []
  const {validateCode} = runners.get(params.r)
  if (validateCode) warnings.push(...validateCode(code))
  if (testResult.length < testsQuantity) {
    warnings.push(`${testResult.length} of ${testsQuantity}`.green.bold)
  } else if (params.k) {warnings.push(params.k)}
  return warnings.join('\n')
}

function print (...parts) {
  const toPrint = parts.filter(Boolean).join('\n\n')
  if (toPrint) console.log(toPrint)
}

function getTestsResultsStr (testResults) {
  const lastNonEmptyOrFiled = _.findLast(testResults, testResult =>
    testResult.stderr.length || !testResult.isSuccess)
  ;(lastNonEmptyOrFiled || testResults[0]).lastOutput = true

  return testResults.map(testResult => {
    const shouldPrintStderr = !testResult.isSuccess || params.l
    const stderrToPrint = shouldPrintStderr ? testResult.stderr : ''
    const stderrSeparator = stderrToPrint
      && testResult.isSuccess && !testResult.lastOutput && params.s

    const expectations = testResult.expectation.split('\n')
    const stdouts      = testResult.stdout     .split('\n')
    const inputs       = testResult.input      .split(EOL)

    const expectationWidth = _(expectations).map('length').max()
    const inputWidth       = _(inputs)      .map('length').max()
    const stdoutWidth      = _(stdouts)     .map('length').max()

    const resultHeight = _([expectations, stdouts, inputs]).map('length').max()
    const result = testResult.isSuccess ? [] : _.times(resultHeight, () =>
      formatCell(inputs.pop(), 'yellow', inputWidth) +
      formatCell(expectations.pop(), 'green', expectationWidth) +
      formatCell(stdouts.pop(), 'red', stdoutWidth)).reverse()

    return _([stderrToPrint, stderrSeparator, ...result]).compact().join('\n')
  }).filter(Boolean).join('\n\n')

  function formatCell (str, color, width) {
    if (str == null) return ' '.repeat(width + 3)
    if (str == '') return '↵'.padStart(width).cyan.bold + ' '.repeat(3)
    return ' '.repeat(width - str.length)
      + str.replace(/\S.*?(?=\s*$)/g, s => s[color].bold)
      .replace(/^\s*|\s*$/g, s => '•'.repeat(s.length).cyan) + ' '.repeat(3)
  }
}

function formatCodeFilePath (codeFilePath) {
  return codeFilePath.endsWith('.js') ? codeFilePath : codeFilePath + '.js'
}

function readFile (fileName) {
  try {
    return fs.readFileSync(fileName, 'utf8').replace(/\r/g, '') || ' '
  } catch (e) {}
}

function terminate (error) {
  if (error instanceof Error)
    process.stderr.write(formatStackTrace(error.stack).red + '\n')
  else if (typeof error == 'string')
    process.stderr.write(error.red + '\n')
  else if (arguments.length)
    process.stderr.write(util.inspect(error, {depth: null}).red + '\n')
  process.exit(1)

  function formatStackTrace (stackTrace) {
    stackTrace = stackTrace.split('\n')
    const message = stackTrace.shift()
    const codeFilePath = formatCodeFilePath(process.argv[2])
    const codeFileName = _.last(codeFilePath.split(/[\\\/]/))
    const mainStackTrace = stackTrace
      .filter(/ /.test, /eval\sat\srun.*<anonymous>:(\d+:\d+)/)
      .map(line => [
        line.match(/at\s([^\s]+)/)[1],
        'at',
        line.match(/<anonymous>:(\d+:\d+)/)[1].split(':')])

    _(mainStackTrace).last()[0] = codeFileName
    _(mainStackTrace).last()[1] = 'in'
    const fnNamesMaxLength = _(mainStackTrace).map(0).map('length').max()
    const formattedMainStackTrace = mainStackTrace.map(
      ([fn, article, [line, pos]]) =>
        `\t${fn.padEnd(fnNamesMaxLength)}  ${article}  ${line - 2}:${pos}`
    )
    formattedMainStackTrace.unshift(message)
    return formattedMainStackTrace.join('\n')
  }
}