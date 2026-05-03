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
    // Endpoint /api/keys tidak perlu auth (untuk admin panel)
    if (req.path.includes('/api/keys')) {
        return next();
    }

    // Path-path publik yang tidak butuh API key
    const skipAuth = ['/docs', '/landing', '/favicon', '/thumbnail'];
    if (skipAuth.some(p => req.path.startsWith(p))) {
        return next();
    }

    // Ambil API key dari header, query param, atau body
    const apiKey = req.headers['x-api-key'] || req.query.apikey || req.body?.apiKey;

    if (!apiKey) {
        return res.status(401).json({
            status: false,
            message: "API Key diperlukan. Gunakan header 'x-api-key' atau query param 'apikey'."
        });
    }

    // Validasi key ke Gist (async - ini penting!)
    const validation = await keysHandler.validateApiKey(apiKey);

    if (!validation.valid) {
        return res.status(403).json({
            status: false,
            message: validation.error
        });
    }

    // Simpan info key di req supaya bisa diakses di handler berikutnya
    req.apiKeyInfo = validation;

    // Set header info limit ke client
    if (validation.isInfinite) {
        res.set('X-RateLimit-Limit', '∞');
        res.set('X-RateLimit-Remaining', '∞');
    } else {
        res.set('X-RateLimit-Limit', validation.limit);
        res.set('X-RateLimit-Remaining', validation.remaining);
    }

    // Tambah hitungan usage HANYA jika response sukses (2xx)
    // res.on('finish') dipanggil setelah response dikirim ke client
    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // Fire-and-forget: tidak perlu await di sini
            // karena response sudah dikirim, tapi Gist tetap diupdate di background
            keysHandler.incrementUsage(apiKey).catch(err => {
                console.error('[apiKeyAuth] Gagal increment usage:', err.message);
            });
        }
    });

    next();
}

module.exports = apiKeyAuth;
