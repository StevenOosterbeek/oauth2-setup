process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// Necessary for this setup, because we don't have a CA signed certificate

var https = require('https'),
    colors = require('colors'),
    q = require('q'),

    settings = require('../settings').resourceServer,
    errorCodes = require('../shared/error-codes'),
    operations = require('./operations'),
    app = require('../shared/app')(__dirname);

// Create and start the https server using the Express app
https.createServer(settings.options, app).listen(settings.port);


/*
    Routes
*/

// Default route
app.get('/', function (req, res) {
    res.send(errorCodes.respondWith('invalidRequest', 'This route is a dead endpoint..'));
});

//
// Data routes
app.post(settings.routes.protected_data, function (req, res) {

    // Start the access token validation
    var request = app.get('urlencodedParser')(req.body);
    if (!request.redirect_uri) { console.log('The client did not provide a redirect URI, stopping the process'); res.end(); return; }
    else operations.validateAccessToken(request, res, app);

});

app.post(settings.routes.token_validation_response, function (req, res) {

    app.get('requestOutOfBuffer')(req.params.requestToken).then(function (request) {

        // Receive the token validation and respond to the requester
        var response = app.get('urlencodedParser')(req.body);
        operations.respond(request, response, res, app);

    });

});

//
// Files buffer
var fileBuffer = {
        buffer: [],
        add: function (file) {
            this.buffer.push(file);
        },
        remove: function (index) {
            this.buffer.splice(index, 1);
        }
    };

app.set('addFileToBuffer', function (file) {
    fileBuffer.add(file);
});

app.set('removeFileFromBuffer', function (index) {
    fileBuffer.remove(index);
});

app.get(settings.routes.get_file, function (req, res) {

    /*
        If access is granted, the file can be GET through
        the combination of the file URI and a created file token
    */

    operations.sendFile(fileBuffer.buffer, req.params.fileToken, res, app);

});

console.log('\n----------------------'.grey);
console.log('Resource server online'.magenta);
console.log('----------------------\n'.grey);