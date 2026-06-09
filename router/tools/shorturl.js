const axios = require("axios");

const headers = {
  Origin: "https://spoo.me",
  Referer: "https://spoo.me/",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
};

module.exports = async function spoomeHandler(req, res) {
  const url = req.query?.url || req.body?.url;
  const alias = req.query?.alias || req.body?.alias || null;

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan.",
    });
  }

  if (!url.startsWith("https://")) {
    return res.status(400).json({
      status: false,
      message: "URL harus diawali dengan 'https://'.",
    });
  }

  try {
    const response = await axios.post(
      "https://spoo.me/api/v1/shorten",
      {
        ...(alias && { alias }),
        long_url: url,
      },
      {
        headers,
        timeout: 15000,
      }
    );

    res.json({
      status: true,
      result: response.data,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
