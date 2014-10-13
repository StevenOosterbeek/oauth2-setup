process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// Necessary for this setup, because we don't have a CA signed certificate

var https = require('https'),
    colors = require('colors'),
    q = require('q'),
    bcrypt = require('bcrypt'),

    settings = require('../settings').authServer,
    errorCodes = require('../shared/error-codes'),
    operations = require('./operations'),

    app = require('../shared/app')(__dirname),
    mongoose = require('mongoose'),
    db = mongoose.connection,
    Client = require('./models/client');

// Open a connection with the authorization Mongo database
mongoose.connect(settings.database);
db.on('error', console.error.bind(console, '\' Something went wrong during connecting to the authorization database! \''));
db.once('open', function () {
    console.log('\n----------------------------------------'.grey);
    console.log('Authorization server and database online'.cyan);
    console.log('----------------------------------------\n'.grey);
});

// Create and start the https server using the Express app
https.createServer(settings.options, app).listen(settings.port);


//
// Global functionality for this server
app.set('findClient', function (options) {
    return q.promise(function (resolve) {
        Client.findOne(options, function (err, client) {
            if (err) { console.log('An error occured during getting a client out of the database:'.red, err); resolve({ err: err, client: client }); }
            if (client !== null && client !== undefined) resolve({ err: false, client: client });
            else resolve({ err: false, client: false });
        });
    });
});

app.set('tokenValidation', function (token, hash) {
    return q.promise(function (resolve) {
        bcrypt.compare(token, hash, function(err, isCorrect) {
            if (err) resolve('error');
            else resolve(isCorrect);
        });
    });
});


/*
    Routes
*/

// Default
app.get('/', function (req, res) {
    res.send(errorCodes.respondWith('invalidRequest', 'This route is a dead endpoint'));
});

//
// Register
app.get(settings.routes.registration_endpoint, function (req, res) {

    // A browser interface for this setup, but the client server is also able to make a POST request directly to this server
    res.render('register-client', { registrationEndpoint: settings.routes.registration_endpoint });

});

app.post(settings.routes.registration_endpoint, function (req, res) {

    // The request must be 'application/x-www-form-urlencoded', according to the OAuth 2.0 protocol
    if (req.get('Content-Type') !== 'application/x-www-form-urlencoded') res.send(errorCodes.respondWith('invalidRequest', 'Registering a client should happen through an \'application/x-www-form-urlencoded\' POST request'));
    else operations.register(req.body, res, app);

});

//
// Authorization
app.get(settings.routes.authorization_endpoint, function (req, res) {

    // Start the authentication
    operations.authenticateUser(req, res, app);

});

app.post(settings.routes.authorization_endpoint, function (req, res) {

    // Validate the end-users choice
    operations.authorizeClient(req.body, res, app);

});

app.post(settings.routes.token_endpoint, function (req, res) {

    // Issue an access token
    if (req.get('Content-Type') !== 'application/x-www-form-urlencoded') res.send(errorCodes.respondWith('invalidRequest', 'Requesting an access token should happen through an \'application/x-www-form-urlencoded\' POST request'));
    else operations.issueAccessToken(app.get('urlencodedParser')(req.body), res, app);

});

//
// Tokens
app.post(settings.routes.token_validation, function (req, res) {

    // Validation of an access token
    var requestMessage = app.get('urlencodedParser')(req.body);
    if (!requestMessage.redirect_uri) { console.log('Resource server did not provide a redirect URI, stopping process.'); res.end(); return; }
    else operations.validateToken(requestMessage, res, app);

});

app.post(settings.routes.token_refresh, function (req, res) {

    // Refreshing the tokens
    var request = app.get('urlencodedParser')(req.body);
    if (!request.client_id || !request.refresh_token) { console.log('Did recieve a refresh request, but the requester did not provide his identifier or the refresh token. Stopping the process.'.red); res.end(); return; }
    else operations.refreshToken(request, res, app);

});