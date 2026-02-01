const axios = require('axios');
const qs = require('qs');
const cheerio = require('cheerio');

/**
 * Ambil token dari fdown.net
 */
async function getFdownTokens() {
    const { data } = await axios.get('https://fdown.net', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
            'Accept-Language': 'id-ID',
            'Upgrade-Insecure-Requests': '1',
        }
    });

    const $ = cheerio.load(data);

    return {
        token_v: $('input[name="token_v"]').val() || "",
        token_c: $('input[name="token_c"]').val() || "",
        token_h: $('input[name="token_h"]').val() || ""
    };
}

/**
 * Download video Facebook via fdown.net
 */
async function facebookDl(url) {
    try {
        const tokens = await getFdownTokens();
        const postData = qs.stringify({
            URLz: url,
            token_v: tokens.token_v,
            token_c: tokens.token_c,
            token_h: tokens.token_h
        });

        const { data } = await axios.post('https://fdown.net/download.php', postData, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept-Language': 'id-ID',
                'Referer': 'https://fdown.net/',
            }
        });

        const $ = cheerio.load(data);

        if ($('.alert-danger').length > 0) {
            throw new Error("Video private atau URL tidak valid");
        }

        const title = $('.lib-row.lib-header').text().trim() || "Facebook Video";
        const description = $('.lib-row.lib-desc').text().trim() || "No Description";
        const sdLink = $('#sdlink').attr('href');
        const hdLink = $('#hdlink').attr('href');

        if (!sdLink && !hdLink) {
            throw new Error("Tidak ada link download ditemukan");
        }

        return {
            status: true,
            data: {
                title,
                description,
                sd: sdLink || "",
                hd: hdLink || ""
            }
        };

    } catch (error) {
        const msg = error && error.message ? error.message : "Gagal download video Facebook";
        throw new Error(msg);
    }
}

module.exports = async function FacebookHandler(req, res) {
    const url = req.query.url || req.body.url;

    if (!url) {
        return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." });
    }

    try {
        const result = await facebookDl(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
    }
};
