/*
    General file for creating an Express app, because the needs of all
    servers within this setup are basically the same
*/

var express = require('express'),
    exphb = require('express3-handlebars'),
    bodyParser = require('body-parser'),
    makeHTTPSRequest = require('./https-request'),
    q = require('q'),
    path = require('path');

module.exports = function (serverDirectory) {

    var app = express();

    app.engine('handlebars', exphb());
    app.set('view engine', 'handlebars');
    app.set('views', path.join(serverDirectory, 'user-interfaces'));
    app.use(express.static(path.join(__dirname)));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.disable('x-powered-by');

    app.set('makeRequest', function (options) {
        makeHTTPSRequest(options);
    });

    app.set('urlencodedParser', function (requestObject) {

        // Little hack because he recieves all values within the first key of the object,
        // because Express does not parse the 'x-wwww-form-urlencoded' correctly?
        for (var request in requestObject) break;
        return JSON.parse(request);

    });

    app.set('uriSplitter', function (uri) {
        var splittedUri = uri.split(':');
        return {
            uri: splittedUri[0],
            port: (splittedUri[1].length > 0 ? splittedUri[1] : null)
        };
    });

    app.set('validateResponse', function (serverType, response, res, mustResolve) {
        return q.promise(function (resolve) {
            if (response.error) {
                res.send(response);
                var message = 'The ' + serverType + ' responded with an error:\n\nCode: ' + response.error + '\n';
                    message += response.error_description ? ('Description: ' + response.error_description + '\n') : '';
                    message += response.error_uri ? ('URI: ' + response.error_uri + '\n')  : '';
                    message += response.state ? ('State: ' + response.state + '\n') : '';
                    if (mustResolve) resolve(response);
                    console.log(message.red);
            } else resolve(response);
        });
    });

    // A request buffer for handling multiple requests
    var requestBuffer = {
        buffer: [],
        add: function(request) {
            this.buffer.push(request);
        },
        remove: function(index) {
            this.buffer.splice(index, 1);
        }
    };

    app.set('requestOutOfBuffer', function (token) {
        return q.promise(function (resolve) {
            if (requestBuffer.buffer.length > 0) {
                requestBuffer.buffer.forEach(function (request, index) {
                    if (request.token === token) resolve({ data: request, index: index });
                    else if ((index+1) === requestBuffer.buffer.length) resolve(false);
                });
            } else resolve(false);
        });
    });

    app.set('addRequestToBuffer', function (request) {
        requestBuffer.add(request);
    });

    app.set('removeRequestFromBuffer', function (index) {
        requestBuffer.remove(index);
    });

    return app;

};