const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'LocationManager';

// Cost categories matching the actual spreadsheet
const COST_CATEGORIES = [
  'Loc Fees',
  'Security',
  'Fire',
  'Rentals',
  'Permits',
  'Police'
];

// Default episode/tab types
const DEFAULT_GROUPS = [
  { name: 'Backlot', type: 'location_group' },
  { name: 'Amort', type: 'amortization' }
];

// Helper to create DynamoDB keys
function getKeys(collection, id) {
  return {
    PK: `${collection.toUpperCase()}#${id}`,
    SK: collection.toUpperCase()
  };
}

// Helper to create foreign key index
function getForeignKey(collection, foreignId) {
  return {
    PK: `${collection.toUpperCase()}#${foreignId}`,
    SK: collection.toUpperCase()
  };
}

async function findById(collection, id) {
  const keys = getKeys(collection, id);
  const response = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: keys
  }));
  if (response.Item) {
    const { PK, SK, ...item } = response.Item;
    return item;
  }
  return null;
}

async function findAll(collection, filter = {}) {
  // For filtered queries, use the appropriate index
  if (filter.project_id) {
    return queryByForeignKey(collection, 'project_id', filter.project_id);
  }
  if (filter.episode_id) {
    return queryByForeignKey(collection, 'episode_id', filter.episode_id);
  }
  if (filter.set_id) {
    return queryByForeignKey(collection, 'set_id', filter.set_id);
  }

  // Full table scan for unfiltered queries
  const response = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: {
      ':sk': collection.toUpperCase()
    }
  }));

  return (response.Items || []).map(item => {
    const { PK, SK, ...rest } = item;
    return rest;
  });
}

async function queryByForeignKey(collection, foreignKeyName, foreignKeyValue) {
  const response = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk AND #fk = :fkv',
    ExpressionAttributeNames: {
      '#fk': foreignKeyName
    },
    ExpressionAttributeValues: {
      ':sk': collection.toUpperCase(),
      ':fkv': foreignKeyValue
    }
  }));

  return (response.Items || []).map(item => {
    const { PK, SK, ...rest } = item;
    return rest;
  });
}

async function insert(collection, item) {
  const now = new Date().toISOString();
  item.created_at = now;
  item.updated_at = now;

  const keys = getKeys(collection, item.id);

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...keys,
      ...item
    }
  }));

  return item;
}

async function update(collection, id, updates) {
  const existing = await findById(collection, id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  const keys = getKeys(collection, id);

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...keys,
      ...updated
    }
  }));

  return updated;
}

async function remove(collection, id) {
  const keys = getKeys(collection, id);

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: keys
  }));

  return true;
}

async function removeWhere(collection, filter) {
  const items = await findAll(collection, filter);

  for (const item of items) {
    await remove(collection, item.id);
  }

  return items.length;
}

// Stub functions for compatibility
function getDatabase() {
  return { projects: [], episodes: [], sets: [], cost_entries: [], uploaded_files: [] };
}

function initializeDatabase() {
  console.log('DynamoDB database initialized');
}

function saveDatabase() {
  // No-op for DynamoDB
}

module.exports = {
  getDatabase,
  initializeDatabase,
  findById,
  findAll,
  insert,
  update,
  remove,
  removeWhere,
  saveDatabase,
  COST_CATEGORIES,
  DEFAULT_GROUPS
};
