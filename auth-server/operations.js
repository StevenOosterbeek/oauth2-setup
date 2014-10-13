var colors = require('colors'),
    https = require('https'),
    q = require('q'),

    settings = require('../settings').authServer,
    Client = require('./models/client'),
    errorCodes = require('./../shared/error-codes'),
    generateToken = require('./../shared/token-generator/generator');

// All authorization server functionality
module.exports = {

    register: function (data, res, app) {

        var requester = function (message) {

                /*
                    General function to construct the right request for talking to the client, removes a lot
                    of duplicate code. I wrote this function within every operation on purpose, because making
                    it global will still requires a lot of passing through parameters
                */

                app.get('makeRequest')({
                    res: res,
                    uri: uri,
                    port: port,
                    state: regState,
                    message: message,
                    settings: settings
                });

            },
            createNewClient = function () {

                var newClient = {
                    type: type,
                    name: name,
                    redirect_uri: uri,
                    port: port,
                };

                Client.create(newClient, function (err, createdClient) {
                    if (err) requester(errorCodes.respondWith('serverError'));
                    else {
                        requester({
                            name: settings.name,
                            client_name: name,
                            redirect_uri: settings.options.host + ':' + settings.port,
                            authorization_state: settings.routes.authorization_endpoint.replace('/', ''),
                            token_state: settings.routes.token_endpoint.replace('/', ''),
                            token_validation_state: settings.routes.token_validation.replace('/', ''),
                            token_refresh_state: settings.routes.token_refresh.replace('/', ''),
                            client_id: createdClient._id // Use the created Mongo document identifier
                        });
                    }
                });

            };

        // Check presence
        if (!data.uri || !data.name) { requester(errorCodes.respondWith('invalidRequest', 'Registering a client needs the providing of a \'name\' and absolute \'redirect uri\'')); res.end(); return; }
        else {

            var type = 'public', // All public within this setup, because it is browser based
                name = data.name.replace(/[^\w\s]/gi, ''), // Filter special characters out, just in case
                regState = data.regState.toLowerCase().replace('/', '') || null,
                uri = app.get('uriSplitter')(data.uri).uri,
                port = app.get('uriSplitter')(data.uri).port;

            // Check if the URI is absolute
            if (data.uri.split('?')[1] !== undefined) requester(errorCodes.respondWith('invalidRequest', 'The provided URI should be absolute'));
            else {
                // Check if the URI has the HTTPS protocol, if there is no protocol specified it is assumed that the URI supports HTTPS
                if (data.uri.split('://')[0] === 'http') requester(errorCodes.respondWith('invalidRequest', 'The provided URI must support HTTPS'));
                else createNewClient();
            }

        }
    },

    authenticateUser: function (req, res, app) {

        var data = req.query,
            senderURL = req.header('Referer') || '/';

        if (!data.response_type || !data.client_id || !data.redirect_uri) {
            console.log(errorCodes.respondWith('invalidRequest', 'Authentication a resource owner needs the providing of at least a \'response_type\', \'client_id\' and \'redirect_uri\''));
            res.redirect(senderURL); // Redirect the resource owner back in case of some missing options
        } else {

            var requester = function (message, error) {
                app.get('makeRequest')({
                    res: res,
                    uri: redirect_uri,
                    port: port,
                    state: state,
                    message: message,
                    settings: settings
                });

                if (error) res.redirect(senderURL);
            };

            var response_type = data.response_type,
                client_id = data.client_id,
                state = data.state || null,
                redirect_uri = app.get('uriSplitter')(data.redirect_uri).uri,
                port = app.get('uriSplitter')(data.redirect_uri).port;

            // Authorization Code Grant?
            if (data.response_type !== 'code') requester(errorCodes.respondWith('invalidRequest', 'This authorization server only provides the \'Authorization Code Grant\''), true);
            else {
                app.get('findClient')({ _id: client_id }).then(function (response) {
                    if (response.err) requester(errorCodes.respondWith('invalidRequest', 'The provided client identifier is not valid'), true);
                    else if (!response.client) requester(errorCodes.respondWith('invalidRequest', 'The provided client identifier is not valid'), true);
                    else {
                        var client = response.client;
                        // Check if the redirect URI (without possible port) is the same as in the saved document
                        if (response.client.redirect_uri !== redirect_uri) requester(errorCodes.respondWith('invalidRequest', 'The provided redirect URI is not valid'));
                        // Show the authentication choice
                        else res.render('auth-choice', { clientName: client.name, authEndpoint: settings.routes.authorization_endpoint, client_id: client._id, redirectUri: (client.redirect_uri + (client.port ? ':' + client.port : '')), state: state });
                    }
                });
            }

        }
    },

    authorizeClient: function(data, res, app) {

        app.get('findClient')({ _id: data.client_id }).then(function (clientResponse) {
            if (clientResponse.err) requester(errorCodes.respondWith('serverError'));
            else {

                // No extra check on the client because the client has already been
                // identified within the previous function (authenticateUser ^)

                var requester = function (message) {
                    app.get('makeRequest')({
                        res: res,
                        uri: app.get('uriSplitter')(data.redirect_uri).uri,
                        port: app.get('uriSplitter')(data.redirect_uri).port,
                        state: data.state || null,
                        message: message,
                        settings: settings
                    });
                };

                // Did the end-user authorize the client?
                if (data.clientIsAuthorized === 'no') {
                    res.send(errorCodes.respondWith('accessDenied', 'The resource owner did not grant you access'));
                    requester(errorCodes.respondWith('accessDenied', 'The resource owner did not grant you access'));
                } else {

                    generateToken('code').then(function (codeResponse) {

                        var uri = app.get('uriSplitter')(data.redirect_uri).uri,
                            port = app.get('uriSplitter')(data.redirect_uri).port,
                            query = uri + (port ? (':' + port) : '') + (data.state ? ('/' + data.state) : '') + '?code=' + codeResponse.hash + '&authname=' + settings.name;

                        clientResponse.client.code = codeResponse.token;
                        clientResponse.client.save(function (err) {
                            if (err) requester(errorCodes.respondWith('serverError'));
                            else res.redirect(307, 'https://' + query); // 307 for making a POST request
                        });

                    });

                }

            }
        });

    },

    issueAccessToken: function(request, res, app) {

        if (!request.redirect_uri) { console.log('Client did not provide a redirect uri, stopping the process.'.red); res.end(); return; }
        else {

            var options = {
                redirect_uri: request.redirect_uri.split(':')[0],
                port: ((request.redirect_uri.split(':')[1].length > 0) ? request.redirect_uri.split(':')[1] : null)
            };

            var requester = function (message) {
                app.get('makeRequest')({
                    res: res,
                    uri: options.redirect_uri,
                    port: options.port || null,
                    state: request.state || null,
                    message: message,
                    settings: settings,
                    cacheControl: 'no-store'
                });
            };

            if (request.grant_type !== 'code') requester(errorCodes.respondWith('invalidRequest', 'Sorry, this authorization server only provides the \'Authorization Code Grant\''));
            else {

                app.get('findClient')(options).then(function (response) {
                    if (response.err) requester(errorCodes.respondWith('serverError'));
                    else if (!response.client) requester(errorCodes.respondWith('unauthorizedClient', 'The requesting client is not authorized to request an access token'));
                    else {

                        app.get('tokenValidation')(response.client.code, request.code).then(function (result) {
                            switch (result) {
                                case 'error': requester(errorCodes.respondWith('serverError')); break;
                                case false: requester(errorCodes.respondWith('unauthorizedClient', 'The provided code is invalid')); break;
                                case true:

                                    var tokens = {
                                        issued: ((+ new Date()) / 1000) // Timestamp (seconds, milliseconds) sinds epoch
                                    };

                                    // Generating a bearer or refresh token will return a promise
                                    generateToken('bearer').then(function (bearer) {
                                        generateToken('refresh').then(function (refresh) {

                                            // Save the tokens on this server, the hashes on the client
                                            tokens.access_token = bearer.token;
                                            tokens.refresh_token = refresh.token;

                                            response.client.token = tokens;
                                            response.client.save(function (err, authorizedClient) {

                                                if (err) console.log('Could not update client with generated tokens:'.red, err.red);
                                                else {

                                                    // Also tell the client where to find the protected data
                                                    var resourceServer = require('../settings').resourceServer;
                                                        protectedDataResource = resourceServer.options.host + ':' + resourceServer.port;

                                                    requester({
                                                        auth_server: settings.name,
                                                        access_token: bearer.hash,
                                                        token_type: 'Bearer',
                                                        expires_in: settings.tokenLifetime,
                                                        refresh_token: refresh.hash,
                                                        resource_name: resourceServer.name,
                                                        resource_uri: protectedDataResource,
                                                        resource_get_data_state: resourceServer.routes.protected_data.replace('/', ''),
                                                        validation_uri: settings.routes.token_validation
                                                    });

                                                }

                                            });

                                        });
                                    });

                                    break;

                            }
                        });

                    }
                });

            }

        }

    },

    validateToken: function (data, res, app) {

        var requester = function (message) {
                app.get('makeRequest')({
                    contentType: 'application/x-www-form-urlencoded',
                    res: res,
                    uri: app.get('uriSplitter')(data.redirect_uri).uri,
                    port: app.get('uriSplitter')(data.redirect_uri).port,
                    state: data.state,
                    message: message,
                    settings: settings
                });
            };

        if (!data.access_token || !data.client_id) requester(errorCodes.respondWith('invalidRequest', 'You need to provide an \'access_token\' and \'client_id\' in order to validate a token'));
        else {
            app.get('findClient')({ _id : data.client_id }).then(function (response) {
                if (response.err) requester(errorCodes.respondWith('unauthorizedClient', 'The provided client_id is invalid'));
                else if (!response.client) requester(errorCodes.respondWith('unauthorizedClient', 'The provided client_id is invalid'));
                else {

                    var client = response.client;

                    // Check identifier
                    if (client._id.toString() === data.client_id) {

                        // Validate access token
                        app.get('tokenValidation')(client.token.access_token, data.access_token).then(function (result) {
                            switch (result) {
                                case 'error': requester(errorCodes.respondWith('serverError')); break;
                                case false: requester(errorCodes.respondWith('accessDenied', 'The provided token is invalid')); break;
                                case true:
                                    // Validate lifetime
                                    if ((client.token.issued + settings.tokenLifetime) > ((+ new Date()) / 1000)) requester({ clientAuthorized: true });
                                    else requester(errorCodes.respondWith('accessDenied', 'The provided token has been expired'));
                                    break;
                            }
                        });

                    } else requester(errorCodes.respondWith('unauthorizedClient', 'The provided client is not authorized'));

                }
            });
        }

    },

    refreshToken: function (data, res, app) {

        app.get('findClient')({ _id : data.client_id }).then(function (response) {
            if (response.err) { return; }
            else if (!response.client) { return; }
            else {

                var client = response.client,
                    requester = function (message) {
                        app.get('makeRequest')({
                            contentType: 'application/x-www-form-urlencoded',
                            res: res,
                            uri: client.redirect_uri,
                            port: client.port,
                            state: data.state,
                            message: message,
                            settings: settings,
                            cacheControl: 'no-store'
                        });
                    };

                if (client._id.toString() !== data.client_id) requester(errorCodes.respondWith('unauthorizedClient'));
                else {

                    app.get('tokenValidation')(client.token.refresh_token, data.refresh_token).then(function (result) {
                        switch(result) {
                            case 'error': requester(errorCodes.respondWith('serverError')); break;
                            case false: requester(errorCodes.respondWith('accessDenied', 'The provided token is invalid')); break;
                            case true:

                                generateToken('bearer').then(function (bearer) {
                                    generateToken('refresh').then(function (refresh) {

                                        var refreshedTokens = {
                                            access_token: bearer.hash,
                                            token_type: 'Bearer',
                                            refresh_token: refresh.hash,
                                        };

                                        client.token = {
                                            access_token: bearer.token,
                                            refresh_token: refresh.token,
                                            issued: ((+ new Date()) / 1000)
                                        };

                                        client.save(function (err, updatedClient) {
                                            if (err) requester(errorCodes.respondWith('serverError'));
                                            else {
                                                refreshedTokens.auth_server = settings.name;
                                                refreshedTokens.expires_in = settings.tokenLifetime;
                                                requester(refreshedTokens);
                                            }
                                        });

                                    });
                                });

                                break;

                        }
                    });

                }

            }
        });

    }
};