const axios = require('axios');

module.exports = async function tiktokSearchHandler(req, res) {
    const query = req.query?.q || req.query?.query;

    if (!query) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'q' diperlukan."
        });
    }

    try {
        const response = await axios({
            method: "POST",
            url: "https://tikwm.com/api/feed/search",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Cookie: "current_language=en",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
            },
            data: {
                keywords: query,
                count: 10,
                cursor: 0,
                HD: 1,
            },
            timeout: 30000,
        });

        const videos = response.data.data.videos;

        if (!videos || videos.length === 0) {
            throw new Error("Tidak ada video ditemukan.");
        }

        const result = videos.map(v => ({
            title: v.title,
            cover: v.cover,
            origin_cover: v.origin_cover,
            link: "https://tikwm.com" + v.play,
            watermark_link: "https://tikwm.com" + v.wmplay,
            music: v.music,
            author: {
                nickname: v.author.nickname,
                avatar: v.author.avatar
            },
            stats: {
                plays: v.play_count,
                likes: v.digg_count,
                comments: v.comment_count,
                shares: v.share_count
            }
        }));

        res.json({
            status: true,
            result: result
        });

    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};
