const fs = require('fs');
const path = require('path');

const API_KEYS_FILE = path.join(__dirname, '..', '..', 'src', 'apiKeys.json');

function genApiKey(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function readApiKeys() {
    try {
        const data = fs.readFileSync(API_KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { default_limit: 100, keys: {} };
    }
}

function writeApiKeys(data) {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/keys - View all API keys
module.exports = async function keysHandler(req, res) {
    const method = req.method.toUpperCase();
    
    if (method === 'GET') {
        const data = readApiKeys();
        const keysList = Object.entries(data.keys).map(([key, info]) => ({
            key: key,
            name: info.name,
            limit: info.limit,
            used: info.used,
            remaining: info.limit - info.used,
            created: info.created
        }));
        
        return res.json({
            status: true,
            default_limit: data.default_limit,
            total_keys: keysList.length,
            keys: keysList
        });
    }
    
    if (method === 'POST') {
        const { name, limit } = req.body;
        
        if (!name) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'name' diperlukan."
            });
        }
        
        const data = readApiKeys();
        const apiKey = genApiKey();
        const apiLimit = limit || data.default_limit;
        
        data.keys[apiKey] = {
            name: name,
            limit: apiLimit,
            used: 0,
            created: new Date().toISOString()
        };
        
        writeApiKeys(data);
        
        return res.json({
            status: true,
            message: "API Key berhasil dibuat",
            apiKey: apiKey,
            name: name,
            limit: apiLimit
        });
    }
    
    if (method === 'DELETE') {
        const apiKey = req.query.key || req.body.key;
        
        if (!apiKey) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'key' diperlukan."
            });
        }
        
        const data = readApiKeys();
        
        if (!data.keys[apiKey]) {
            return res.status(404).json({
                status: false,
                message: "API Key tidak ditemukan."
            });
        }
        
        const keyInfo = data.keys[apiKey];
        delete data.keys[apiKey];
        writeApiKeys(data);
        
        return res.json({
            status: true,
            message: "API Key berhasil dihapus",
            deleted_key: {
                key: apiKey,
                name: keyInfo.name
            }
        });
    }
    
    res.status(405).json({
        status: false,
        message: "Method tidak diizinkan. Gunakan GET, POST, atau DELETE."
    });
};

// Export helper functions for validation
module.exports.validateApiKey = function(apiKey) {
    const data = readApiKeys();
    const keyInfo = data.keys[apiKey];
    
    if (!keyInfo) {
        return { valid: false, error: 'API Key tidak ditemukan' };
    }
    
    // Check if admin (infinite limit)
    if (keyInfo.role === 'admin' || keyInfo.limit === -1) {
        return {
            valid: true,
            name: keyInfo.name,
            role: keyInfo.role || 'user',
            limit: -1,
            used: keyInfo.used,
            remaining: '∞',
            isInfinite: true
        };
    }
    
    const remaining = keyInfo.limit - keyInfo.used;
    
    if (remaining <= 0) {
        return { valid: false, error: 'Limit API Key habis', remaining: 0 };
    }
    
    return {
        valid: true,
        name: keyInfo.name,
        role: keyInfo.role || 'user',
        limit: keyInfo.limit,
        used: keyInfo.used,
        remaining: remaining
    };
};

module.exports.incrementUsage = function(apiKey) {
    const data = readApiKeys();
    
    if (data.keys[apiKey]) {
        // Skip increment for admin/infinite keys
        if (data.keys[apiKey].role === 'admin' || data.keys[apiKey].limit === -1) {
            return true;
        }
        data.keys[apiKey].used += 1;
        writeApiKeys(data);
        return true;
    }
    
    return false;
};

