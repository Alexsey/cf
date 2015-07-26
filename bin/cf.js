#!/usr/bin/env node --harmony

var fs = require('fs')

var colors = require('colors/safe')

var args = process.argv.slice(2)
var codeFileName = args[0]
var codeStr = fs.readFileSync(codeFileName, 'utf8').replace(/\r/g, '')
eval('function main (readline, write, print) {' + codeStr + '}')

// todo read test files async
var testFileName = args[1]
var testsStr = readFile(testFileName)
  || readFile(codeFileName.slice(0, -3)) // 1A.js -> 1A
  || readFile(codeFileName.slice(0, -2) + 'test') // 1A.js -> 1A.test
  || readFile('tests')
  || readFile('test')

// todo read tests from code file

function readFile (fileName) {try {return fs.readFileSync(fileName, 'utf8').replace(/\r/g, '') || ' '} catch (e) {}}

if (!testsStr) throw 'no tests found'

var inputs = []
var expectations = []
testsStr = testsStr.replace(/\n{3,}/g, '\n\n').trim()
testsStr.split('\n\n').reverse().forEach(function (paragraph, i) {(i % 2 ? inputs : expectations).push(paragraph)})

var input, tests = []
while (input = inputs.shift()) tests.push({input: input, expectation: expectations.shift()})

var testsRunOnly = []
var testsCommon = []
tests.forEach(function (test) {
  if (test.input[0] == '+') {
    test.input = test.input.slice(2)
    testsRunOnly.push(test)
  } else if (test.input[0] != '-') {
    testsCommon.push(test)
  }
})
tests = testsRunOnly.length ? testsRunOnly : testsCommon
tests.reverse()

var params = {}
var paramsStr = expectations[0]
if (paramsStr) {
  var paramsWords = paramsStr.split(' ').filter(Boolean)
  for (var i = 0; i < paramsWords.length; i++) {
    var word = paramsWords[i]
    var nextWord = paramsWords[i + 1]
    var previousWord = paramsWords[i - 1]
    if      (word == '=')          {params[previousWord]       = nextWord; i++}
    else if (word.startsWith('=')) {params[previousWord]       = word.slice(1)}
    else if (word.endsWith('='))   {params[word.slice(0, -1)]  = nextWord; i++}
    else if (~word.indexOf('='))   {params[word.split('=')[0]] = word.split('=')[1]}
    else                           {params[word]               = true}
  }
}

var failedTests = []
tests.forEach(function (test) {
  var actual = ''
  var input = test.input.split('\n').reverse()
  var readline = [].pop.bind(input)
  var write = function (str) {actual += str}
  var print = function (line) {actual += line + '\n'}

  main(readline, write, print)

  // todo may be support some extra character for output to just print the result?
  if (params.e
      ? Math.abs(test.expectation - actual) >= Math.pow(10, -params.e)
      : actual != test.expectation + '\n')
    failedTests.push({actual: actual.trim(), expectation: test.expectation, input: test.input})
})

failedTests.forEach(function (fail) {
  var expectation = fail.expectation.split('\n').reverse()
  var actual = fail.actual.split('\n').reverse()
  var input = fail.input.split('\n').reverse()
  if (params.n) {expectation.push(''); actual.push('')}
  var expectationWidth = expectation.reduce(function (maxWidth, line) {return Math.max(maxWidth, line.length)}, 0)
  var inputWidth       = input      .reduce(function (maxWidth, line) {return Math.max(maxWidth, line.length)}, 0)
  do {
    var inputLinePart = input.pop() || ''
    var inputLinePadding = new Array(inputWidth - inputLinePart.length + 3).join(' ')
    var expectedLinePart = expectation.pop() || ''
    var expectedLinePadding = new Array(expectationWidth - expectedLinePart.length + 3).join(' ')
    var actualLinePart = actual.pop() || ''
    console.log(colors.yellow.bold(inputLinePart) + inputLinePadding
              + colors.green.bold(expectedLinePart) + expectedLinePadding
              + colors.red.bold(actualLinePart))
  }
  while (inputLinePart + expectedLinePart + actualLinePart)
})