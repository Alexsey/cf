var l = readline().split(' ').map(function (v) {return parseInt(v)}).sort(function (a, b) {return a - b})
var a = l[0]
var b = l[1]
var c = l[2]
var d = l[3]

if (c > a + b && d > b + c) {print('IMPOSSIBLE')}
else if ((c > a + b && (d == b + c)) || (c == a + b && d >= b + c)) {print('SEGMENT')}
else {print('TRIANGLE')}