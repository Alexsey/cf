'use strict'

let m = 100

let primes = []

a: for (let i = 2; i <= m; i++) {
  for (let j = 0; j < primes.length; j++) {
    if (i / primes[j] == (i / primes[j] | 0)) continue a
  }
  primes.push(i)
}

console.log(primes)