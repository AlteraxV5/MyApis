const axios = require('axios');
const { checkAdmin } = require('./list/admin');

const GIST_ID = '06e52f5f3a17e6ea4fe0d147d47552a0'; 
const GITHUB_TOKEN = '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';
const FILE_NAME = 'databaset.json';

const getGistData = async () => {
    try {
        const res = await axios.get(`https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`);
        return JSON.parse(res.data.files[FILE_NAME].content);
    } catch (err) {
        return { keys: [] }; 
    }
};

const updateGistLimit = async (newContent) => {
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
        files: { [FILE_NAME]: { content: JSON.stringify(newContent, null, 2) } }
    }, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
};

const generateApiKey = async (req, res) => {
    try {
        const { username, password, role, limit } = req.body;
        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: "Akses Ditolak!" });
        }

        let content = await getGistData();
        if (!content.keys) content.keys = [];

        const prefix = (role === "unlimited") ? "Admin-" : "Premium-";
        const token = Math.random().toString(36).substring(2, 10).toUpperCase();
        const newKey = prefix + token;

        content.keys.push({
            apikey: newKey,
            role: role === "unlimited" ? "unlimited" : "premium",
            limit: role === "unlimited" ? 0 : (parseInt(limit) || 100)
        });

        await updateGistLimit(content);
        res.json({ status: true, message: "Key Generated!", apikey: newKey });
    } catch (err) {
        res.status(500).json({ status: false, message: "Gagal Generate ke Gist" });
    }
};

const deleteApiKey = async (req, res) => {
    try {
        const { username, password, apikey } = req.body;
        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: "Akses Ditolak!" });
        }

        let content = await getGistData();
        const initialLength = content.keys.length;
        content.keys = content.keys.filter(k => k.apikey !== apikey);

        if (content.keys.length === initialLength) {
            return res.status(404).json({ status: false, message: "Key tidak ditemukan" });
        }

        await updateGistLimit(content);
        res.json({ status: true, message: "Key Deleted!" });
    } catch (err) {
        res.status(500).json({ status: false, message: "Gagal Delete di Gist" });
    }
};

const editApiKey = async (req, res) => {
    try {
        const { username, password, oldKey, newKey, newLimit } = req.body;
        if (!checkAdmin(username, password)) {
            return res.status(401).json({ status: false, message: "Akses Ditolak!" });
        }

        let content = await getGistData();
        const keyIndex = content.keys.findIndex(k => k.apikey === oldKey);

        if (keyIndex === -1) {
            return res.status(404).json({ status: false, message: "Key tidak ditemukan" });
        }

        content.keys[keyIndex].apikey = newKey || content.keys[keyIndex].apikey;
        if (content.keys[keyIndex].role !== "unlimited") {
            content.keys[keyIndex].limit = parseInt(newLimit);
        }

        await updateGistLimit(content);
        res.json({ status: true, message: "Key Updated!" });
    } catch (err) {
        res.status(500).json({ status: false, message: "Gagal Edit di Gist" });
    }
};

module.exports = { generateApiKey, getGistData, updateGistLimit, deleteApiKey, editApiKey };
