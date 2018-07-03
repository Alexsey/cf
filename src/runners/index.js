'use strict'

const {transform, map} = require('lodash')

const aliases = {
  d8: ['javascript'],
  node: ['nodejs', 'js']
}

module.exports = {
  get,
  list,
}

const runners = {
  d8: require('./d8'),
  node: require('./node')
}

const runnersNamesByAliases = transform(
  aliases,
  (runnersNamesByAliases, runnerAliases, runnerName) => {
    runnersNamesByAliases[runnerName] = runnerName
    runnerAliases.forEach(alias => runnersNamesByAliases[alias] = runnerName)
  }, {}
)

function get (rawAlias) {
  const alias = rawAlias.toLowerCase().replace(/[^a-z0-9.]/g, '')
  const runnerName = runnersNamesByAliases[alias]
  return runners[runnerName]
}

function list () {
  map(runners, runnerName => {
      const runnerAliases = aliases[runnerName]
      return runnerAliases
        ? `${runnerName} or ${runnerAliases.join(', ')}`
        : runnerName
    }
  ).join('\n')
}