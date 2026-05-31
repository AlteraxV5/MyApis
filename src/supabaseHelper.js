const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gqkqclsgksbeaxndrniw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_w61nP0p0Okr0gBFjuHCsUQ_Qi7CsM0Y';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function hashKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getCurrentWindow() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = String(now.getUTCHours()).padStart(2, '0');
    return `${date}-${hour}`;
}

const getApiKeys = async () => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        return {
            keys: data.map(k => ({
                id: k.id,
                apikey: k.key_name,
                role: k.service_name,
                limit: k.rate_limit,
                used: k.usage_count || 0,
                rate_per_hour: k.rate_per_hour,
                remaining: k.rate_limit === -1 ? '∞' : (k.rate_limit - (k.usage_count || 0))
            }))
        };
    } catch (err) {
        console.error('[supabaseHelper] getApiKeys error:', err.message);
        return { keys: [] };
    }
};

const validateApiKey = async (apiKey) => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('key_hash', hashKey(apiKey))
            .eq('is_active', true)
            .single();

        if (error || !data) return null;
        return data;
    } catch (err) {
        console.error('[supabaseHelper] validateApiKey error:', err.message);
        return null;
    }
};

const checkRateLimit = async (apiKey, keyData) => {
    try {
        if (keyData.rate_per_hour === -1) {
            return { allowed: true, used: 0, limit: -1, remaining: '∞' };
        }

        const keyHash = hashKey(apiKey);
        const window = getCurrentWindow();
        const limit = keyData.rate_per_hour || 350;

        const { data: existing } = await supabase
            .from('rate_limits')
            .select('*')
            .eq('key_hash', keyHash)
            .eq('window_start', window)
            .maybeSingle();

        if (existing) {
            const used = existing.hit_count;
            const remaining = limit - used;

            if (remaining <= 0) {
                return { allowed: false, used, limit, remaining: 0 };
            }

            await supabase
                .from('rate_limits')
                .update({ hit_count: used + 1 })
                .eq('id', existing.id);

            return { allowed: true, used: used + 1, limit, remaining: remaining - 1 };
        } else {
            await supabase
                .from('rate_limits')
                .insert([{ key_hash: keyHash, window_start: window, hit_count: 1 }]);

            return { allowed: true, used: 1, limit, remaining: limit - 1 };
        }
    } catch (err) {
        console.error('[checkRateLimit] error:', err.message);
        return { allowed: true, used: 0, limit: 0, remaining: '?' };
    }
};

// limit parameter sekarang jadi rate_per_hour juga
const createApiKey = async (apiKey, role, limit) => {
    try {
        const isUnlimited = role === 'unlimited';
        const keyLimit = isUnlimited ? -1 : (parseInt(limit) || 100);

        const { data, error } = await supabase
            .from('api_keys')
            .insert([{
                key_name: apiKey,
                key_hash: hashKey(apiKey),
                service_name: role,
                encrypted_key: hashKey(apiKey),
                rate_limit: keyLimit,
                rate_per_hour: keyLimit,
                usage_count: 0,
                is_active: true,
                user_id: 1
            }])
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        console.error('[supabaseHelper] createApiKey error:', err.message);
        throw err;
    }
};

const deleteApiKey = async (apiKey) => {
    try {
        const keyHash = hashKey(apiKey);

        const { error } = await supabase
            .from('api_keys')
            .delete()
            .eq('key_hash', keyHash);

        if (error) throw error;

        await supabase
            .from('rate_limits')
            .delete()
            .eq('key_hash', keyHash);

        return true;
    } catch (err) {
        console.error('[supabaseHelper] deleteApiKey error:', err.message);
        throw err;
    }
};

const getVisitorData = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('visitor_stats')
            .select('*')
            .eq('date', today)
            .single();

        if (error) return null;
        return data;
    } catch (err) {
        return null;
    }
};

const updateVisitorData = async (count, todayCount) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
            .from('visitor_stats')
            .select('id')
            .eq('date', today)
            .single();

        if (existing) {
            await supabase
                .from('visitor_stats')
                .update({ total_count: count, today_count: todayCount, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('visitor_stats')
                .insert([{ date: today, total_count: count, today_count: todayCount }]);
        }
        return true;
    } catch (err) {
        console.error('[supabaseHelper] updateVisitorData error:', err.message);
        return false;
    }
};

module.exports = {
    getApiKeys,
    validateApiKey,
    checkRateLimit,
    createApiKey,
    deleteApiKey,
    getVisitorData,
    updateVisitorData,
    hashKey,
    getCurrentWindow
};
