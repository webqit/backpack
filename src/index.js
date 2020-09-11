
/**
 * @imports
 */
import Url from 'url';
import Request from 'request';
import Sessions from 'client-sessions';
import Jsonwebtoken from 'jsonwebtoken';
import _intersect from '@onephrase/util/arr/intersect.js';
import _arrFrom from '@onephrase/util/arr/from.js';
import _promise from '@onephrase/util/js/promise.js';

/**
 * OAuth util class
 */
export default class OAuth2CodeFlow {

    /**
     * Returns a function suitable as a middleware.
     * 
     * @param object params
     * 
     * @return function
     */
    static createMiddleware(params) {
        var sessionMiddleware = Sessions({
            cookieName: 'authSession',      // cookie name dictates the key name added to the request object
            secret: 'bla343434343rgadeeblargblarg',  // should be a large unguessable string
            duration: 24 * 60 * 60 * 1000,  // how long the session will stay valid in ms
            activeDuration: 1000 * 60 * 5   // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
        });
        return async (request, response, next) => {
            return await sessionMiddleware(request, response, async () => {
                request.oauth = new OAuth2CodeFlow(request, response, params);
                return await next();
            });
        };
    }

    /**
     * Creates an auth API
     * 
     * @param object params 
     *      authorizationURL,
     *      tokenURL,
     *      callbackURL,
     *      clientId,
     *      clientSecret,
     * @param object request
     * @param object response
     * '
     * @return void
     */
    constructor(request, response, params) {
        this.request = request;
        this.response = response;
        this.params = params;
        this.credentials = this.request.authSession.oauth;
    }
    
    /**
     * Checks if the current session is authenticated,
     * and otpionally, with the specified scope.
     * Initiates the Authentication Code Flow if not.
     * 
     * (Be sure to end current running code after calling this function.)
     * 
     * @param array scope - Optional "scope" to require.
     * @param string audience - Optional "audience" to require.
     * 
     * @return void
     */
    requireAuthentication(scope = [], audience = null) {
        // Already authenticated?
        var credentials;
        if (credentials = this.checkAuthentication(scope, audience)) {
            return credentials;
        }
        // Initiate Authentication Code Flow
        this.startAuthenticationFlow(scope, audience);
    }
    
    /**
     * Checks if the current session is authenticated,
     * and otpionally, with the specified scope.
     * 
     * @param array scope - Optional "scope" to check.
     * @param string audience - Optional "audience" to check.
     * 
     * @return object
     */
    checkAuthentication(scope = [], audience = null) {
        if (!this.credentials) {
            return false;
        }
        if (scope.length) {
            var activeScope = this.credentials.scope.split(' ').map(s => s.trim());
            if (_intersect(_arrFrom(scope), activeScope).length !== activeScope.length) {
                return false;
            }
        }
        if (audience) {
            var activeAud = this.credentials.identity.aud.split(' ').map(s => s.trim());
            if (_intersect(_arrFrom(audience), activeAud).length !== activeAud.length) {
                return false;
            }
        }
        return this.credentials;
    }
    
    /**
     * Starts a login session.
     * 
     * @param object credentials
      * 
     * @return void
     */
    login(credentials) {
        this.credentials = credentials;
        if (this.request.authSession && this.params.sessions !== false) {
            this.request.authSession.oauth = credentials;
        }
    }
        
    /**
     * Terminates the current login session.
     * 
     * @return void
     */
    logout() {
        delete this.credentials;
        if (this.request.authSession) {
            delete this.request.authSession.oauth;
        }
    }
    
    /**
     * Initiates the OAuth2 Authentication Code Flow
     * by sending the client to the specified IdP.
     * 
     * (Be sure to end current running code after calling this function.)
     * 
     * @param array scope - Optional "scope" parameter for the request.
     * @param string audience - Optional "audience" parameter for the request.
     * 
     * @return void
     */
    startAuthenticationFlow(scope = [], audience = null) {
        // Is code auth
        var i = 0, oauthStateCode = '';
        if (this.request.authSession) {
            while(i < 1) {oauthStateCode += Math.random(); i ++;}
            this.request.authSession.oauthState = {
                oauthStateCode,
                initiatorURL: this.request.url,
            };
        }
        this.response.writeHead(302, {Location: this.params.authorizationURL
            + '?response_type=code'
            + '&client_id=' + this.params.clientId
            + '&redirect_uri=' + this.params.callbackURL
            + (scope.length ? '&scope=' + _arrFrom(scope).join('%20') : '') // "offline_access" - to include refresh_token
            + (audience ? '&audience=' + audience : '')
            + (oauthStateCode ? '&state=' + oauthStateCode : '')
        });
        this.response.end();
    }

    /**
     * Handles the redirection from the OAuth2 Authentication Code Flow;
     * expects to see the "code" and "state" parameter in the URL.
     * 
     * Exchanges the recieved "code" for tokens and stores the result
     * as "oauth" in the user session.
     * 
     * On success, redirects the client back to the URL that initiated the
     * Authentication Code Flow.
     * 
     * @param function callback
     * 
     * @return Promise
     */
    async finishAuthenticationFlow(callback = null) {
        var oauthState, url = Url.parse(this.request.url, true);
        if (!url.query.code) {
            return;
        }

        if (this.request.authSession && this.request.authSession.oauthState) {
            if (url.query.state !== this.request.authSession.oauthState.oauthStateCode) {
                throw new Error('Invalid request; state mismatch.');
            }
            oauthState = this.request.authSession.oauthState;
            delete this.request.authSession.oauthState;
        } else if (url.query.state) {
            throw new Error('Invalid request; unexpected "state" parameter.');
        }

        var options = {
            method: 'POST',
            url: this.params.tokenURL,
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            form: {
                grant_type: 'authorization_code', // or refresh_token
                client_id: this.params.clientId,
                client_secret: this.params.clientSecret,    // not needed for type refresh_token
                code: url.query.code,                       // not needed for type refresh_token
                redirect_uri: this.params.callbackURL,      // not needed for type refresh_token
                                                            // refresh_token: the body.refresh_token in previous request
            }
        };
        var data = await _promise((resolve, reject) => {
            Request(options, (error, response, body) => {
                if (error || response.statusCode !== 200) {
                    reject('Authentication error; ' + (error || body));
                    return;
                }
                resolve(JSON.parse(body));
            });
        });

        var credentials = { ...data };
        if (data.id_token) {
            data.id_token = Jsonwebtoken.decode(data.id_token, {complete: true});
            // Verify signing algorithm - "data.id_token.header.alg" - HS256, RS256
            // Verify token audience claims - "data.id_token.payload.aud" - roughly this.params.clientId
            // Verify permissions (scopes) - "data.id_token.payload.scope" - from the initiator request
            // Verify issuer claims - "data.id_token.payload.iss" - usually the domain part in this.params.authorizationURL
            // Verify expiration - "data.id_token.payload.exp" - must be after the current date/time
            // Starts a login session
            delete credentials.id_token;
        }
        if (callback) {
            credentials.identity = await callback(data);
        } else {
            credentials.identity = data.id_token.payload;
        }
        this.login(credentials);
        // Redirect back to initiator URL
        if (oauthState && oauthState.initiatorURL !== this.request.url) {
            this.response.writeHead(302, {Location: oauthState.initiatorURL});
            this.response.end();
            return 302;
        }

    }
};