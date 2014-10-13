var https = require('https'),
    colors = require('colors'),
    errorCodes = require('./error-codes');

// Global functionality for making a HTTPS request
module.exports = function httpsRequest (providedOptions) {

    var postData = JSON.stringify(providedOptions.message),
        options = {
            host: providedOptions.uri || '',
            port: providedOptions.port || 443, // 443 is the default HTTPS port
            path: providedOptions.state ? ('/' + providedOptions.state.replace('/', '')) : '',
            method: providedOptions.method || 'POST',
            key: providedOptions.settings.options.key,
            cert: providedOptions.settings.options.cert,
            headers: {
                'Content-Type': providedOptions.contentType || 'application/json',
                'Content-Length': postData.length
            }
        };

    // Bearer token protocol
    if (providedOptions.cacheControl) options.headers['Cache-Control'] = providedOptions.cacheControl;

    var request = https.request(options, function (res) {
            res.setEncoding('utf8');
            res.on('error', function (errorResponse) {
                console.log('The server could not make a request with the provided info: '.red, errorResponse.red);
                providedOptions.res.send(errorCodes.respondWith('serverError', 'The server could not make a request to the provided URI', providedOptions.uri, providedOptions.state));
            });
        });

    request.write(postData);
    request.end();
    providedOptions.res.end();

    if (require('./../settings').logRequests) {
        console.log('\n-------------------------------------------'.grey);
        console.log('REQUEST ('.bold + options.method.bold + '):\n\n'.bold, providedOptions.message);
        console.log('\n\nHEADERS:\n\n'.bold, options.headers);
        console.log('\n\nDESTINATION:\n'.bold + options.host + (options.port ? (':' + options.port) : '') + '/' + options.path);
        console.log('-------------------------------------------\n'.grey);
    }

};