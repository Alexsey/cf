'use strict'

const fs = require('fs')
const path = require('path')
const util = require('util')

process.stdout.isTTY = true // some terminals need this to enable color output
require('colors')
const _ = require('lodash') || false // hacking WebStorm syntax highlight bug


const code = readCodeFile()
const main = new Function ('readline', 'write', 'print', code)
const {testsToRun, testsQuantity, params} = parseTestsFile()
const failedTests = runTests(main, testsToRun, params)
printWarnings(code, testsToRun, failedTests, testsQuantity, params)
printFailedResults(failedTests)


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
	// may be I will read test files async with async/await. May be
	const testsStr = readFile(testFilePath)
		|| readFile(codeFilePath.slice(0, -3)) // 1A.js -> 1A
		|| readFile(codeFilePath.slice(0, -2) + 'test') // 1A.js -> 1A.test
		|| readFile('tests')
		|| readFile('test')

	// todo read tests from code file

	if (!testsStr) terminate('file with tests not found')

	const paragraphs = _(testsStr
		.split('\n')).invoke('trim').join('\n').trim()
		.replace(/\n{3,}/g, '\n\n').split('\n\n')

	const testParagraphs = paragraphs.slice(paragraphs.length % 2)
	const paramsLine = paragraphs.slice(0, paragraphs.length % 2)[0]

	const tests = parseTests(testParagraphs)
	const params = parseParams(paramsLine)

	return {
		testsToRun: tests.testsToRun,
		testsQuantity: tests.testsQuantity,
		params
	}

	function parseTests (paragraphs) {
		const tests = _.chunk(paragraphs, 2)
			.map(([input, expectation]) => ({input, expectation}))

		const {testsRunOnly, testsCommon} = _.groupBy(tests, v => {
			switch (v.input[0]) {
				case '+':	return 'testsRunOnly'
				case '-': return 'testsSkip'
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
	return _.transform(tests, (failedTests, test) => {
		let actual = ''
		const input = test.input.split('\n').reverse()
		const readline = () => input.pop()
		const write = str => actual += str
		const print = str => actual += str + '\n'

		// todo add timers
		try {
			main(readline, write, print)
		} catch (e) {terminate(e)}

		// todo may be support some extra character for output to just print the result?
		// todo add special char for empty expectation
		if (!actual.endsWith('\n')) {
			failedTests.push({
				actual: actual.trim(),
				expectation: 'test output must ends with \\n',
				input: test.input
			})
		} else if ([+params.e, +test.expectation, +actual].every(_.isFinite)
			? Math.abs(test.expectation - actual) >= Math.pow(10, -params.e)
			: actual != test.expectation + '\n'
		) {
			failedTests.push({
				actual: actual.trim(),
				expectation: test.expectation,
				input: test.input
			})
		}
	})
}

function printWarnings (code, ranTests, failedTests, testsQuantity, params) {
	// todo print warnings for unknown params and test valid ones
	if (ranTests.length < testsQuantity && !failedTests.length) {
		code.includes('console.log') && console.log('\nconsole.log'.yellow)
		console.log(`${ranTests.length} of ${testsQuantity}`.green.bold)
	}
}

function printFailedResults (failedTests) {
	failedTests.forEach(failedTest => {
		const expectations = failedTest.expectation.split('\n').reverse()
		const actuals      = failedTest.actual     .split('\n').reverse()
		const inputs       = failedTest.input      .split('\n').reverse()

		const outputHeight = _([expectations, actuals, inputs]).map('length').max()
		const pad = a => a.fill('', a.length, a.length = outputHeight)
		;[expectations, actuals, inputs].map(pad)

		const expectationWidth = _(expectations).map('length').max() + 3
		const inputWidth       = _(inputs)      .map('length').max() + 3

		_.times(outputHeight, () => console.log(
			_(inputs.pop()      ).padRight(inputWidth).yellow.bold +
			_(expectations.pop()).padRight(expectationWidth).green.bold +
		   (actuals.pop()     ).red.bold
		))
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
	if (_.isError(error)) {
		process.stderr.write(formatStackTrace(error.stack).red)
	} else if (_.isString(error)) {
		process.stderr.write(error.red)
	} else if (arguments.length) {
		process.stderr.write(util.inspect(error, false, null).red)
	}
	process.exit(1)

	function formatStackTrace (stackTrace) {
		stackTrace = stackTrace.split('\n')
		const message = stackTrace.shift()
		const codeFilePath = formatCodeFilePath(process.argv[2])
		const codeFileName = _.last(codeFilePath.split(/\\|\//))
		let mainStackTrace = stackTrace
			.filter(/ /.test, /eval\sat\s<anonymous>.*<anonymous>\:(\d+\:\d+)/)
			.map(line => [
				line.match(/at\s([^\s]+)/)[1],
				'at',
				line.match(/<anonymous>\:(\d+\:\d+)/)[1].split(':')])

		_.last(mainStackTrace)[0] = codeFileName
		_.last(mainStackTrace)[1] = 'in'
		const nfNamesMaxLength = _(mainStackTrace).map(0).map('length').max()
		mainStackTrace = mainStackTrace.map(([fn, article, [line, pos]]) =>
			`\t${_.padRight(fn, nfNamesMaxLength)}  ${article}  ${line - 2}:${pos}`
		)
		mainStackTrace.unshift(message)
		return mainStackTrace.join('\n')
	}
}