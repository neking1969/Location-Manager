const serverless = require('serverless-http');
const app = require('./index');

// Export handler for AWS Lambda
module.exports.handler = serverless(app);
