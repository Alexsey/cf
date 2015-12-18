#!/usr/bin/env node
require('babel-register')({only: './cf.js'})
require('./cf.js')