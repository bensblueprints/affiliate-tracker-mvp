require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5350;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'reflink.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

const app = createApp({ dbPath: DB_PATH, adminPassword: ADMIN_PASSWORD });

app.listen(PORT, () => {
  console.log(`Reflink listening on http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'admin') {
    console.log('⚠ Using default admin password — set ADMIN_PASSWORD in .env for production.');
  }
});
