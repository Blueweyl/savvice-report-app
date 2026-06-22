const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const departmentRoutes = require('./routes/departments');
const exportRoutes = require('./routes/export');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/schedule', scheduleRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Savvice Routine Maintenance Department API' });
});

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const initDb = require('./db/init');

async function startServer() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await initDb();
      console.log('Database initialized on attempt', attempt);
      break;
    } catch (err) {
      console.error(`DB init attempt ${attempt} failed:`, err.message);
      if (attempt === 5) {
        console.error('All DB init attempts failed, exiting');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
