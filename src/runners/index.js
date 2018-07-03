'use strict'

const {transform, map} = require('lodash')

const runners = {
  d8: require('./d8'),
  node: require('./node')
}

const aliases = {
  d8: ['javascript'],
  node: ['nodejs', 'js']
}

const runnersNamesByAliases = transform(
  aliases,
  (runnersNamesByAliases, runnerAliases, runnerName) => {
    runnersNamesByAliases[runnerName] = runnerName
    runnerAliases.forEach(alias => runnersNamesByAliases[alias] = runnerName)
  }, {}
)

// todo start here format alias outside and use regular object here
module.exports = new Proxy({}, {
  get: (target, rawAlias) => {
    if (rawAlias == 'has') return () => rawAlias in runners
    if (rawAlias == 'list') return list
    const alias = rawAlias.toLowerCase().replace(/[^a-z0-9.]/g, '')
    const runnerName = runnersNamesByAliases[alias]
    return runners[runnerName]
  }
})

function list () {
  map(runners, runnerName => {
      const runnerAliases = aliases[runnerName]
      return runnerAliases
        ? `${runnerName} or ${runnerAliases.join(', ')}`
        : runnerName
    }
  ).join('\n')
}