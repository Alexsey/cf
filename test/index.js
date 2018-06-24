'use strict'

const fs = require('fs')
const path = require('path')

require('chai').should()
require('colors')
const shell = require('shelljs').exec

const {name, version} = require('../package')
const packFile = `${name}-${version}.tgz`
const rootFolder = process.cwd()

before(function () {
  this.timeout(10000)
  shell('npm pack .')
  shell(`npm i -g ${packFile}`)
  process.chdir(__dirname)
})

it('should return error on no args provided', async () => {
  shell('cf').stderr.should.have.string(
    'provide code file as first argument'
  )
});

it('should return error if provided code file not exists', async () => {
  const nonExistingFile = 'nonExistingFile.js'
  const filePath = path.join(__dirname, nonExistingFile)
  shell(`cf ${nonExistingFile}`).stderr.should.have.string(
    `ENOENT: no such file or directory '${filePath}'`
  )
});

after(function () {
  this.timeout(10000)
  shell(`npm uninstall -g ${name}`)
  fs.unlinkSync(path.join(rootFolder, `${packFile}`))
})