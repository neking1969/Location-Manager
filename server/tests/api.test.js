/**
 * API Integration tests using supertest
 * Tests HTTP endpoints without starting a server
 */

const request = require('supertest');
const app = require('../src/index');
const { resetDatabase, createTestProject, createTestEpisode, createTestSet, createTestCostEntry } = require('./setup');

describe('API Endpoints', () => {
  beforeEach(() => {
    resetDatabase();
  });

  describe('Health Check', () => {
    test('GET /api/health returns ok status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Projects API', () => {
    test('GET /api/projects returns empty array initially', async () => {
      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('POST /api/projects creates a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'New Show',
          description: 'A new TV show',
          total_budget: 500000
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Show');
      expect(response.body.id).toBeDefined();
    });

    test('GET /api/projects returns created projects', async () => {
      await request(app)
        .post('/api/projects')
        .send({ name: 'Show 1' });
      await request(app)
        .post('/api/projects')
        .send({ name: 'Show 2' });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    test('GET /api/projects/:id returns single project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Show' });

      const response = await request(app).get(`/api/projects/${createRes.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Show');
    });

    test('DELETE /api/projects/:id deletes project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .send({ name: 'To Delete' });

      const deleteRes = await request(app).delete(`/api/projects/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app).get('/api/projects');
      expect(getRes.body).toHaveLength(0);
    });
  });

  describe('Episodes API', () => {
    let project;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });
      project = response.body;
    });

    test('GET /api/episodes/project/:id returns episodes', async () => {
      const response = await request(app).get(`/api/episodes/project/${project.id}`);

      expect(response.status).toBe(200);
      // Should have default episodes (Backlot, Amort)
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    test('POST /api/episodes creates new episode', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .send({
          project_id: project.id,
          name: 'Episode 101',
          sort_order: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Episode 101');
    });
  });

  describe('Sets API', () => {
    let project, episode;

    beforeEach(async () => {
      const projectRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });
      project = projectRes.body;

      const episodesRes = await request(app).get(`/api/episodes/project/${project.id}`);
      episode = episodesRes.body[0]; // Use first default episode
    });

    test('POST /api/sets creates set with budgets', async () => {
      const response = await request(app)
        .post('/api/sets')
        .send({
          project_id: project.id,
          episode_id: episode.id,
          set_name: 'Downtown Street',
          location: '123 Main St',
          budget_loc_fees: 5000,
          budget_security: 2000,
          budget_fire: 1500,
          budget_rentals: 1000,
          budget_permits: 500,
          budget_police: 1000
        });

      expect(response.status).toBe(201);
      expect(response.body.set_name).toBe('Downtown Street');
      expect(response.body.budget_loc_fees).toBe(5000);
    });

    test('GET /api/sets/:id returns set with totals', async () => {
      const createRes = await request(app)
        .post('/api/sets')
        .send({
          project_id: project.id,
          episode_id: episode.id,
          set_name: 'Test Set',
          budget_loc_fees: 5000,
          budget_security: 2000
        });

      const response = await request(app).get(`/api/sets/${createRes.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.total_budget).toBe(7000);
      expect(response.body.total_actual).toBe(0);
    });

    test('GET /api/sets/meta/categories returns all categories', async () => {
      const response = await request(app).get('/api/sets/meta/categories');

      expect(response.status).toBe(200);
      expect(response.body).toContain('Loc Fees');
      expect(response.body).toContain('Security');
      expect(response.body).toHaveLength(6);
    });
  });

  describe('Costs API', () => {
    let project, episode, set;

    beforeEach(async () => {
      const projectRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });
      project = projectRes.body;

      const episodesRes = await request(app).get(`/api/episodes/project/${project.id}`);
      episode = episodesRes.body[0];

      const setRes = await request(app)
        .post('/api/sets')
        .send({
          project_id: project.id,
          episode_id: episode.id,
          set_name: 'Test Set',
          budget_loc_fees: 5000
        });
      set = setRes.body;
    });

    test('POST /api/costs creates cost entry', async () => {
      const response = await request(app)
        .post('/api/costs')
        .send({
          set_id: set.id,
          category: 'Loc Fees',
          description: 'Location rental',
          amount: 1500,
          vendor: 'ABC Locations',
          invoice_number: 'INV-001',
          date: '2024-01-15'
        });

      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(1500);
      expect(response.body.category).toBe('Loc Fees');
    });

    test('GET /api/costs/set/:setId returns entries for set', async () => {
      await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Loc Fees', amount: 1000 });
      await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Security', amount: 500 });

      const response = await request(app).get(`/api/costs/set/${set.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    test('POST /api/costs/bulk creates multiple entries', async () => {
      const response = await request(app)
        .post('/api/costs/bulk')
        .send({
          set_id: set.id,
          entries: [
            { category: 'Loc Fees', amount: 1000 },
            { category: 'Security', amount: 500 },
            { category: 'Fire', amount: 300 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(3);
    });

    test('GET /api/costs/summary/project/:id returns budget vs actual', async () => {
      await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Loc Fees', amount: 3000 });

      const response = await request(app).get(`/api/costs/summary/project/${project.id}`);

      expect(response.status).toBe(200);

      const locFeesSummary = response.body.find(s => s.category === 'Loc Fees');
      expect(locFeesSummary.budget).toBe(5000);
      expect(locFeesSummary.actual).toBe(3000);
      expect(locFeesSummary.variance).toBe(2000);
      expect(locFeesSummary.status).toBe('under_budget');
    });

    test('detects over budget status', async () => {
      await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Loc Fees', amount: 7000 });

      const response = await request(app).get(`/api/costs/summary/project/${project.id}`);

      const locFeesSummary = response.body.find(s => s.category === 'Loc Fees');
      expect(locFeesSummary.variance).toBe(-2000);
      expect(locFeesSummary.status).toBe('over_budget');
    });

    test('DELETE /api/costs/:id removes entry', async () => {
      const createRes = await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Loc Fees', amount: 1000 });

      const deleteRes = await request(app).delete(`/api/costs/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app).get(`/api/costs/set/${set.id}`);
      expect(getRes.body).toHaveLength(0);
    });
  });

  describe('Reports API', () => {
    let project, episode, set;

    beforeEach(async () => {
      const projectRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });
      project = projectRes.body;

      const episodesRes = await request(app).get(`/api/episodes/project/${project.id}`);
      episode = episodesRes.body[0];

      const setRes = await request(app)
        .post('/api/sets')
        .send({
          project_id: project.id,
          episode_id: episode.id,
          set_name: 'Test Set',
          budget_loc_fees: 5000,
          budget_security: 2000
        });
      set = setRes.body;

      await request(app)
        .post('/api/costs')
        .send({ set_id: set.id, category: 'Loc Fees', amount: 1500 });
    });

    test('GET /api/reports/dashboard/:id returns summary', async () => {
      const response = await request(app).get(`/api/reports/dashboard/${project.id}`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.total_budget).toBeDefined();
      expect(response.body.summary.total_actual).toBeDefined();
    });
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('GET /api/projects/:id returns 404 for non-existent project', async () => {
    const response = await request(app).get('/api/projects/non-existent-id');
    expect(response.status).toBe(404);
  });

  test('GET /api/sets/:id returns 404 for non-existent set', async () => {
    const response = await request(app).get('/api/sets/non-existent-id');
    expect(response.status).toBe(404);
  });
});
