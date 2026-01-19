const serverless = require('serverless-http');
const app = require('./index');

// Export handler for AWS Lambda with binary support for file uploads
module.exports.handler = serverless(app, {
  binary: ['multipart/form-data', 'application/pdf', 'application/octet-stream']
});
