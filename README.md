# Location Cost Tracker

A web application for Location Managers to track and compare actual costs vs budgets for TV production locations. Organized like your tracking spreadsheet with tabs for episodes and sets.

## Features

- **Production Management**: Create and manage multiple productions (shows/seasons)
- **Episode/Tab Organization**: Organize by episodes (101, 102, etc.) or groups (Backlot, Amort)
- **Set-Based Tracking**: Each filming location (set) has its own budget and cost tracking
- **Spreadsheet-Style Interface**: Familiar layout matching how you already work
- **Real-time Variance**: See Under/Over budget status instantly per set and category
- **PDF Import**: Upload PDFs and extract cost data automatically

## Cost Categories

Matches your actual tracking spreadsheet:
- Loc Fees
- Security
- Fire
- Rentals
- Permits
- Police

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
│   └── src/
│       ├── components/
│       │   ├── ProjectList.js    # Production list
│       │   ├── ProjectView.js    # Main view with episode tabs
│       │   ├── SetCard.js        # Individual set cost tracking
│       │   └── SetDetail.js      # Detailed set view
│       ├── App.js
│       └── styles.css
├── server/                 # Node.js backend
│   └── src/
│       ├── routes/
│       │   ├── projects.js       # Production CRUD
│       │   ├── episodes.js       # Episode/tab management
│       │   ├── sets.js           # Set/location management
│       │   ├── costs.js          # Cost entries
│       │   ├── reports.js        # Comparison reports
│       │   └── upload.js         # PDF upload/import
│       ├── database.js           # SQLite schema
│       └── index.js
└── package.json
```

## API Endpoints

### Projects
- `GET /api/projects` - List all productions
- `GET /api/projects/:id` - Get production with summary
- `POST /api/projects` - Create production
- `DELETE /api/projects/:id` - Delete production

### Episodes (Tabs)
- `GET /api/episodes/project/:projectId` - Get episodes for a production
- `POST /api/episodes` - Create episode/tab
- `DELETE /api/episodes/:id` - Delete episode

### Sets
- `GET /api/sets/episode/:episodeId` - Get sets for an episode
- `GET /api/sets/:id` - Get set with cost details
- `POST /api/sets` - Create set with budget
- `PUT /api/sets/:id` - Update set budget
- `DELETE /api/sets/:id` - Delete set

### Costs
- `GET /api/costs/set/:setId` - Get cost entries for a set
- `POST /api/costs` - Add cost entry
- `PUT /api/costs/:id` - Update cost entry
- `DELETE /api/costs/:id` - Delete cost entry

### Reports
- `GET /api/reports/dashboard/:projectId` - Dashboard summary
- `GET /api/reports/comparison/:projectId` - Budget vs actual by category
- `GET /api/reports/by-episode/:projectId` - Spending by episode
- `GET /api/reports/set/:setId` - Detailed set report

## Usage

1. **Create a Production**: e.g., "Shards Season 1"
2. **Add Tabs**: Episodes (101, 102, etc.) and groups (Backlot, Amort) are created automatically, add more as needed
3. **Add Sets**: For each filming location, add a set with its budget per category
4. **Track Costs**: Click "+ Add" on any category row to add actual costs
5. **Monitor**: Each set shows real-time Under/Over budget status

## License

ISC
