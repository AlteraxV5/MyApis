/* ===============================
   STARTUP WEB
================================= */
const express = require('express');
const app = express();
const path = require('path');
const os = require('os');
const { generateQrisDynamic, isStaticQrisConfigured } = require('./src/qris');
const { loadRouter, initAutoLoad } = require('./src/autoload');
const bodyParser = require('body-parser');
const { addAdmin, checkAdmin, delAdmin } = require('./admin/list/admin');
const fs = require('fs');
const cors = require('cors');

const PORT = 3000;
const REAL = 2460;
const VPS_IP = '48.193.47.89';

const configNya = [
    path.join(__dirname, 'src', 'config.json'),
    path.join(__dirname, '..', 'src', 'config.json'),
    path.join(process.cwd(), 'src', 'config.json'),
    path.join('/var/task/src/config.json')
];

/* ===============================
   AMBIL IP LOKAL OTOMATIS
================================= */
let configPath = '';
for (const p of configNya) {
  if (fs.existsSync(p)) {
    configPath = p;
    break;
  }
}

if (!configPath) {
  console.error('[✗] Config file not found');
  process.exit(1);
}

let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const visitor_db = path.join('/tmp', 'visitors.json');

const visit = () => {
  try {
    if (fs.existsSync(visitor_db)) {
      const data = fs.readFileSync(visitor_db, 'utf-8');
      return JSON.parse(data).count;
    }
    return parseInt(config.settings.visitors || '0');
  } catch (error) {
    console.error('[✗] Error reading visitor count:', error);
    return 0;
  }
};

const incrementVisitor = () => {
  try {
    let count = visit();
    count++;
    fs.writeFileSync(visitor_db, JSON.stringify({ count }));
  } catch (error) {
    console.error('[✗] Error incrementing visitor:', error);
  }
};

/* ===============================
   STATIC FILES (HTML/CSS/JS)
================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/src', express.static(path.join(process.cwd(), 'src')));
app.use('/src', express.static(path.join(__dirname, 'src')))

/* ===============================
   MAIN ADMIN ACCESS
================================= */
app.post('/admin/list/admin', (req, res) => {
    const { username, password } = req.body;
    if (checkAdmin(username, password)) {
        res.json({ status: true, token: 'Sign in' });
    } else {
        res.json({ status: false });
    }
});

app.post('/admin/add', (req, res) => {
    const { username, password } = req.body;
    addAdmin(username, password);
    res.json({ status: true, message: 'Admin added' });
});

app.post('/admin/delete', (req, res) => {
    const { username } = req.body;
    delAdmin(username);
    res.json({ status: true, message: 'Admin deleted' });
});

app.get('/admin/list', (req, res) => {
    res.json(admins);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

app.post('/api/create-payment', async (req, res) => {
  const { amount, name } = req.body;

  if (!isStaticQrisConfigured()) {
    return res.status(503).json({
      status: 'error',
      message: 'QRIS payment is temporarily unavailable',
      creator: config.settings.creator,
      note: 'Please configure STATIC_QRIS in src/qris.js'
    });
  }

  if (!amount || isNaN(parseInt(amount)) || parseInt(amount) < 1000) {
    return res.status(400).json({
      status: 'error',
      message: 'Minimum Rp 1.000'
    });
  }

  try {
    const nominal = parseInt(amount);
    const qrString = generateQrisDynamic(nominal);

    if (!qrString) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to generate QRIS',
        creator: config.settings.creator
      });
    }

    const orderId = `Q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await new Promise(r => setTimeout(r, 500));

    res.json({
      creator: config.settings.creator,
      status: 'success',
      order_id: orderId,
      amount: nominal,
      qr_string: qrString,
      expired_at: Date.now() + 300000
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error'
    });
  }
});

loadRouter(app, config);

app.get('/config', (req, res) => {
  try {
    const currentConfig = JSON.parse(JSON.stringify(config));
    currentConfig.settings.visitors = visit().toString();
    currentConfig.qris_configured = isStaticQrisConfigured();

    res.json({
      creator: config.settings.creator,
      ...currentConfig
    });
  } catch (error) {
    res.status(500).json({
      creator: config.settings.creator,
      error: 'Internal Server Error'
    });
  }
});

/* ===============================
   DATA GLOBAL
================================= */

/* ===============================
   RESTAPI HTML
================================= */
// Endpoint API (GET /api)


// Endpoint API (POST /api)
app.post('/donasi', (req, res) => {
  res.redirect('/donasi')
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'docs.html'));
});

app.get('/donasi', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'donasi.html'));
});

app.use((req, res) => {
  if (req.accepts('html')) {
    const possible404 = [
      path.join(process.cwd(), 'public', '404.html'),
      path.join(__dirname, 'public', '404.html')
    ];
    for (const p of possible404) {
      if (fs.existsSync(p)) {
        return res.status(404).sendFile(p);
      }
    }
  }

  res.status(404).json({
    status: false,
    creator: config.settings.creator,
    message: 'Route not found'
  });
});

// AutoLoad API
initAutoLoad(app, config, configPath);

/* ===============================
   END CONFIGURASI
================================= */

/* ===============================
   SERVER LISTEN
================================= */
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Server berhasil jalan!');
  console.log('----------------------------------');
  console.log('RestApi: https://altoffx-myapi.vercel.app');
  console.log('Documentation: https://altoffx-backend-dev.vercel.app');
  console.log('Server running on http://localhost:3000/docs');
  try {
    console.log(`QRIS Configured: ${isStaticQrisConfigured() ? 'Yes' : 'No'}`);
  } catch(e) {
    console.log('QRIS Configured: Unknown');
  }
  console.log('----------------------------------');
});

