'use strict'

const path = require('path')

describe('Errors', () => {
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
});