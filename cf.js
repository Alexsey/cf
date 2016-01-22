'use strict'

const fs = require('fs')
const path = require('path')
const util = require('util')

process.stdout.isTTY = true // some terminals need this
require('colors').enabled = true // and/or this to enable color output
const _ = require('lodash') || false // hacking WebStorm syntax highlight bug


const code = readCodeFile()
const main = new Function('readline', 'write', 'print', code)
const {testsToRun, testsQuantity, params} = parseTestsFile()
const paramsWarningsStr = getParamsWarningsStr(params)
const testsResults = runTests(main, testsToRun, params)
const testResultsStr = getTestsResultsStr(testsResults)
const warningsStr = getWarningsStr(code, testsResults, testsQuantity, params)
print(paramsWarningsStr, testResultsStr, warningsStr)


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
    || readFile(codeFilePath.slice(0, -3)) // 1A.js -> 1A
    || readFile(codeFilePath.slice(0, -2) + 'test') // 1A.js -> 1A.test
    || readFile('tests')
    || readFile('test')

  if (!testsStr) terminate('file with tests not found')

  const paragraphs = testsStr.trim().split(/\s*(?:\n\s*){2,}/g)
  const testParagraphs = paragraphs.slice(paragraphs.length % 2)
  const paramsLine = paragraphs.slice(0, paragraphs.length % 2)[0]

  const params = setDefaultParams(parseParams(paramsLine))
  const tests = parseTests(testParagraphs, params)

  return {
    testsToRun: tests.testsToRun,
    testsQuantity: tests.testsQuantity,
    params
  }

  function parseTests (paragraphs, params) {
    const tests = _.chunk(paragraphs, 2)
      .map(([input, expectation]) => ({
        input: input.replace(RegExp(params['\\'], 'g'), ''),
        expectation: expectation.replace(RegExp(params['\\'], 'g'), '')
      }))

    const {testsRunOnly, testsCommon} = _.groupBy(tests, v => {
      switch (v.input[0]) {
        case params['+']: return 'testsRunOnly'
        case params['-']: return 'testsSkip'
        default : return 'testsCommon'
      }
    })
    _.forEach(testsRunOnly, v => v.input = v.input.slice(1).trimLeft())
    //_.forEach(testsSkip, v => v.input = v.input.slice(1).trimLeft())
    const testsToRun = testsRunOnly || testsCommon
    if (!testsToRun) terminate('no tests to run')

    return {
      testsToRun,
      testsQuantity: tests.length
    }
  }

  function parseParams (paramsLine = '') {
    // future todo add normal escaping and string with spaces in quotes
    return _(_(paramsLine)    // ' k =all\sdone!    n '
      .split('=')             // [' p ', 'all\sdone!    n ']
      .invoke('trim')         // ['p', 'all\sdone!    n']
      .join('=')              // ['p=all\sdone!    n']
      .split(' ')             // ['p=all\sdone!', '', '', '', '', 'n']
      .filter(Boolean)        // ['p=all\sdone!', 'n']
      .map(p => p.split('=')) // [['p', 'all\sdone!'], ['n']]
      .map(p => [p[0], p[1]   // [['p', 'all done!'], ['n', undefined]]
        && p[1].replace(/\\n/g, '\n')
               .replace(/\\s/g, ' ')]))
      .zipObject()            // {p: 'all done!', n: undefined}
      .value() || {}
  }

  function setDefaultParams (params) {
    _.defaults(params, {'@': '@', '+': '+', '-': '-', '\\': ''})
    if ('f' in params) params.f = true
    if ('l' in params) params.l = true
    if ('k' in params) params.k = (params.k || 'OK!').green.bold
    if (params.s) params.s = params.s.cyan.bold
    return params
  }
}

function getParamsWarningsStr (params) {
const warnings = []
  const validParams = ['p', 'f', 'l', 's', '@', '+', '-', 'k', '\\']
  const unknownParams = _.difference(_.keys(params), validParams)
  if (unknownParams.length)
    warnings.push((`unknown parameter${sForPlural(unknownParams)}: ` +
    `${unknownParams.join(', ')}`).cyan.bold)
  if ('p' in params && !_.isFinite(+params.p))
    warnings.push('parameter `p` should be a number'.cyan.bold)
  if ('s' in params && !params.s)
    warnings.push('parameter `s` should have a value'.cyan.bold)
  return warnings.join('\n')

  function sForPlural (arr) {
    return arr.length > 1 ? 's' : ''
  }
}

function runTests (main, tests, params) {
  const nativeLog = console.log
  return _(_(tests).cloneDeep()).transform((testsResults, testResult) => {
    testsResults.push(testResult)
    testResult.isSuccess = true
    const logs = testResult.logs = []
    console.log = (...args) => logs.push([...args])
    const {input, expectation} = testResult
    let actual = ''
    const inputByLine = input.split('\n').reverse()
    const readline = () => inputByLine.pop()
    const write = str => actual += str
    const print = str => actual += str + '\n'

    try {
      main(readline, write, print)
    }  catch (e) {
      console.log = nativeLog
      console.log(_(logs).invoke('join', ' ').join('\n'), '\n')
      terminate(e)
    }
    console.log = nativeLog

    if (expectation == params['@']) { // expect empty output
      if (actual) {
        testResult.isSuccess = false
        testResult.expectation = 'empty result expected'
      }
    } else if (actual && !actual.endsWith('\n')) {
      testResult.isSuccess = false
      testResult.expectation = 'test output must ends with \\n'
    // todo test p by line
    } else if (params.p && [+expectation, +actual].every(_.isFinite)
      ? Math.abs(expectation - actual) >= Math.pow(10, -params.p)
      : actual != expectation + '\n'
    ) {
      testResult.isSuccess = false
    }
    testResult.actual = actual.replace(/\n$/, '')

    if (!testResult.isSuccess && params.f) return false
  }).value()
}

function getWarningsStr (code, testResult, testsQuantity, params) {
  if (!_.every(testResult, 'isSuccess')) return
  const warnings = []
  if (code.includes('console.log')) warnings.push('console.log'.yellow.bold)
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
  (_.findLast(testResults, testResult =>
      testResult.logs.length || !testResult.isSuccess)
  || testResults[0]).lastOutput = true

  return testResults.map(testResult => {
    const logs = _(testResult.logs).invoke('join', ' ').join('\n')
    const expectations = testResult.expectation.split('\n').reverse()
    const actuals      = testResult.actual     .split('\n').reverse()
    const inputs       = testResult.input      .split('\n').reverse()

    const outputHeight = _([expectations, actuals, inputs]).map('length').max()
    const pad = a => a.fill('', a.length, a.length = outputHeight)
    ;[expectations, actuals, inputs].map(pad)

    const expectationWidth = _(expectations).map('length').max() + 3
    const inputWidth       = _(inputs)      .map('length').max() + 3

    const logsToPrint = !(testResult.isSuccess && params.l) && logs || ''
    return [logsToPrint,
      logsToPrint && testResult.isSuccess && !testResult.lastOutput && params.s
    ].concat(!testResult.isSuccess &&  _.times(outputHeight, () =>
        _(inputs.pop()).padRight(inputWidth).yellow.bold +
        _(expectations.pop()).padRight(expectationWidth).green.bold +
        prepareActual(actuals.pop())
    )).filter(Boolean).join('\n')
  }).filter(Boolean).join('\n\n')

  function prepareActual (str) {
    return (str.match(/^\s*/) || [''])[0].replace(/./g, '\\s').cyan
         + str.trim().red.bold
         + (str.match(/\s*$/) || [''])[0].replace(/./g, '\\s').cyan
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
  if (_.isError(error)) {
    process.stderr.write(formatStackTrace(error.stack).red + '\n')
  } else if (_.isString(error)) {
    process.stderr.write(error.red + '\n')
  } else if (arguments.length) {
    process.stderr.write(util.inspect(error, false, null).red + '\n')
  }
  process.exit(1)

  function formatStackTrace (stackTrace) {
    stackTrace = stackTrace.split('\n')
    const message = stackTrace.shift()
    const codeFilePath = formatCodeFilePath(process.argv[2])
    const codeFileName = _.last(codeFilePath.split(/\\|\//))
    const mainStackTrace = stackTrace
      .filter(/ /.test, /eval\sat\s<anonymous>.*<anonymous>:(\d+:\d+)/)
      .map(line => [
        line.match(/at\s([^\s]+)/)[1],
        'at',
        line.match(/<anonymous>:(\d+:\d+)/)[1].split(':')])

    _(mainStackTrace).last()[0] = codeFileName
    _(mainStackTrace).last()[1] = 'in'
    const fnNamesMaxLength = _(mainStackTrace).map(0).map('length').max()
    const formattedMainStackTrace = mainStackTrace.map(
      ([fn, article, [line, pos]]) =>
        `\t${_.padRight(fn, fnNamesMaxLength)}  ${article}  ${line - 2}:${pos}`
    )
    formattedMainStackTrace.unshift(message)
    return formattedMainStackTrace.join('\n')
  }
}