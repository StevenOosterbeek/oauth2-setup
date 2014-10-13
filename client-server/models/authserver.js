var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var authServerSchema = new Schema({

    identifier: { type: String, index: true },
    name: String,
    redirect_uri: String,
    states: {
        authorization: String,
        token: String,
        token_validation: String,
        token_refresh: String
    },
    token: {
        access_token: String,
        token_type: String,
        expires_in: Number,
        refresh_token: String
    },

    // An authorization server could host multiple resources
    resources: [{
        name: String,
        resource_uri: String,
        resource_get_data_state: String
    }]

});

module.exports = mongoose.model('Authserver', authServerSchema);