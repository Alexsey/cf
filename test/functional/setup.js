'use strict'

const fs = require('fs')

const shellJs = require('shelljs')

global.shell = (command, options) =>
  shellJs.exec(command, {silent: true, ...options})

const {name, version} = require('../../package')
const packFile = `${name}-${version}.tgz`
const rootFolder = process.cwd()

before(function () {
  this.timeout(10000)

  shell('npm pack .')
  shell(`npm i -g ${packFile}`)
  process.chdir(__dirname)
})

after(function () {
  this.timeout(10000)

  process.chdir(rootFolder)
  shell(`npm uninstall -g ${name}`)
  fs.unlinkSync(`./${packFile}`)
})