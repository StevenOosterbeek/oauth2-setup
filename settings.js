var fs = require('fs');

module.exports = {

    // Set to true to let the system log all requests in the console
    logRequests: true,

    // Authorization server
    authServer: {
        name: 'stevens-authorization-server',
        port: 2500,
        options: {
            host: 'localhost',
            key: fs.readFileSync('../auth-server/certificate/auth-private-key.pem'),
            cert: fs.readFileSync('../auth-server/certificate/auth-certificate.pem')
        },
        database: 'mongodb://localhost/steven-oauth-auth',
        routes: {
            registration_endpoint: '/register',
            authorization_endpoint: '/authorize',
            token_endpoint: '/token',
            token_refresh: '/token-refresh',
            token_validation: '/token-validation'
        },
        tokenLifetime: 3600
    },

    // Client server
    clientServer: {
        name: '', // Will be set dynamically through registration in this setup
        port: 3000,
        options: {
            host: 'localhost',
            key: fs.readFileSync('../client-server/certificate/client-private-key.pem'),
            cert: fs.readFileSync('../client-server/certificate/client-certificate.pem')
        },
        database: 'mongodb://localhost/steven-oauth-client',
        routes: {
            registration_response: '/registration-response',
            authorization_start: '/authorize',
            authorization_response: '/authorization-response',
            token_response: '/token-response',
            refresh_response: '/refresh-response',
            get_protected_data: '/get-data',
            recieve_protected_data: '/data-response/:requestToken'
        }
    },

    // (Static) Resource server - should of course also be added dynamically
    resourceServer: {
        name: 'stevens-resource-server',
        port: 3500,
        options: {
            host: 'localhost',
            key: fs.readFileSync('../resource-server/certificate/resource-private-key.pem'),
            cert: fs.readFileSync('../resource-server/certificate/resource-certificate.pem')
        },
        database: 'mongodb://localhost/steven-oauth-resource',
        routes: {
            protected_data: '/get-data',
            token_validation_response: '/token-validation-response/:requestToken',
            get_file: '/file/:fileToken'
        },
        protectedDataFolder: 'protected-resources'
    }

};