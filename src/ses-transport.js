'use strict';

var AWS = require('aws-sdk');
var packageData = require('../package.json');

// expose to the world
module.exports = function(options) {
    return new SESTransport(options);
};

/**
 * <p>Generates a Transport object for Amazon SES with aws-sdk</p>
 *
 * <p>Possible options can be the following:</p>
 *
 * <ul>
 *     <li><b>accessKeyId</b> - AWS access key (optional)</li>
 *     <li><b>secretAccessKey</b> - AWS secret (optional)</li>
 *     <li><b>region</b> - optional region (defaults to <code>'us-east-1'</code>)
 * </ul>
 *
 * @constructor
 * @param {Object} optional config parameter for the AWS SES service
 */
function SESTransport(options) {
    options = options || {};

    var pattern = /(.*)email(.*)\.(.*).amazonaws.com/i,
        result = pattern.exec(options.ServiceUrl);

    this.options = options;
    this.options.accessKeyId = options.accessKeyId || options.AWSAccessKeyID;
    this.options.secretAccessKey = options.secretAccessKey || options.AWSSecretKey;
    this.options.sessionToken = options.sessionToken || options.AWSSecurityToken;
    this.options.apiVersion = '2010-12-01';
    this.options.region = options.region || (result && result[3]) || 'us-east-1';

    this.name = 'SES';
    this.version = packageData.version;

    this.ses = new AWS.SES(this.options);
}

/**
 * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run when the sending is completed
 */
SESTransport.prototype.send = function(mail, callback) {
    // SES strips this header line by itself
    mail.message.keepBcc = true;

    this.generateMessage(mail.message.createReadStream(), (function(err, email) {
        if (err) {
            return typeof callback === 'function' && callback(err);
        }
        this.handleMessage(email, callback);
    }).bind(this));
};

/**
 * <p>Compiles and sends the request to SES with e-mail data</p>
 *
 * @param {String} email Compiled raw e-mail as a string
 * @param {Function} callback Callback function to run once the message has been sent
 */
SESTransport.prototype.handleMessage = function(email, callback) {
    var params = {
        RawMessage: { // required
            Data: new Buffer(email, 'utf-8') // required
        }
    };
    this.ses.sendRawEmail(params, function(err, data) {
        this.responseHandler(err, data, callback);
    }.bind(this));
};

/**
 * <p>Handles the response for the HTTP request to SES</p>
 *
 * @param {Object} err Error object returned from the request
 * @param {Object} data De-serialized data returned from the request
 * @param {Function} callback Callback function to run on end
 */
SESTransport.prototype.responseHandler = function(err, data, callback) {
    if (err) {
        if (!(err instanceof Error)) {
            err = new Error('Email failed: ' + err);
        }
        return typeof callback === 'function' && callback(err, null);
    }
    return typeof callback === 'function' && callback(null, {
        messageId: data && data.MessageId && data.MessageId + '@email.amazonses.com'
    });
};

/**
 * <p>Compiles the messagecomposer object to a string.</p>
 *
 * <p>SES requires strings as parameter so the message needs to be fully composed as a string.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run once the message has been compiled
 */

SESTransport.prototype.generateMessage = function(emailMessage, callback) {
    var email = '';

    emailMessage.on('data', function(chunk) {
        email += (chunk || '').toString('utf-8');
    });

    emailMessage.on('end', function(chunk) {
        email += (chunk || '').toString('utf-8');
        callback(null, email);
    });
};