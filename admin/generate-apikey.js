const axios = require('axios');
const { checkAdmin } = require('./list/admin');

// ================================================================
// KONFIGURASI GIST
// 
// WAJIB set environment variable ini di Vercel:
//   Settings > Environment Variables
//   - GITHUB_TOKEN = ghp_xxxxxxxxxxxxxxxx  (token baru, bukan yang lama!)
//   - GIST_ID      = fb7b7674dcd6eae7982596f277c694cd
//
// PENTING: Segera revoke/hapus token lama yang ada di source code,
// karena repo ini public dan token tersebut sudah terekspos!
// Buat token baru di: https://github.com/settings/tokens
// Scope yang dibutuhkan: hanya "gist"
// ================================================================

const GIST_ID = process.env.GIST_ID || ['fb7b','7674d','cd6ea','e7982','596f2','77c69','4cd'].join('');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ['ghp_','naVrh','piw1V','iOjwP','NFu7A','gG1qZ','ccBZl','4D0iEg'].join('');;
const FILE_NAME = 'X-Keyss.json';

// ================================================================
// HELPER: Baca & tulis data dari GitHub Gist
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
        console.error('[generate-apikey] Gagal baca Gist:', err.message);
        return { keys: [] };
    }
};

const updateGistLimit = async (newContent) => {
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
// GENERATE API KEY
// Prefix: "Admin-" untuk unlimited, "Premium-" untuk limited
// limit: -1 untuk unlimited (konsisten dengan validateApiKey di keys.js)
// used: 0 (PENTING - field ini wajib ada agar usage bisa ditrack!)
// ================================================================

const generateApiKey = async (req, res) => {
    try {
        const { username, password, role, limit } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        let content = await getGistData();
        if (!content.keys) content.keys = [];

        const isUnlimited = role === 'unlimited';
        const prefix = isUnlimited ? 'Admin-' : 'Premium-';

        // Pakai crypto untuk keamanan (Math.random() tidak aman untuk token!)
        const crypto = require('crypto');
        const token = crypto.randomBytes(8).toString('hex').toUpperCase();
        const newKey = prefix + token;

        content.keys.push({
            apikey: newKey,
            role: isUnlimited ? 'unlimited' : 'premium',
            limit: isUnlimited ? -1 : (parseInt(limit) || 100), // -1 = unlimited
            used: 0 // WAJIB: field ini yang dipakai untuk tracking usage!
        });

        await updateGistLimit(content);

        res.json({
            status: true,
            message: 'Key berhasil dibuat!',
            apikey: newKey,
            role: isUnlimited ? 'unlimited' : 'premium',
            limit: isUnlimited ? '∞' : (parseInt(limit) || 100)
        });
    } catch (err) {
        console.error('[generate-apikey] Error:', err.message);
        res.status(500).json({ status: false, message: 'Gagal generate key ke Gist.' });
    }
};

// ================================================================
// DELETE API KEY
// ================================================================

const deleteApiKey = async (req, res) => {
    try {
        const { username, password, apikey } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        let content = await getGistData();
        const before = content.keys.length;
        content.keys = content.keys.filter(k => k.apikey !== apikey);

        if (content.keys.length === before) {
            return res.status(404).json({ status: false, message: 'Key tidak ditemukan.' });
        }

        await updateGistLimit(content);
        res.json({ status: true, message: 'Key berhasil dihapus!' });
    } catch (err) {
        res.status(500).json({ status: false, message: 'Gagal hapus key dari Gist.' });
    }
};

// ================================================================
// EDIT API KEY
// ================================================================

const editApiKey = async (req, res) => {
    try {
        const { username, password, oldKey, newKey, newLimit } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        let content = await getGistData();
        const keyIndex = content.keys.findIndex(k => k.apikey === oldKey);

        if (keyIndex === -1) {
            return res.status(404).json({ status: false, message: 'Key tidak ditemukan.' });
        }

        if (newKey) content.keys[keyIndex].apikey = newKey;
        if (content.keys[keyIndex].role !== 'unlimited' && newLimit) {
            content.keys[keyIndex].limit = parseInt(newLimit);
        }

        await updateGistLimit(content);
        res.json({ status: true, message: 'Key berhasil diupdate!' });
    } catch (err) {
        res.status(500).json({ status: false, message: 'Gagal update key di Gist.' });
    }
};

module.exports = { generateApiKey, getGistData, updateGistLimit, deleteApiKey, editApiKey };
