const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gqkqclsgksbeaxndrniw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_w61nP0p0Okr0gBFjuHCsUQ_Qi7CsM0Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function encryptKey(apiKey) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'supabase-default-key-change-this';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptKey(encryptedData) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'supabase-default-key-change-this';
    const [iv, encrypted] = encryptedData.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function hashKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}


const getApiKeys = async () => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('[supabaseHelper] Gagal baca API keys:', error.message);
            return { keys: [] };
        }

        return {
            keys: data.map(k => ({
                apikey: k.key_hash, // Return hash, not encrypted key
                role: k.service_name ? 'premium' : 'admin',
                limit: k.rate_limit,
                used: k.usage_count || 0
            }))
        };
    } catch (err) {
        console.error('[supabaseHelper] Error getting API keys:', err.message);
        return { keys: [] };
    }
};


const getApiKeyByHash = async (keyHash) => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('key_hash', keyHash)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('[supabaseHelper] Key not found:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('[supabaseHelper] Error getting key by hash:', err.message);
        return null;
    }
};

const createApiKey = async (userId, keyName, serviceName, apiKey) => {
    try {
        const encryptedKey = encryptKey(apiKey);
        const keyHash = hashKey(apiKey);

        const { data, error } = await supabase
            .from('api_keys')
            .insert([
                {
                    user_id: userId,
                    key_name: keyName,
                    service_name: serviceName,
                    encrypted_key: encryptedKey,
                    key_hash: keyHash,
                    is_active: true,
                    usage_count: 0
                }
            ])
            .select();

        if (error) {
            console.error('[supabaseHelper] Gagal create key:', error.message);
            throw error;
        }

        return data[0];
    } catch (err) {
        console.error('[supabaseHelper] Error creating API key:', err.message);
        throw err;
    }
};


const updateApiKey = async (keyId, updates) => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', keyId)
            .select();

        if (error) {
            console.error('[supabaseHelper] Gagal update key:', error.message);
            throw error;
        }

        return data[0];
    } catch (err) {
        console.error('[supabaseHelper] Error updating API key:', err.message);
        throw err;
    }
};

const deleteApiKey = async (keyHash) => {
    try {
        const { error } = await supabase
            .from('api_keys')
            .delete()
            .eq('key_hash', keyHash);

        if (error) {
            console.error('[supabaseHelper] Gagal delete key:', error.message);
            throw error;
        }

        return true;
    } catch (err) {
        console.error('[supabaseHelper] Error deleting API key:', err.message);
        throw err;
    }
};

const incrementUsage = async (keyHash) => {
    try {
        const keyData = await getApiKeyByHash(keyHash);
        if (!keyData) return false;

        const { error } = await supabase
            .from('api_keys')
            .update({
                usage_count: (keyData.usage_count || 0) + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('key_hash', keyHash);

        if (error) {
            console.error('[supabaseHelper] Gagal increment usage:', error.message);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[supabaseHelper] Error incrementing usage:', err.message);
        return false;
    }
};

const getVisitorData = async () => {
    try {
        const { data, error } = await supabase
            .from('visitor_stats')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('[supabaseHelper] Gagal baca visitor data:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('[supabaseHelper] Error getting visitor data:', err.message);
        return null;
    }
};

const updateVisitorData = async (count, todayCount) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: existingData } = await supabase
            .from('visitor_stats')
            .select('*')
            .eq('date', today)
            .single();

        if (existingData) {
            const { error } = await supabase
                .from('visitor_stats')
                .update({
                    total_count: count,
                    today_count: todayCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingData.id);

            if (error) {
                console.error('[supabaseHelper] Gagal update visitor:', error.message);
                return false;
            }
        } else {
            const { error } = await supabase
                .from('visitor_stats')
                .insert([{
                    date: today,
                    total_count: count,
                    today_count: todayCount
                }]);

            if (error) {
                console.error('[supabaseHelper] Gagal insert visitor:', error.message);
                return false;
            }
        }

        return true;
    } catch (err) {
        console.error('[supabaseHelper] Error updating visitor data:', err.message);
        return false;
    }
};

module.exports = {
    getApiKeys,
    getApiKeyByHash,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    incrementUsage,
    getVisitorData,
    updateVisitorData,
    encryptKey,
    decryptKey,
    hashKey
};
