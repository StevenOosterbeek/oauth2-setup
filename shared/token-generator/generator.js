var colors = require('colors'),
    q = require('q'),
    bcrypt = require('bcrypt');

module.exports = function generateToken (type) {

    var generatedToken = '',
        ranges = {
            code       : 'ABCDEFGHIJ$KLMNOPabklmnou~vwxyzQRSTUVcdefghijWXYZ0123pqrst456789@',
            bearer     : 'ab~PQRSTcopqr2C_DEFGHI/J3hijklmnvwxyz-AB4567studefg.KLMNOUVWXYZ+0189',
            refresh    : 'abyzAB@CDEFG456789$HijklmnopqrstuJKLNOPQRcdefghw~xSTUVWXYZ0vIM123',
            file       : 'ABCDEba123pqrst4klxyzZ0FGHIJ$KLMNQRSTUVcdefghijWXYmnou~vwOP56789@',
            request    : 'ABYmnCDEba123pqNQRSFGou~vwOPTUVcdefrsHIJ$KLMghijWXt4klxyzZ056789@'
        },
        lengths = {
            code       : 25,
            bearer     : 14,
            refresh    : 25,
            file       : 30,
            request    : 10
        },
        create = function () {

            function returnToken (token) {
                if (type === 'code' || type === 'bearer' || type === 'refresh') {
                    return q.promise(function (resolve) {
                        bcrypt.genSalt(10, function(err, salt) {
                            if (err) resolve('creating-salt-error');
                            bcrypt.hash(token, salt, function(err, hash) {
                                if (err) resolve('creating-hash-error');
                                else resolve({ token: token, hash: hash });
                            });
                        });
                    });
                } else return token;
            }

            if (ranges[type]) {
                var range = ranges[type];
                for (var i = 0; i < lengths[type]; i++) {
                    var character = range[Math.floor((Math.random() * range.length) - 1)];
                    if (character !== undefined) {
                        generatedToken += character;
                        if ((i+1) === lengths[type]) return returnToken(generatedToken);
                    } else i--;
                }
            } else console.log('The token generator does not recognize the token type to generate (\''.red + type.red + '\')!'.red);

        };

    return create();

};