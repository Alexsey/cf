#!/usr/bin/env node

var fs = require('fs')
var colors = require('colors')

var args = process.argv.slice(2)
var pwd = process.env.PWD

var codeFileName = args[0]
var codeStr = fs.readFileSync(codeFileName, 'utf8').replace(/\r/g, '')

// todo read test files async
var testFileName = args[1]
var testsStr = readFile(testFileName)
  || readFile(codeFileName.slice(0, -3)) // 1A.js -> 1A
  || readFile(codeFileName.slice(0, -2) + 'test') // 1A.js -> 1A.test
  || readFile('tests')
  || readFile('test')

// todo read tests from code file

function readFile (fileName) {
  try {
    return fs.readFileSync(fileName, 'utf8').replace(/\r/g, '') || ' '
  } catch (e) {}
}

if (!testsStr) throw 'no tests found'

var inputs = []
var outputs = []
testsStr = testsStr.replace(/\n{3,}/g, '\n\n').trim()
testsStr.split('\n\n').reverse().forEach(function (paragraph, i) {
  (i % 2 ? inputs : outputs).push(paragraph)
})

var tests = []
var input
while (input = inputs.shift()) tests.push({input: input, output: outputs.shift()})
tests.reverse()
var parameters = outputs.shift()

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