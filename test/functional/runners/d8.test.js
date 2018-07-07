'use strict'

const colors = require('colors')

describe('d8', () => {
  let initialCwd
  before(() => {
    initialCwd = process.cwd()
    process.chdir(__dirname)
  });

  after(() => {
    process.chdir(initialCwd)
  })

  it('should run all tests', async () => {
    const {stdout, stderr} = shell('cf d8')
    stderr.should.equal('')
    colors.strip(stdout).should.equal('OK!\n')
    stdout.should.equal('OK!'.green.bold + '\n')
  });
});