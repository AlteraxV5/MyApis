const crypto = require('crypto');
const { checkAdmin } = require('./list/admin');
const { createApiKey, getApiKeyByHash, updateApiKey, deleteApiKey } = require('../src/supabaseHelper');

const generateApiKey = async (req, res) => {
    try {
        const { username, password, role, limit, key_name } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        const isUnlimited = role === 'unlimited';
        const prefix = isUnlimited ? 'Admin-' : 'Premium-';
        const token = crypto.randomBytes(8).toString('hex').toUpperCase();
        const newKey = prefix + token;

        await createApiKey(
            1,
            key_name || `${prefix}Key-${Date.now()}`,
            role || 'premium',
            newKey
        );

        res.json({
            status: true,
            message: 'Key berhasil dibuat!',
            apikey: newKey,
            role: isUnlimited ? 'unlimited' : 'premium',
            limit: isUnlimited ? '∞' : (parseInt(limit) || 100)
        });
    } catch (err) {
        console.error('[generate-apikey] Error:', err.message);
        res.status(500).json({ status: false, message: 'Gagal generate key ke Supabase.' });
    }
};

const editApiKey = async (req, res) => {
    try {
        const { username, password, oldKey, newKey, newLimit } = req.body;

        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: 'Akses Ditolak!' });
        }

        const oldKeyData = await getApiKeyByHash(oldKey);
        if (!oldKeyData) {
            return res.status(404).json({ status: false, message: 'Key tidak ditemukan.' });
        }

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (newKey) {
            updates.key_name = newKey;
        }

        if (newLimit) {
            updates.rate_limit = parseInt(newLimit);
        }

        await updateApiKey(oldKeyData.id, updates);

        res.json({ status: true, message: 'Key berhasil diupdate!' });
    } catch (err) {
        console.error('[edit-apikey] Error:', err.message);
        res.status(500).json({ status: false, message: 'Gagal update key di Supabase.' });
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
        res.status(500).json({ status: false, message: 'Gagal hapus key dari Supabase.' });
    }
};

module.exports = { generateApiKey, editApiKey, deleteApiKey: deleteApiKeyHandler };
