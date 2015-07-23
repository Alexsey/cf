#!/usr/bin/env node

var fs = require('fs')
var colors = require('colors')

var args = process.argv.slice(2)
var pwd = process.env.PWD

var codeFileName = args[0]
var testFileName = args[1]
testFileName = testFileName
  || codeFileName.slice(-3) == '.js' && readFile(codeFileName.slice(0, -3))
  || readFile(codeFileName.slice(0, -2) + 'test')
  || readFile('tests')
  || readFile('test')

function readFile (fileName) {
  try {return fs.readFileSync(fileName, 'utf8') || ' '} catch (e) {}
  //try {return fs.readFileSync(pwd + '/' + fileName, 'utf8') || ' '} catch (e) {}
}