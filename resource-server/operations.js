var colors = require('colors'),
    path = require('path'),
    fs = require('fs'),
    q = require('q'),

    settings = require('../settings').resourceServer,
    errorCodes = require('./../shared/error-codes'),
    generateToken = require('./../shared/token-generator/generator');

// All resource-server operations
module.exports = {

    validateAccessToken: function (data, res, app) {

        if (!data.access_token || !data.client_id || !data.validation_uri || !data.file) {
            app.get('makeRequest')({
                res: res,
                uri: app.get('uriSplitter')(data.redirect_uri).uri,
                port: app.get('uriSplitter')(data.redirect_uri).port,
                state: data.state,
                message: errorCodes.respondWith('invalidRequest', 'Requesting a file needs the providing of an \'access_token\', \'client_id\', \'validation_uri\' and the \'file\' name'),
                settings: settings
            });
        } else {

            var requestToken = generateToken('request'),
                validationMessage = {
                    access_token: data.access_token,
                    client_id: data.client_id,
                    redirect_uri: (settings.options.host + ':' + settings.port),
                    state: settings.routes.token_validation_response.replace(':requestToken', requestToken)
                };

            app.get('makeRequest')({
                contentType: 'application/x-www-form-urlencoded',
                res: res,
                uri: app.get('uriSplitter')(data.validation_uri).uri,
                port: app.get('uriSplitter')(data.validation_uri).port,
                state: data.validation_uri_state,
                message: validationMessage,
                settings: settings,
                cacheControl: 'no-store'
            });

            // Save the necesarry requester data to the buffer
            app.get('addRequestToBuffer')({ data: {
                redirect_uri: data.redirect_uri,
                state: data.state,
                file: data.file
            }, token: requestToken });

        }

    },

    respond: function (request, response, res, app) {

        request = request.data.data;

        var requester = function (message, cacheControl) {

            var options = {
                contentType: 'application/x-www-form-urlencoded',
                res: res,
                uri: app.get('uriSplitter')(request.redirect_uri).uri,
                port: app.get('uriSplitter')(request.redirect_uri).port,
                state: request.state,
                message: message,
                settings: settings
            };

            if (cacheControl) options.cacheControl = cacheControl;

            app.get('makeRequest')(options);

        };

        if (response.error) requester(response);
        else if (response.clientAuthorized) {

            // Going to add Path Traversal protection here
            fs.exists(path.join(__dirname, settings.protectedDataFolder, request.file), function(exists) {

                if (!exists) requester(errorCodes.respondWith('invalidRequest', 'The requested file does not exist'));
                else {

                    var fileToken = generateToken('file'),
                        fileUri = settings.options.host + ':' + settings.port + '/file/' + fileToken;

                    app.get('addFileToBuffer')({
                        fileName: request.file,
                        token: fileToken
                    });

                    requester({ fileUri: fileUri }, 'private');

                }

            });

        }

        app.get('removeRequestFromBuffer')(request.index);

    },

    sendFile: function (buffer, token, res, app) {

        if (buffer.length < 1) res.send(errorCodes.respondWith('invalidRequest', 'The requested file does not exist'));
        else if (!token) res.send(errorCodes.respondWith('invalidRequest', 'You should provide a valid token'));
        else {
            buffer.forEach(function (bufferFile, index) {
                if (bufferFile.token === token) {
                    res.sendfile(path.join(settings.protectedDataFolder, bufferFile.fileName));
                    app.get('removeFileFromBuffer')(index);
                } else if ((index+1) === buffer.length) res.send(errorCodes.respondWith('invalidRequest', 'No file matched with the provided token'));
            });
        }

    }

};