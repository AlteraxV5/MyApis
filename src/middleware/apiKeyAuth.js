const keysHandler = require('../router/admin/keys');

// ================================================================
// MIDDLEWARE: Validasi API Key untuk setiap request
// 
// PENTING: Fungsi ini sekarang async karena validateApiKey
// melakukan network call ke GitHub Gist. Ini adalah konsekuensi
// dari menyimpan data di Gist (persistent) bukan file lokal
// (yang akan hilang di Vercel karena filesystem-nya read-only).
// ================================================================

async function apiKeyAuth(req, res, next) {
    if (req.path.includes('/api/keys')) {
        return next();
    }

    const skipAuth = ['/docs', '/landing', '/favicon', '/thumbnail'];
    if (skipAuth.some(p => req.path.startsWith(p))) {
        return next();
    }

    const apiKey = req.headers['x-api-key'] || req.query.apikey || req.body?.apiKey;

    if (!apiKey) {
        return res.status(401).json({
            status: false,
            message: "API Key diperlukan. Gunakan header 'x-api-key' atau query param 'apikey'."
        });
    }

    const validation = await keysHandler.validateApiKey(apiKey);

    if (!validation.valid) {
        return res.status(403).json({
            status: false,
            message: validation.error
        });
    }

    req.apiKeyInfo = validation;

    if (validation.isInfinite) {
        res.set('X-RateLimit-Limit', '∞');
        res.set('X-RateLimit-Remaining', '∞');
    } else {
        res.set('X-RateLimit-Limit', validation.limit);
        res.set('X-RateLimit-Remaining', validation.remaining);
    }

    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            keysHandler.incrementUsage(apiKey).catch(err => {
                console.error('[apiKeyAuth] Gagal increment usage:', err.message);
            });
        }
    });

    next();
}

module.exports = apiKeyAuth;
