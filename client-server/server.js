process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// Necessary for this setup, because we don't have a CA signed certificate

var https = require('https'),
    colors = require('colors'),
    q = require('q'),

    settings = require('../settings').clientServer,
    errorCodes = require('../shared/error-codes'),
    operations = require('./operations'),

    app = require('../shared/app')(__dirname),
    mongoose = require('mongoose'),
    db = mongoose.connection,
    Authserver = require('./models/authserver');

// Open a connection with the client Mongo database
mongoose.connect(settings.database);
db.on('error', console.error.bind(console, '\' Something went wrong during connecting to the client database! \''.red));
db.once('open', function () {
    console.log('\n---------------------------------'.grey);
    console.log('Client server and database online'.yellow);
    console.log('---------------------------------\n'.grey);
});

// Create and start the https server using the Express app
https.createServer(settings.options, app).listen(settings.port);


//
// Global functionality for this server
app.set('findAuthserver', function (options) {
    return q.promise(function (resolve) {
        Authserver.find(options, function (err, authServers) {
            if (err) { console.log('An error occured during getting an authorization server out of the database:'.red, err.red); resolve({ err: err, authServers: false }); }
            if (authServers.length > 0) resolve({ err: false, authServers: authServers });
            else {
                console.log('Authorization server not found in database (based on provided options), stopping the process'.red);
                resolve({ err: false, authServers: false });
            }
        });
    });
});


/*
    Routes
*/

// Default
app.get('/', function (req, res) {
    res.send(errorCodes.respondWith('invalidRequest', 'This route is a dead end..'));
});

// Registration response of the authorization server
app.post(settings.routes.registration_response, function (req, res) {

    app.get('validateResponse')('authorization server', req.body, res).then(function (response) {
        operations.saveRegistration(response);
    });

});

//
// Authorization
app.get(settings.routes.authorization_start, function (req, res) {

    // Just for this setup, to make it more dynamically
    Authserver.findOne({}, function (err, authServer) {

        // A browser interface for this setup, so the client can start the authorization process
        res.render('start-authorization', { authServerName: authServer.name, thisClientName: settings.name });

    });

});

app.post(settings.routes.authorization_start, function (req, res) {

    // Redirect the end-user to the authorization end-point of the authorization server
    operations.startAuthorization(req.body, res, app);

});

app.post(settings.routes.authorization_response, function (req, res) {

    // Recieving the grant code, if the end-user granted access
    app.get('validateResponse')('authorization server', req.body, res).then(function (response) {
        operations.requestAccessToken(req.query, res, app);
    });

});

//
// Tokens
app.post(settings.routes.token_response, function (req, res) {

    // Recieving the tokens
    app.get('validateResponse')('authorization server', req.body, res).then(function (response) {
        operations.saveTokens(response, res, app);
    });

});

app.post(settings.routes.refresh_response, function (req, res) {

    // Recieving and saving the refreshed tokens
    var response = app.get('urlencodedParser')(req.body);
    app.get('validateResponse')('authorization server', response, res).then(function (response) {
        operations.updateTokens(response, res, app);
    });

});

//
// Get protected data
app.get(settings.routes.get_protected_data, function (req, res) {

    // Start the request to the resource server
    if (!req.query.resource || !req.query.file) res.send(errorCodes.respondWith('invalidRequest', 'You need to specify the protected file and the file\'s resource server: \'?file= ... &resource= ...\' ')); // For this setup only
    else operations.getProtectedData(req.query, res, app);

});

app.post(settings.routes.recieve_protected_data, function (req, res) {

    // Recieving the resource server response
    app.get('validateResponse')('resource server', app.get('urlencodedParser')(req.body), res, true).then(function (response) {

        app.get('requestOutOfBuffer')(req.params.requestToken).then(function (request) {

            if (response.error) {
                // Try to refesh the tokens once after a denial of access
                if (response.error === 'access_denied') operations.refreshTokens(request, res, app);
                else return;
            } else {
                console.log(response.fileUri);
                res.redirect('https://' + response.fileUri);
            }

            app.get('removeRequestFromBuffer')(request.index);

        });

    });

});