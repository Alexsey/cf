#!/usr/bin/env node
'use strict'

let fs = require('fs')
let path = require('path')

process.stdout.isTTY = true
require('colors')
let _ = require('lodash') || false // hacking WebStorm syntax highlight bug


let code = readCodeFile()
let main = new Function ('readline', 'write', 'print', code)

//let {testsToRun, testsQuantity, params} = parseTestsFile()
let testsParseResult = parseTestsFile()
let testsToRun = testsParseResult.testsToRun
let testsQuantity = testsParseResult.testsQuantity
let params = testsParseResult.params

let failedTests = runTests(main, testsToRun, params)

printWarnings(code, testsToRun, failedTests, testsQuantity, params)

printFailedResults(failedTests)


function readCodeFile () {
	let rawCodeFilePath = process.argv[2]
	if (!rawCodeFilePath) terminate('provide code file as first argument')
	let codeFilePath = formatCodeFilePath(rawCodeFilePath)
	let code = readFile(codeFilePath)

	if (!code) {
		let codeFileFullPath = path.join(process.cwd(), codeFilePath)
		terminate(`ENOENT: no such file or directory '${codeFileFullPath}'`)
	}

	if (!code.trim()) terminate('code file is empty')

	return code
}

function parseTestsFile () {
	let testFilePath = process.argv[3]
	let codeFilePath = formatCodeFilePath(process.argv[2])
	// todo read test files async
	let testsStr = readFile(testFilePath)
		|| readFile(codeFilePath.slice(0, -3)) // 1A.js -> 1A
		|| readFile(codeFilePath.slice(0, -2) + 'test') // 1A.js -> 1A.test
		|| readFile('tests')
		|| readFile('test')

	// todo read tests from code file

	if (!testsStr) terminate('file with tests not found')

	let paragraphs = _(testsStr
		.split('\n')).invoke('trim').join('\n').trim()
		.replace(/\n{3,}/g, '\n\n').split('\n\n')

	let testParagraphs = paragraphs.slice(paragraphs.length & 1)
	let paramsLine = paragraphs.slice(0, paragraphs.length & 1)[0]

	let tests = parseTests(testParagraphs)
	let params = parseParams(paramsLine)

	return {
		testsToRun: tests.testsToRun,
		testsQuantity: tests.testsQuantity,
		params
	}

	function parseTests (paragraphs) {
		let tests = _(paragraphs).chunk(2)
			.map(v => ({input: v[0], expectation: v[1]}))
		//	.map(([input, expectation]) => ({input, expectation}))
			.value()

		//let {testsRunOnly, testsCommon} = _.groupBy(tests, v => {
		let sortedTests = _.groupBy(tests, v => {
			switch (v.input[0]) {
				case '+':	return 'runOnly'
				case '-': return 'skip'
				default : return 'run'
			}
		})
		let testsRunOnly = sortedTests.runOnly
			&& sortedTests.runOnly.forEach(v => v.input = v.input.slice(2))
		let testsCommon = sortedTests.run
		let testsToRun = testsRunOnly || testsCommon
		if (!testsToRun) terminate('no tests to run')

		return {
			testsToRun: testsToRun,
			testsQuantity: tests.length
		}
	}

	function parseParams (paramsLine) {
		return _(_(paramsLine)               // ' n   e =2 '
			.split('=')                        // [' n   e ', '2 ']
			.invoke('trim')                    // ['n   e', '2']
			.join('=')                         // ['n   e=2']
			.split(' ')                        // ['n', '', '', 'e=2']
			.filter(Boolean)                   // ['n', 'e=2']
			.map(p => p.split('='))            // [['n'], ['e', '2']]
			.map(p => [p[0], p[1] || true]))   // [['n', true], ['e', '2']]
		  .zipObject()                       // {n: true, e: 2}
			.value()
	}
}

function runTests (main, tests, params) {
	// think over better form, may be without explicit failedTests
	let failedTests = []
	tests.forEach(test => {
		// make them immutable for consistency?
		let actual = ''
		let input = test.input.split('\n').reverse()
		let readline = () => input.pop()
		let write = str => {actual += str}
		let print = str => {actual += str + '\n'}

		main(readline, write, print)

		// todo may be support some extra character for output to just print the result?
		// todo last character must be '\n' in both cases
		if (params.e
				? Math.abs(test.expectation - actual) >= Math.pow(10, -params.e)
				: actual != test.expectation + '\n'
		)
			failedTests.push({
				actual: actual.trim(),
				expectation: test.expectation,
				input: test.input
			})
	})
	return failedTests
}

function printWarnings (code, ranTests, failedTests, testsQuantity, params) {
	// todo print warnings for unknown params and test valid ones
	if (ranTests.length < testsQuantity && !failedTests.length) {
		code.includes('console.log') && console.log('\nconsole.log'.yellow)
		console.log(`${ranTests.length} of ${testsQuantity}`.green.bold)
	}
}

function printFailedResults (failedTests) {
	failedTests.forEach(function (fail) {
		let expectations = fail.expectation.split('\n').reverse()
		let actuals      = fail.actual     .split('\n').reverse()
		let inputs       = fail.input      .split('\n').reverse()

		if (params.n) {expectations.push(''); actuals.push('')}

		let expectationWidth = _(expectations).pluck('length').max() + 3
		let inputWidth       = _(inputs)      .pluck('length').max() + 3

		while (actuals.length || expectations.length || actuals.length)
			console.log(
				_(inputs.pop()       || '').padRight(inputWidth).yellow.bold +
				_(expectations.pop() || '').padRight(expectationWidth).green.bold +
				 (actuals.pop()      || '').red.bold
			)
	})
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
	if (error) {
		process.stderr.write(error.red)
		process.exit(1)
	} else {
		process.exit(0)
	}
}