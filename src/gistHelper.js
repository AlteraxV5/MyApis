const axios = require('axios');

const GIST_ID = process.env.GIST_ID || ['fb7b','7674d','cd6ea','e7982','596f2','77c69','4cd'].join('');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ['ghp_','naVrh','piw1V','iOjwP','NFu7A','gG1qZ','ccBZl','4D0iEg'].join('');
const FILE_NAME = 'X-Keyss.json';

const getGistData = async () => {
    try {
        const res = await axios.get(
            `https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );
        return JSON.parse(res.data.files[FILE_NAME].content);
    } catch (err) {
        console.error('[gistHelper] Gagal baca Gist:', err.message);
        return { keys: [] };
    }
};

const updateGistData = async (newContent) => {
    try {
        await axios.patch(
            `https://api.github.com/gists/${GIST_ID}`,
            {
                files: {
                    [FILE_NAME]: { content: JSON.stringify(newContent, null, 2) }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );
    } catch (err) {
        console.error('[gistHelper] Gagal update Gist:', err.message);
        throw err;
    }
};

module.exports = { getGistData, updateGistData };
