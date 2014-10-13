// Not for testing the bearer or refresh token, because of the returned promise
// e.g: node token-generator-tester code 10

var tokenGenerator = require('./generator'),
    type = process.argv[2],
    numberOfTokens = process.argv[3];

for (var i = 0; i < numberOfTokens; i++) {
    console.log('Created \'' + type + '\' token [#' + i + ']: ' + tokenGenerator(type));
}