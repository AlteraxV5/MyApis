const crypto = require('crypto');
const { checkAdmin } = require('./list/admin');
const { getGistData, updateGistData } = require('../src/gistHelper');

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
        const token = crypto.randomBytes(8).toString('hex').toUpperCase();
        const newKey = prefix + token;

        content.keys.push({
            apikey: newKey,
            role: isUnlimited ? 'unlimited' : 'premium',
            limit: isUnlimited ? -1 : (parseInt(limit) || 100),
            used: 0
        });

        await updateGistData(content);

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

        await updateGistData(content);
        res.json({ status: true, message: 'Key berhasil dihapus!' });
    } catch (err) {
        res.status(500).json({ status: false, message: 'Gagal hapus key dari Gist.' });
    }
};

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

        await updateGistData(content);
        res.json({ status: true, message: 'Key berhasil diupdate!' });
    } catch (err) {
        res.status(500).json({ status: false, message: 'Gagal update key di Gist.' });
    }
};

module.exports = { generateApiKey, deleteApiKey, editApiKey };
