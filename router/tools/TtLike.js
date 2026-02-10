const axios = require('axios');

async function freetiktoklike(url) {
    try {
        const page = await axios.get('https://leofame.com/free-tiktok-likes');
        const html = page.data;

        const tokenMatch = html.match(/var\s+token\s*=\s*'([^']+)'/);
        if (!tokenMatch) throw new Error('Token tidak ditemukan');

        const token = tokenMatch[1];

        const cookies = page.headers['set-cookie']
            ?.map(v => v.split(';')[0])
            .join('; ') || '';

        const res = await axios.post(
            'https://leofame.com/free-tiktok-likes?api=1',
            new URLSearchParams({
                token,
                timezone_offset: 'Asia/Jakarta',
                free_link: url
            }).toString(),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://leofame.com',
                    'Referer': 'https://leofame.com/free-tiktok-likes',
                    'Cookie': cookies
                }
            }
        );

        return res.data;

    } catch (err) {
        throw new Error(err.message);
    }
}

module.exports = async (req, res) => {
    try {
        const url = req.query?.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'url kosong'
            });
        }

        const result = await freetiktoklike(url);

        res.json({
            status: true,
            result
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            error: err.message
        });
    }
};
