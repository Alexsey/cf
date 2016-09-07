const _ = require('lodash')

const warns = new Symbol

const warnsForms = {
  unknown: {
    single: 'is unknown', plural: 'are unknown'
  }, beNumber: {
    single: 'should be a number', plural: 'should be a numbers'
  }, shouldHaveNoValue: {
    single: 'should have no value', plural: 'should have no values'
  }, shouldHaveValue: {
    single: 'should have value', plural: 'should have values'
  }
}

class paramsWarnings {
  constructor () {
    this[warns] = {}
    warnsForms.forEach(warn => {
      this[warns][warn] = []
    })
  }

  add (warn, param) {
    if (arguments.length < 2) return this.add.bind(this, ...arguments)
    if (!this[warns][warn]) {
      const validWarns = _.keys(warnsForms).map(warn => `'${warn}'`).join(', ')
      throw Error(`unknown warning: '${warn}'. Valid are ${validWarns}`)
    }
    this[warns][warn].push(param)
  }

  getBadParams () {
    return _.flatMap(this[warns])
  }

  getWarningsStrings (textStyle, paramsStyle = textStyle) {
    if (!this.getBadParams()) return ''
    return _(this[warns])
      .omitBy(_.isEmpty)
      .map((params, warn) => {
        const plurality = params.length > 1 ? 'single' : 'plural'
        return [('parameter' + (plurality == 'plural' ? 's' : ''))[textStyle],
          _.map(params, paramsStyle).join(', '[textStyle]),
          this[warnsForms][warn][plurality][textStyle]].join(' ')
      }).join('\n')
  }
}

module.exports = paramsWarnings