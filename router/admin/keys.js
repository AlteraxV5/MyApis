const { getApiKeys, getApiKeyByHash, deleteApiKey, incrementUsage } = require('../../src/supabaseHelper');


async function keysHandler(req, res) {
    const method = req.method.toUpperCase();

    if (method === 'GET') {
        try {
            const result = await getApiKeys();
            return res.json({
                status: true,
                total_keys: result.keys.length,
                keys: result.keys.map(k => ({
                    key: k.apikey,
                    role: k.role,
                    limit: k.limit === -1 ? '∞' : k.limit,
                    used: k.used || 0,
                    remaining: k.limit === -1 ? '∞' : (k.limit - (k.used || 0))
                }))
            });
        } catch (err) {
            return res.status(500).json({ status: false, message: 'Gagal mengambil keys' });
        }
    }

    if (method === 'DELETE') {
        const apiKey = req.query.key || req.body?.key;
        if (!apiKey) {
            return res.status(400).json({ status: false, message: "Parameter 'key' diperlukan." });
        }

        try {
            await deleteApiKey(apiKey);
            return res.json({ status: true, message: 'API Key berhasil dihapus.' });
        } catch (err) {
            return res.status(500).json({ status: false, message: 'Gagal menghapus key.' });
        }
    }

    return res.status(405).json({ status: false, message: 'Method tidak diizinkan.' });
}

keysHandler.validateApiKey = async function (apiKey) {
    try {
        const keyData = await getApiKeyByHash(apiKey);

        if (!keyData) {
            return { valid: false, error: 'API Key tidak ditemukan atau tidak valid.' };
        }

        if (!keyData.is_active) {
            return { valid: false, error: 'API Key tidak aktif.' };
        }

        const isInfinite = keyData.rate_limit === -1;

        if (isInfinite) {
            return {
                valid: true,
                role: 'admin',
                limit: -1,
                used: keyData.usage_count || 0,
                remaining: '∞',
                isInfinite: true,
                keyId: keyData.id
            };
        }

        const used = keyData.usage_count || 0;
        const remaining = keyData.rate_limit - used;

        if (remaining <= 0) {
            return { valid: false, error: 'Limit API Key sudah habis.', remaining: 0 };
        }

        return {
            valid: true,
            role: keyData.service_name || 'premium',
            limit: keyData.rate_limit,
            used,
            remaining,
            isInfinite: false,
            keyId: keyData.id,
            keyHash: keyData.key_hash
        };
    } catch (err) {
        console.error('[keys.js] Validation error:', err.message);
        return { valid: false, error: 'Error saat validasi key.' };
    }
};

keysHandler.incrementUsage = async function (keyHash) {
    try {
        const keyData = await getApiKeyByHash(keyHash);
        if (!keyData || keyData.rate_limit === -1) return;

        await incrementUsage(keyHash);
    } catch (err) {
        console.error('[keys.js] Error incrementing usage:', err.message);
    }
};

module.exports = keysHandler;
