const nexray = require('api-nexray');

module.exports = async function ytPlayHandler(req, res) {
    const query = req.query?.q || req.body?.q;

    if (!query) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'q' diperlukan."
        });
    }

    try {
        const response = await nexray.get("/downloader/ytplay", {
            q: query
        });

        if (!response?.result) {
            throw new Error("Video tidak ditemukan.");
        }

        const {
            title,
            description,
            channel,
            channel_url,
            duration,
            seconds,
            views,
            upload_at,
            thumbnail,
            url,
            download_url
        } = response.result;

        if (!download_url) {
            throw new Error("Download URL tidak tersedia.");
        }

        return res.json({
            status: true,
            result: {
                title,
                description,
                channel,
                channel_url,
                duration,
                seconds,
                views,
                upload_at,
                thumbnail,
                url,
                download_url
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};
