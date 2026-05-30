const express = require('express');
const app = express();
const path = require('path');
const os = require('os');
const { generateQrisDynamic, isStaticQrisConfigured } = require('./src/qris');
const { loadRouter, initAutoLoad } = require('./src/autoload');
const { addAdmin, checkAdmin, delAdmin } = require('./admin/list/admin');
const { generateApiKey, deleteApiKey } = require('./admin/generate-apikey');
const { getApiKeys, validateApiKey, incrementUsage, getVisitorData, updateVisitorData } = require('./src/supabaseHelper');
const fs = require('fs');
const cors = require('cors');

const PORT = 3000;

const configNya = [
    path.join(__dirname, 'src', 'config.json'),
    path.join(__dirname, '..', 'src', 'config.json'),
    path.join(process.cwd(), 'src', 'config.json'),
    path.join('/var/task/src/config.json')
];

let localVisitorCache = { count: 0, todayCount: 0, date: new Date().toISOString().split('T')[0] };

const initVisitorData = async () => {
    try {
        const visitorData = await getVisitorData();
        const today = new Date().toISOString().split('T')[0];
        if (visitorData) {
            localVisitorCache = {
                count: visitorData.total_count || 0,
                todayCount: visitorData.today_count || 0,
                date: today
            };
        }
    } catch (e) {
        console.error("[!] Gagal load visitor:", e);
    }
};
initVisitorData();

const visitData = () => localVisitorCache;
const visit = () => localVisitorCache.count;

const incrementVisitor = () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        if (localVisitorCache.date !== today) {
            localVisitorCache.todayCount = 0;
            localVisitorCache.date = today;
        }
        localVisitorCache.count += 1;
        localVisitorCache.todayCount += 1;
        updateVisitorData(localVisitorCache.count, localVisitorCache.todayCount)
            .catch(e => console.error("[!] Gagal update visitor:", e));
    } catch (error) {
        console.error('[✗] Error incrementing visitor:', error);
    }
};

let configPath = '';
for (const p of configNya) {
    if (fs.existsSync(p)) { configPath = p; break; }
}
if (!configPath) { console.error('[✗] Config not found'); process.exit(1); }
let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const checkApiKey = async (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path === '/api/create-payment') return next();

    const userKey = req.query.apikey || (req.body && (req.body.apikey || req.body.apiKey));

    if (!userKey) {
        return res.status(403).json({
            status: false,
            creator: config.settings.creator,
            message: "Apikey dibutuhkan! (?apikey=your_key)"
        });
    }

    try {
        const keyData = await validateApiKey(userKey);

        if (!keyData) {
            return res.status(403).json({
                status: false,
                creator: config.settings.creator,
                message: "Apikey tidak terdaftar atau telah dihapus!"
            });
        }

        const isUnlimited = keyData.rate_limit === -1;

        if (!isUnlimited) {
            const remaining = keyData.rate_limit - (keyData.usage_count || 0);
            if (remaining <= 0) {
                return res.status(429).json({
                    status: false,
                    creator: config.settings.creator,
                    message: "Limit Apikey anda telah habis!"
                });
            }
            incrementUsage(userKey).catch(e => console.error('[!] Gagal increment:', e));
        }

        incrementVisitor();
        next();
    } catch (error) {
        console.error("API Key Error:", error);
        res.status(500).json({ status: false, message: "Gagal memproses Apikey" });
    }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/src', express.static(path.join(process.cwd(), 'src')));
app.use('/src', express.static(path.join(__dirname, 'src')));

app.post('/admin/list/admin', (req, res) => {
    const { username, password } = req.body;
    res.json(checkAdmin(username, password) ? { status: true, token: 'Sign in' } : { status: false });
});

app.post('/admin/generate-apikey', generateApiKey);
app.delete('/admin/delete-apikey', deleteApiKey);

app.get('/admin/list-apikey', async (req, res) => {
    const { username, password } = req.query;
    if (!checkAdmin(username, password)) return res.status(401).send("Unauthorized");
    try {
        const result = await getApiKeys();
        res.json(result.keys);
    } catch (e) { res.json([]); }
});

app.get('/admin/server-status', async (req, res) => {
    const formatTime = (seconds) => {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    };

    let totalApikey = 0;
    try {
        const result = await getApiKeys();
        totalApikey = result.keys ? result.keys.length : 0;
    } catch (e) {}

    let totalRoutes = 0;
    if (config?.tags) {
        Object.values(config.tags).forEach(arr => {
            if (Array.isArray(arr)) totalRoutes += arr.length;
        });
    }

    const vData = visitData();
    res.json({
        processUptime: formatTime(process.uptime()),
        systemUptime: formatTime(os.uptime()),
        totalHit: vData.count || 0,
        todayHit: vData.todayCount || 0,
        totalUser: totalApikey,
        totalApiKey: totalApikey,
        routerActive: `${totalRoutes}/${totalRoutes}`
    });
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

app.get('/admin', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'admin.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html')));

app.post('/api/create-payment', async (req, res) => {
    const { amount } = req.body;
    if (!isStaticQrisConfigured()) {
        return res.status(503).json({ status: 'error', message: 'QRIS unavailable', creator: config.settings.creator });
    }
    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) < 1000) {
        return res.status(400).json({ status: 'error', message: 'Minimum Rp 1.000' });
    }
    try {
        const nominal = parseInt(amount);
        const qrString = generateQrisDynamic(nominal);
        if (!qrString) return res.status(500).json({ status: 'error', message: 'Failed to generate QRIS' });
        await new Promise(r => setTimeout(r, 500));
        res.json({
            creator: config.settings.creator,
            status: 'success',
            order_id: `Q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: nominal,
            qr_string: qrString,
            expired_at: Date.now() + 300000
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

app.get('/api/key-info', async (req, res) => {
    const userKey = req.query.apikey || req.headers['x-api-key'];
    if (!userKey) return res.status(400).json({ status: false, message: "Masukkan apikey di ?apikey=your_key" });

    try {
        const keyData = await validateApiKey(userKey);
        if (!keyData) return res.status(404).json({ status: false, message: "Apikey tidak ditemukan!" });

        const isUnlimited = keyData.rate_limit === -1;
        res.json({
            status: true,
            creator: config.settings.creator,
            info: {
                role: keyData.service_name,
                limit: isUnlimited ? '∞' : keyData.rate_limit,
                used: keyData.usage_count || 0,
                remaining: isUnlimited ? '∞' : (keyData.rate_limit - (keyData.usage_count || 0)),
                unlimited: isUnlimited
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, message: "Gagal mengambil data key." });
    }
});

app.use(checkApiKey);
loadRouter(app, config);

app.get('/config', (req, res) => {
    try {
        const currentConfig = JSON.parse(JSON.stringify(config));
        currentConfig.settings.visitors = visit().toString();
        currentConfig.qris_configured = isStaticQrisConfigured();
        for (const category in currentConfig.tags) {
            currentConfig.tags[category].forEach(api => {
                const hasApiKey = api.params?.some(p => p.name.toLowerCase() === 'apikey');
                if (!hasApiKey && api.endpoint.startsWith('/api/')) {
                    if (!api.params) api.params = [];
                    api.params.push({ name: "apikey", required: true, description: "Registered API Key" });
                }
            });
        }
        res.json({ creator: config.settings.creator, ...currentConfig });
    } catch (error) {
        res.status(500).json({ creator: config.settings.creator, error: 'Internal Server Error' });
    }
});

app.get('/docs', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'docs.html')));
app.get('/donasi', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'donasi.html')));

app.use((req, res) => {
    if (req.accepts('html')) {
        const p404 = [
            path.join(process.cwd(), 'public', '404.html'),
            path.join(__dirname, 'public', '404.html')
        ];
        for (const p of p404) {
            if (fs.existsSync(p)) return res.status(404).sendFile(p);
        }
    }
    res.status(404).json({ status: false, creator: config.settings.creator, message: 'Route not found' });
});

initAutoLoad(app, config, configPath);

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Server jalan (Supabase Mode)!');
    console.log('----------------------------------');
    console.log('Server: http://localhost:3000/docs');
    console.log('----------------------------------');
});
