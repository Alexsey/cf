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

function readFile (fileName) {
	try {
		return fs.readFileSync(fileName, 'utf8').replace(/\r/g, '') || ' '
	} catch (e) {}
}

if (!testsStr) throw 'no tests found'

var inputs = []
var expectations = []
testsStr
	.replace(/\n{3,}/g, '\n\n')
	.trim()
	.split('\n\n')
	.reverse()
	.forEach(function (paragraph, i) {
		(i % 2 ? inputs : expectations).push(paragraph)
	})
var testsQuantity = inputs.length

var input, tests = []
while (input = inputs.shift())
	tests.push({
		input: input,
		expectation: expectations.shift()
	})

var testsRunOnly = []
var testsCommon = []
tests.forEach(function (test) {
	if (test.input.startsWith('+')) {
		test.input = test.input.slice(2)
		testsRunOnly.push(test)
	} else if (!test.input.startsWith('-')) {
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
		else if (word.endsWith('='))   {params[word.slice(0, -1)]  = nextWord;	i++}
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
			? !(Math.abs(test.expectation - actual) < Math.pow(10, -params.e))
			: actual != test.expectation + '\n')
		failedTests.push({
			actual: actual.trim(),
			expectation: test.expectation, input: test.input
		})
})

if (tests.length < testsQuantity && !failedTests.length) {
	if (~codeStr.indexOf('console.log'))
		console.log('\n' + colors.yellow('console.log'))
	console.log(colors.green.bold([tests.length, 'of', testsQuantity].join(' ')))
}

failedTests.forEach(function (fail) {
	var expectations = fail.expectation.split('\n').reverse()
	var actuals = fail.actual.split('\n').reverse()
	var inputs = fail.input.split('\n').reverse()
	if (params.n) {expectations.push(''); actuals.push('')}
	var expectationWidth = longestOf(expectations)
	var inputWidth = longestOf(inputs)
	do {
		var input = inputs.pop() || ''
		var inputPaddingSize = inputWidth - input.length + 3
		var inputPadding = new Array(inputPaddingSize).join(' ')
		var expected = expectations.pop() || ''
		var expectedPaddingSize = expectationWidth - expected.length + 3
		var expectedPadding = new Array(expectedPaddingSize).join(' ')
		var actual = actuals.pop() || ''
		console.log(colors.yellow.bold(input) + inputPadding +
		            colors.green.bold(expected) + expectedPadding +
		            colors.red.bold(actual))
	}
	while (input + expected + actual)

	function longestOf (arrOfStr) {
		return arrOfStr.reduce(function (maxWidth, line) {
				return Math.max(maxWidth, line.length)
			}, 0)
	}
})