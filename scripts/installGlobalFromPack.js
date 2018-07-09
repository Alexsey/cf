'use strict'

const fs = require('fs')

const shellJs = require('shelljs')

const {name, version} = require('../package')
const packFile = `${name}-${version}.tgz`

shellJs.exec('npm pack .', {silent: true})
shellJs.exec(`npm i -g ${packFile}`, {silent: true})
// npm uninstall -g cf will not work without tarball file. NPM bug
// fs.unlinkSync(`./${packFile}`)