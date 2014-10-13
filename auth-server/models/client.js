var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var clientSchema = new Schema({

    name: { type: String, index: true },
    redirect_uri: String,
    port: Number,
    code: String,
    token: {
        token_type: String,
        access_token: String,
        refresh_token: String,
        issued: Number
    }

});

module.exports = mongoose.model('Client', clientSchema);