# TV Production Cost Tracker

A web application for Location Managers to compare actual costs from ledgers to budgeted costs for TV production.

## Features

- **Project Management**: Create and manage multiple productions
- **Budget Tracking**: Add and organize budget items by category
- **Ledger Management**: Track actual expenses with vendor details, invoices, and payment status
- **PDF Import**: Upload PDFs and automatically extract cost data
- **Cost Comparison**: Compare budgeted vs actual costs by category, location, or episode
- **Visual Dashboard**: Charts and summaries showing budget status and spending distribution

## Cost Categories

Pre-configured categories for Location Management:
- Location Fees
- Permits & Licenses
- Security
- Parking
- Site Preparation
- Site Restoration
- Catering/Craft Services
- Crew Accommodations
- Transportation
- Equipment Rentals
- Insurance
- Utilities
- Communication
- Office Supplies
- Petty Cash
- Miscellaneous

## Setup

### Prerequisites
- Node.js 18+
- npm

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Start the development servers:
```bash
npm run dev
```

This starts both the backend (port 5000) and frontend (port 3000).

### Individual Commands

```bash
# Start backend only
npm run server

# Start frontend only
npm run client

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── components/     # React components
│       │   ├── ProjectList.js
│       │   ├── ProjectDashboard.js
│       │   ├── BudgetManager.js
│       │   ├── LedgerManager.js
│       │   ├── Comparison.js
│       │   └── Upload.js
│       ├── App.js
│       ├── index.js
│       └── styles.css
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   │   ├── projects.js
│   │   │   ├── budgets.js
│   │   │   ├── ledgers.js
│   │   │   ├── upload.js
│   │   │   └── reports.js
│   │   ├── database.js    # SQLite database
│   │   └── index.js       # Express server
│   ├── data/              # SQLite database files
│   └── uploads/           # Uploaded PDFs
└── package.json
```

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Budgets
- `GET /api/budgets/categories` - Get cost categories
- `GET /api/budgets/project/:projectId` - Get budget items
- `POST /api/budgets` - Create budget item
- `POST /api/budgets/bulk` - Bulk create items
- `PUT /api/budgets/:id` - Update item
- `DELETE /api/budgets/:id` - Delete item

### Ledgers
- `GET /api/ledgers/project/:projectId` - Get ledger entries
- `POST /api/ledgers` - Create entry
- `POST /api/ledgers/bulk` - Bulk create entries
- `PUT /api/ledgers/:id` - Update entry
- `DELETE /api/ledgers/:id` - Delete entry

### Reports
- `GET /api/reports/comparison/:projectId` - Budget vs actual comparison
- `GET /api/reports/dashboard/:projectId` - Dashboard data
- `GET /api/reports/variance/:projectId` - Detailed variance report
- `GET /api/reports/by-location/:projectId` - Spending by location
- `GET /api/reports/by-episode/:projectId` - Spending by episode

### Upload
- `POST /api/upload/pdf/:projectId` - Upload and parse PDF
- `POST /api/upload/import/:fileId` - Import parsed entries
- `GET /api/upload/files/:projectId` - List uploaded files
- `DELETE /api/upload/files/:fileId` - Delete uploaded file

## Usage

1. **Create a Production**: Start by creating a new production project
2. **Add Budget Items**: Enter your budgeted costs by category
3. **Track Expenses**: Add ledger entries as costs are incurred, or upload PDF invoices
4. **Compare**: Use the comparison view to see budget vs actual spending
5. **Monitor**: Check the dashboard for at-a-glance status and alerts

## License

ISC
