'use strict'

const shellJs = require('shelljs')

const {installGlobalFromPack} = require('../../scripts')

const {name} = require('../../package')
const rootFolder = process.cwd()

global.shell = (command, options) =>
  shellJs.exec(command, {silent: true, ...options})

// todo create custom chai assertion
// todo think of something for process.cwd to return file dir during tests

// todo restore initial version and not just leave fresh install.
// At least if it's failed
let wasInstalledBeforeRun

before(function () {
  this.timeout(10000)

  wasInstalledBeforeRun = shell(`npm list -g -depth ${name}`)
    .stdout.includes(name)
  installGlobalFromPack()
  process.chdir(__dirname)
})

after(function () {
  this.timeout(10000)

  process.chdir(rootFolder)
  if (!wasInstalledBeforeRun) shell(`npm uninstall -g ${name}`)
})