const keysHandler = require('../router/admin/keys');

function apiKeyAuth(req, res, next) {
    // Skip auth for admin keys endpoint
    if (req.path.includes('/api/keys')) {
        return next();
    }
    
    // Skip auth for endpoints that don't require API key
    const skipAuth = ['/docs', '/landing', '/favicon', '/thumbnail'];
    if (skipAuth.some(path => req.path.startsWith(path))) {
        return next();
    }
    
    // Get API key from header or query/body
    const apiKey = req.headers['x-api-key'] || req.query.apikey || req.body?.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({
            status: false,
            message: "API Key diperlukan. Gunakan header 'x-api-key' atau parameter 'apikey'."
        });
    }
    
    // Validate API key
    const validation = keysHandler.validateApiKey(apiKey);
    
    if (!validation.valid) {
        return res.status(403).json({
            status: false,
            message: validation.error
        });
    }
    
    // Add key info to request
    req.apiKeyInfo = validation;
    
    // Add rate limit headers for non-admin keys
    if (!validation.isInfinite) {
        res.set('X-RateLimit-Limit', validation.limit);
        res.set('X-RateLimit-Remaining', validation.remaining);
    } else {
        res.set('X-RateLimit-Limit', '∞');
        res.set('X-RateLimit-Remaining', '∞');
    }
    
    // Increment usage after successful response
    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            keysHandler.incrementUsage(apiKey);
        }
    });
    
    next();
}

module.exports = apiKeyAuth;

