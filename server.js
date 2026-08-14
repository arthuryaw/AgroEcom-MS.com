const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const DEFAULT_PASSWORD = 'Ecom@2027';

const activeTokens = new Set();

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createDefaultState() {
  return {
    users: [
      {
        username: 'AgroEcom',
        passwordHash: hashValue('Ecom@2027'),
        role: 'admin'
      },
      {
        username: 'Manager1',
        passwordHash: hashValue('Manager@123'),
        role: 'manager'
      },
      {
        username: 'Staff1',
        passwordHash: hashValue('Staff@456'),
        role: 'staff'
      },
      {
        username: 'PCClerk',
        passwordHash: hashValue('PCClerk@789'),
        role: 'staff'
      }
    ],
    farmers: [],
    records: [],
    settings: {},
    systemMeta: {
      lastReset: null,
      dataStartDate: null
    }
  };
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createDefaultState(), null, 2));
  }
}

function loadState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || createDefaultState().users,
      farmers: parsed.farmers || [],
      records: parsed.records || [],
      settings: parsed.settings || {},
      systemMeta: parsed.systemMeta || { lastReset: null, dataStartDate: null }
    };
  } catch (error) {
    return createDefaultState();
  }
}

let state = loadState();

function saveState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function createId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please login again.' });
  }

  return next();
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/auth/status', authRequired, (req, res) => {
  res.json({ ok: true, message: 'API online' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = state.users.find(
    item => item.username === username && item.passwordHash === hashValue(password)
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  activeTokens.add(token);

  return res.json({
    token,
    user: {
      username: user.username,
      role: user.role
    }
  });
});

app.get('/api/farmers', authRequired, (req, res) => {
  res.json(state.farmers);
});

app.get('/api/farmers/:id', authRequired, (req, res) => {
  const farmer = state.farmers.find(item => item.id === req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Farmer not found' });
  }
  return res.json(farmer);
});

app.post('/api/farmers', authRequired, (req, res) => {
  const farmer = req.body;
  const newFarmer = {
    ...farmer,
    id: farmer.id || createId('FARM'),
    status: farmer.status || 'active'
  };

  state.farmers.push(newFarmer);
  saveState();
  res.status(201).json(newFarmer);
});

app.put('/api/farmers/:id', authRequired, (req, res) => {
  const index = state.farmers.findIndex(item => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Farmer not found' });
  }

  state.farmers[index] = { ...state.farmers[index], ...req.body };
  saveState();
  return res.json(state.farmers[index]);
});

app.delete('/api/farmers/:id', authRequired, (req, res) => {
  const before = state.farmers.length;
  state.farmers = state.farmers.filter(item => item.id !== req.params.id);
  if (state.farmers.length === before) {
    return res.status(404).json({ error: 'Farmer not found' });
  }
  saveState();
  return res.json({ success: true });
});

app.get('/api/records', authRequired, (req, res) => {
  const { id } = req.query;

  if (id) {
    return res.json(state.records.filter(record => record.id === id));
  }

  return res.json(state.records);
});

app.post('/api/records', authRequired, (req, res) => {
  const record = req.body;
  const newRecord = {
    ...record,
    id: record.id || createId('REC')
  };

  state.records.push(newRecord);
  saveState();
  return res.status(201).json(newRecord);
});

app.put('/api/records/:id', authRequired, (req, res) => {
  const index = state.records.findIndex(item => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  state.records[index] = { ...state.records[index], ...req.body };
  saveState();
  return res.json(state.records[index]);
});

app.delete('/api/records/:id', authRequired, (req, res) => {
  const before = state.records.length;
  state.records = state.records.filter(item => item.id !== req.params.id);

  if (state.records.length === before) {
    return res.status(404).json({ error: 'Record not found' });
  }

  saveState();
  return res.json({ success: true });
});

app.post('/api/records/bulk-delete', authRequired, (req, res) => {
  const { ids = [] } = req.body || {};
  const before = state.records.length;
  state.records = state.records.filter(item => !ids.includes(item.id));
  saveState();

  return res.json({
    deleted: before - state.records.length,
    success: true
  });
});

app.get('/api/settings/:key', authRequired, (req, res) => {
  const key = req.params.key;
  if (!state.settings[key]) {
    return res.status(404).json({ error: 'Setting not found' });
  }
  return res.json({ key, value: state.settings[key] });
});

app.post('/api/settings', authRequired, (req, res) => {
  const { key, value } = req.body || {};

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  state.settings[key] = value;
  saveState();
  return res.json({ key, value });
});

app.get('/api/dashboard/stats', authRequired, (req, res) => {
  const activeFarmers = state.farmers.filter(f => f.status === 'active').length;
  const totalKg = state.records
    .filter(r => r.recordType === 'pcRecords')
    .reduce((sum, item) => sum + (Number(item.kg) || 0), 0);

  const totalCashIn = state.records
    .filter(r => r.recordType === 'cashIn')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const totalCashOut = state.records
    .filter(r => r.recordType === 'cashOut')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return res.json({
    farmers: state.farmers.length,
    activeFarmers,
    totalKg,
    totalCashIn,
    totalCashOut,
    balance: totalCashIn - totalCashOut
  });
});

app.get('/api/backup', authRequired, (req, res) => {
  res.json({
    exportedAt: new Date().toISOString(),
    farmers: state.farmers,
    records: state.records,
    settings: state.settings,
    systemMeta: state.systemMeta
  });
});

app.post('/api/restore', authRequired, (req, res) => {
  const data = req.body || {};

  state.farmers = Array.isArray(data.farmers) ? data.farmers : [];
  state.records = Array.isArray(data.records) ? data.records : [];
  state.settings = data.settings || {};
  state.systemMeta = data.systemMeta || { lastReset: null, dataStartDate: null };
  saveState();

  return res.json({ success: true });
});

app.use(express.static(ROOT_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AgroEcom API running on http://localhost:${PORT}`);
  console.log(`Login: username = AgroEcom | password = Ecom@2027`);
});
