const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const querystring = require('querystring');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://reelsvideo.io',
    'Referer': 'https://reelsvideo.io/',
    'X-Requested-With': 'XMLHttpRequest'
};

function generateTS() {
    return Math.floor(Date.now() / 1000);
}

function generateTT(ts) {
    return CryptoJS.MD5(ts + 'X-Fc-Pp-Ty-eZ').toString();
}

module.exports = async function instagramHandler(req, res) {
    const url = req.query?.url || req.body?.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'url' diperlukan."
        });
    }

    try {
        const ts = generateTS();
        const tt = generateTT(ts);

        const body = querystring.stringify({
            id: url,
            locale: 'en',
            tt,
            ts
        });

        const response = await axios.post(
            'https://reelsvideo.io/reel/',
            body,
            {
                headers,
                timeout: 15000
            }
        );

        const $ = cheerio.load(response.data);

        const username = $('.bg-white span.text-400-16-18')
            .first()
            .text()
            .trim() || null;

        const videos = [];
        $('a.type_videos').each((_, el) => {
            const href = $(el).attr('href');
            if (href) videos.push(href);
        });

        const images = [];
        $('a.type_images').each((_, el) => {
            const href = $(el).attr('href');
            if (href) images.push(href);
        });

        if (!videos.length && !images.length) {
            throw new Error('Media tidak ditemukan. Pastikan link valid dan tidak private.');
        }

        res.json({
            status: true,
            result: {
                username,
                videos,
                images
            }
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
};
