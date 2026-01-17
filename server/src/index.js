const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const projectRoutes = require('./routes/projects');
const budgetRoutes = require('./routes/budgets');
const ledgerRoutes = require('./routes/ledgers');
const uploadRoutes = require('./routes/upload');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/ledgers', ledgerRoutes);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
