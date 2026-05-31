const crypto = require('crypto');
const { checkAdmin } = require('./list/admin');
const { createApiKey, deleteApiKey } = require('../src/supabaseHelper');

const generateApiKey = async (req, res) => {
    try {
        const { username, password, role, limit } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        const isUnlimited = role === 'unlimited';
        const prefix = isUnlimited ? 'Admin-' : 'Premium-';
        const token = crypto.randomBytes(8).toString('hex').toUpperCase();
        const newKey = prefix + token;
        const keyLimit = isUnlimited ? -1 : (parseInt(limit) || 100);

        await createApiKey(newKey, role || 'premium', keyLimit);

        res.json({
            status: true,
            message: 'Key berhasil dibuat!',
            apikey: newKey,
            role: isUnlimited ? 'unlimited' : 'premium',
            limit: isUnlimited ? '∞' : keyLimit
        });
    } catch (err) {
        console.error('[generate-apikey] Error:', err.message);
        res.status(500).json({ status: false, message: 'Gagal generate key: ' + err.message });
    }
};

const deleteApiKeyHandler = async (req, res) => {
    try {
        const { username, password, apikey } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        await deleteApiKey(apikey);
        res.json({ status: true, message: 'Key berhasil dihapus!' });
    } catch (err) {
        console.error('[delete-apikey] Error:', err.message);
        res.status(500).json({ status: false, message: 'Gagal hapus key: ' + err.message });
    }
};

module.exports = { generateApiKey, deleteApiKey: deleteApiKeyHandler };
