const express = require('express');
const cors = require('cors');
const path = require('path');

// Use DynamoDB in Lambda, file-based locally
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const { initializeDatabase } = isLambda
  ? require('./database-dynamodb')
  : require('./database');

const projectRoutes = require('./routes/projects');
const episodeRoutes = require('./routes/episodes');
const setRoutes = require('./routes/sets');
const costRoutes = require('./routes/costs');
const uploadRoutes = require('./routes/upload');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TV Production Cost Tracker API is running' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'));
  });
}

// Only start server when not in Lambda
if (!isLambda) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Lambda
module.exports = app;
