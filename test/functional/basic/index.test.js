'use strict'

describe('Basic', () => {
  let initialCwd
  before(() => {
    initialCwd = process.cwd()
    process.chdir(__dirname)
  });

  after(() => {
    process.chdir(initialCwd)
  })

  it('should run all tests', async () => {
    shell('cf test')
  });
});