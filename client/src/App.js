import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import ProjectView from './components/ProjectView';
import SetDetail from './components/SetDetail';

function App() {
  const [currentProject, setCurrentProject] = useState(null);

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            Location Manager
          </Link>
        </h1>
        {currentProject && (
          <nav>
            <Link to={`/project/${currentProject.id}`} className="active">
              {currentProject.name}
            </Link>
          </nav>
        )}
      </header>

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={<ProjectList onSelectProject={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/*"
            element={<ProjectView onProjectLoad={setCurrentProject} />}
          />
          <Route
            path="/set/:setId"
            element={<SetDetail />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
