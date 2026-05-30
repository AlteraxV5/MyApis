const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gqkqclsgksbeaxndrniw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_w61nP0p0Okr0gBFjuHCsUQ_Qi7CsM0Y';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function hashKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
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
                remaining: k.rate_limit === -1 ? '∞' : (k.rate_limit - (k.usage_count || 0))
            }))
        };
    } catch (err) {
        console.error('[supabaseHelper] Error getApiKeys:', err.message);
        return { keys: [] };
    }
};

const validateApiKey = async (apiKey) => {
    try {
        const keyHash = hashKey(apiKey);

        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('key_hash', keyHash)
            .eq('is_active', true)
            .single();

        if (error || !data) return null;
        return data;
    } catch (err) {
        console.error('[supabaseHelper] Error validateApiKey:', err.message);
        return null;
    }
};

const createApiKey = async (apiKey, role, limit) => {
    try {
        const keyHash = hashKey(apiKey);
        const isUnlimited = role === 'unlimited';

        const { data, error } = await supabase
            .from('api_keys')
            .insert([{
                key_name: apiKey,        
                key_hash: keyHash,       
                service_name: role,    
                encrypted_key: keyHash,     
                rate_limit: isUnlimited ? -1 : (parseInt(limit) || 100),
                usage_count: 0,
                is_active: true,
                user_id: 1
            }])
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        console.error('[supabaseHelper] Error createApiKey:', err.message);
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
        return true;
    } catch (err) {
        console.error('[supabaseHelper] Error deleteApiKey:', err.message);
        throw err;
    }
};

const incrementUsage = async (apiKey) => {
    try {
        const keyHash = hashKey(apiKey);

        const { data } = await supabase
            .from('api_keys')
            .select('usage_count, rate_limit')
            .eq('key_hash', keyHash)
            .single();

        if (!data || data.rate_limit === -1) return;

        await supabase
            .from('api_keys')
            .update({
                usage_count: (data.usage_count || 0) + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('key_hash', keyHash);
    } catch (err) {
        console.error('[supabaseHelper] Error incrementUsage:', err.message);
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
        console.error('[supabaseHelper] Error updateVisitorData:', err.message);
        return false;
    }
};

module.exports = {
    getApiKeys,
    validateApiKey,
    createApiKey,
    deleteApiKey,
    incrementUsage,
    getVisitorData,
    updateVisitorData,
    hashKey
};
