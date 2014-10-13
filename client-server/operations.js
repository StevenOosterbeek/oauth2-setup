var colors = require('colors'),
    q = require('q'),

    settings = require('../settings').clientServer,
    Authserver = require('./models/authserver'),
    errorCodes = require('./../shared/error-codes'),
    generateToken = require('./../shared/token-generator/generator');

// All client-server operations
module.exports = {

    saveRegistration: function (data) {

        settings.name = data.client_name; // Just in this setup to make it look more dynamically

        var newAuthServer = {
            identifier: data.client_id,
            name: data.name,
            redirect_uri: data.redirect_uri,
            states: {
                authorization: data.authorization_state,
                token: data.token_state,
                token_validation: data.token_validation_state,
                token_refresh: data.token_refresh_state
            }
        };

        Authserver.create(newAuthServer, function (err, createdAuthRecord) {
            if (err) console.log('An error occured during saving the authorization server details -'.red, err.red);
            // The client is now registered at the authorization server
        });

    },

    startAuthorization: function (data, res, app) {

        app.get('findAuthserver')({ name: data.authServerName }).then(function (response) {
            if (response.err) res.send(errorCodes.respondWith('serverError'));
            else if (!response.authServers) res.send(errorCodes.respondWith('invalidRequest', 'Sorry, the provided authorization server name is invalid'));
            else {
                var redirect_uri = settings.options.host + ':' + settings.port,
                    authServer = response.authServers[0],
                    query = authServer.redirect_uri + '/' + authServer.states.authorization + '?response_type=code&client_id=' + authServer.identifier + '&redirect_uri=' + redirect_uri + '&state=' + settings.routes.authorization_response.replace('/', '');

                res.redirect('https://' + query);
            }
        });

    },

    requestAccessToken: function (data, res, app) {

        app.get('findAuthserver')({ name: data.authname }).then(function (response) {
            if (response.err) res.send(errorCodes.respondWith('serverError'));
            else if (!response.authServers) res.send(errorCodes.respondWith('invalidRequest', 'Sorry, the provided authorization server name is invalid'));
            else {

                // Also check if the authorization server has specified a specific port
                var authServer = response.authServers[0],
                    requestMessage = {
                        grant_type: 'code',
                        code: data.code,
                        redirect_uri: settings.options.host + ':' + settings.port,
                        state: settings.routes.token_response
                    };

                // Request the access token
                app.get('makeRequest')({
                    contentType: 'application/x-www-form-urlencoded',
                    res: res,
                    uri: app.get('uriSplitter')(authServer.redirect_uri).uri,
                    port: app.get('uriSplitter')(authServer.redirect_uri).port,
                    state: authServer.states.token,
                    message: requestMessage,
                    settings: settings
                });

            }
        });

    },

    saveTokens: function (data, res, app) {

        app.get('findAuthserver')({ name: data.auth_server }).then(function (response) {
            if (response.err) res.send(errorCodes.respondWith('serverError'));
            else if (!response.authServers) res.send(errorCodes.respondWith('invalidRequest', 'Sorry, the provided authorization server name is invalid'));
            else {

                var authServer = response.authServers[0],
                    resources = authServer.resources;

                authServer.token = {
                    access_token: data.access_token,
                    token_type: data.token_type,
                    expires_in: data.expires_in,
                    refresh_token: data.refresh_token
                };

                resources.push({
                    name: data.resource_name,
                    resource_uri: data.resource_uri,
                    resource_get_data_state: data.resource_get_data_state
                });

                authServer.resources = resources;

                authServer.save(function (err, updatedAuthserver) {
                    if (err) { console.log('Something went wrong during saving the issued tokens to the right authorization server: '.red, err.red); return; }
                    // The tokens are now saved, so the client is now authorized to request the protected data from the resource server
                });

            }
        });

    },

    getProtectedData: function (data, res, app) {

        app.get('findAuthserver')({}).then(function (response) {
            if (response.err) res.send(errorCodes.respondWith('serverError'));
            else if (!response.authServers) res.send(errorCodes.respondWith('invalidRequest', 'Sorry, the provided authorization server name is invalid'));
            else {

                // Find the right authorization server for the resource
                var allFoundServers = response.authServers,
                    authorizationServer,
                    resourceData;

                if (allFoundServers.length < 1) res.send(errorCodes.respondWith('invalidRequest', 'The provided resource server name is invalid'));
                else {

                    var requestProtectedData = function () {

                        var requestToken = generateToken('request'),
                            message = {
                                access_token: authorizationServer.token.access_token,
                                client_id: authorizationServer.identifier,
                                validation_uri: authorizationServer.redirect_uri,
                                validation_uri_state: '/' + authorizationServer.states.token_validation,
                                file: data.file,
                                redirect_uri: (settings.options.host + ':' + settings.port),
                                state: settings.routes.recieve_protected_data.replace(':requestToken', requestToken)
                            };

                        app.get('makeRequest')({
                            contentType: 'application/x-www-form-urlencoded',
                            res: res,
                            uri: app.get('uriSplitter')(resourceData.resource_uri).uri,
                            port: app.get('uriSplitter')(resourceData.resource_uri).port,
                            state: resourceData.resource_get_data_state,
                            message: message,
                            settings: settings,
                            cacheControl: 'no-store'
                        });

                        app.get('addRequestToBuffer')({ name: authorizationServer.name, token: requestToken });

                    };

                    allFoundServers.forEach(function (authServer) {
                        authServer.resources.forEach( function (resource, index) {
                            if (resource.name === data.resource) {
                                authorizationServer = authServer;
                                resourceData = resource;
                            }
                            if ((index+1) === authServer.resources.length) requestProtectedData();
                        });
                    });

                }

            }
        });

    },

    refreshTokens: function (request, res, app) {

        app.get('findAuthserver')({ name: request.data.name }).then(function (response) {
            if (response.err) res.send(errorCodes.respondWith('serverError'));
            else if (!response.authServers) res.send(errorCodes.respondWith('invalidRequest', 'The provided authorization server name is invalid'));
            else {

                var server = response.authServers[0],
                    refreshMessage = {
                        client_id: server.identifier,
                        refresh_token: server.token.refresh_token,
                        state: settings.routes.refresh_response
                    };

                app.get('makeRequest')({
                    contentType: 'application/x-www-form-urlencoded',
                    res: res,
                    uri: app.get('uriSplitter')(server.redirect_uri).uri,
                    port: app.get('uriSplitter')(server.redirect_uri).port,
                    state: '/' + server.states.token_refresh,
                    message: refreshMessage,
                    settings: settings
                });

            }
        });

    },

    updateTokens: function (data, res, app) {

        if (!data.auth_server || !data.access_token || !data.token_type || !data.refresh_token || !data.expires_in) {
            console.log('The authorization server did not provide all the necessary data for refreshing the tokens. Stopping the process.'.red);
        } else {

            // Save the refreshed tokens
            app.get('findAuthserver')({ name: data.auth_server }).then(function (response) {
                if (response.err) res.send(errorCodes.respondWith('serverError'));
                else if (!response.authServers) res.send(errorCodes.respondWith('serverError'));
                else {

                    delete data.auth_server;
                    var authServerToRefresh = response.authServers[0];
                    authServerToRefresh.token = data;

                    authServerToRefresh.save(function (err, updatedAuthServer) {
                        if (err) console.log('An error occured during saving the refreshed tokens. Stopping the process.'.red);
                        else console.log('\nThe access token was expired, but has now been refreshed! Try to get the file again.\n'.green);
                    });

                }
            });

        }

    }

};