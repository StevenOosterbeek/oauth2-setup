module.exports = {

    // All OAuth2.0 protocol single ASCII error codes
    invalidRequest: { error: 'invalid_request' },
    unauthorizedClient: { error: 'unauthorized_client' },
    accessDenied: { error: 'access_denied' },
    unsupportedResponseType: { error: 'unsupported_response_type' },
    invalidScope: { error: 'invalid_scope' },
    serverError: { error: 'server_error' },
    temporarilyUnavailable: { error: 'temporarily_unavailable' },
    insufficientScope: { error: 'insufficient_scope' }, // Bearer protocol

    respondWith: function(type, description, uri, state) {
        if (type === 'serverError') this[type].error_description = 'Sorry, an internal server error occured. Please try again later';
        if (description) this[type].error_description = description;
        if (uri) this[type].error_uri = uri;
        if (state) this[type].state = state;
        return this[type];
    }

};