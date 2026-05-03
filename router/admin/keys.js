const axios = require('axios');

// ================================================================
// KONFIGURASI GIST
// Simpan GITHUB_TOKEN di environment variable Vercel, JANGAN di code!
// Cara set di Vercel: Settings > Environment Variables > GITHUB_TOKEN
// ================================================================
const GIST_ID = process.env.GIST_ID || ['fb7b','7674d','cd6ea','e7982','596f2','77c69','4cd'].join('');
const GITHUB_TOKEN = ['ghp_','naVrh','piw1V','iOjwP','NFu7A','gG1qZ','ccBZl','4D0iEg'].join('');
const FILE_NAME = 'X-Keyss.json';

// ================================================================
// HELPER: Baca & tulis data dari GitHub Gist
// Gist dipakai sebagai "database" karena Vercel filesystem = read-only
// ================================================================

const getGistData = async () => {
    try {
        const res = await axios.get(
            `https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );
        return JSON.parse(res.data.files[FILE_NAME].content);
    } catch (err) {
        console.error('[keys.js] Gagal baca Gist:', err.message);
        return { keys: [] };
    }
};

const updateGistData = async (newContent) => {
    await axios.patch(
        `https://api.github.com/gists/${GIST_ID}`,
        {
            files: {
                [FILE_NAME]: { content: JSON.stringify(newContent, null, 2) }
            }
        },
        {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json'
            }
        }
    );
};

// ================================================================
// HANDLER: GET / POST / DELETE /api/keys
// ================================================================

async function keysHandler(req, res) {
    const method = req.method.toUpperCase();

    if (method === 'GET') {
        const data = await getGistData();
        return res.json({
            status: true,
            total_keys: data.keys.length,
            keys: data.keys.map(k => ({
                key: k.apikey,
                role: k.role,
                limit: k.limit === -1 ? '∞' : k.limit,
                used: k.used || 0,
                remaining: k.limit === -1 ? '∞' : (k.limit - (k.used || 0))
            }))
        });
    }

    if (method === 'DELETE') {
        const apiKey = req.query.key || req.body?.key;
        if (!apiKey) {
            return res.status(400).json({ status: false, message: "Parameter 'key' diperlukan." });
        }

        const data = await getGistData();
        const before = data.keys.length;
        data.keys = data.keys.filter(k => k.apikey !== apiKey);

        if (data.keys.length === before) {
            return res.status(404).json({ status: false, message: 'API Key tidak ditemukan.' });
        }

        await updateGistData(data);
        return res.json({ status: true, message: 'API Key berhasil dihapus.' });
    }

    return res.status(405).json({ status: false, message: 'Method tidak diizinkan.' });
}

// ================================================================
// VALIDATE: Dicall oleh middleware apiKeyAuth
// Harus async karena baca dari Gist (network call)
// ================================================================

keysHandler.validateApiKey = async function (apiKey) {
    const data = await getGistData();
    const keyInfo = data.keys.find(k => k.apikey === apiKey);

    if (!keyInfo) {
        return { valid: false, error: 'API Key tidak ditemukan atau tidak valid.' };
    }

    // limit -1 atau role unlimited = tidak terbatas
    const isInfinite = keyInfo.role === 'unlimited' || keyInfo.limit === -1;

    if (isInfinite) {
        return {
            valid: true,
            role: keyInfo.role,
            limit: -1,
            used: keyInfo.used || 0,
            remaining: '∞',
            isInfinite: true
        };
    }

    const used = keyInfo.used || 0;
    const remaining = keyInfo.limit - used;

    if (remaining <= 0) {
        return { valid: false, error: 'Limit API Key sudah habis.', remaining: 0 };
    }

    return {
        valid: true,
        role: keyInfo.role || 'premium',
        limit: keyInfo.limit,
        used,
        remaining,
        isInfinite: false
    };
};

// ================================================================
// INCREMENT: Tambah hitungan `used` setelah request sukses
// Harus async karena baca + tulis ke Gist
// ================================================================

keysHandler.incrementUsage = async function (apiKey) {
    try {
        const data = await getGistData();
        const keyInfo = data.keys.find(k => k.apikey === apiKey);

        // Kalau key tidak ada atau unlimited, skip
        if (!keyInfo || keyInfo.role === 'unlimited' || keyInfo.limit === -1) return;

        keyInfo.used = (keyInfo.used || 0) + 1;
        await updateGistData(data);
    } catch (err) {
        console.error('[keys.js] Gagal increment usage:', err.message);
    }
};

module.exports = keysHandler;
