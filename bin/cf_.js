#!/usr/bin/env node

var fs = require('fs');
var util = require('util');

//console.log('start')
//
var arg = process.argv
console.log('envs: ' + util.inspect(arg, false, null, true))
var pwd = process.env.PWD
console.log('executed from: ', pwd)

var fileName = arg[2]

var testFile = fs.readFileSync(fileName, 'utf8')
var borderFile = fs.readFileSync(pwd + '/test2', 'utf8')

console.log('exec main file:')
eval(testFile)
console.log('exec border file:')
eval(borderFile)