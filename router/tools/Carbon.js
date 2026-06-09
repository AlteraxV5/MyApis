const axios = require("axios");

const API = "https://api.rifkyshre.biz.id";
const ROUTE = "/maker/carbon";

const headers = {
  "Content-Type": "application/json",
  "Origin": "https://code.rifkyshre.biz.id",
  "Referer": "https://code.rifkyshre.biz.id/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

module.exports = async function carbonHandler(req, res) {
  const code = req.query?.code || req.body?.code;
  if (!code) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'code' diperlukan.",
    });
  }

  const config = {
    code,
    language: req.query?.language || req.body?.language || "javascript",
    theme: req.query?.theme || req.body?.theme || "dracula-pro",
    font: req.query?.font || req.body?.font || "Fira Code",
    fontSize: req.query?.fontSize || req.body?.fontSize || "14px",
    background: req.query?.background || req.body?.background || "rgba(226,233,239,1)",
    lineNumbers: req.query?.lineNumbers ?? req.body?.lineNumbers ?? true,
    width: parseInt(req.query?.width || req.body?.width) || 1024,
    height: parseInt(req.query?.height || req.body?.height) || 768,
  };

  try {
    const response = await axios.post(
      `${API}${ROUTE}`,
      config,
      {
        headers,
        timeout: 60000,
        validateStatus: () => true,
      }
    );

    const body = response.data;

    if (!body?.status) {
      throw new Error(body?.error ?? "Unknown error");
    }

    const d = body.data;

    res.json({
      status: true,
      result: {
        url: d.url,
        theme: d.theme,
        font: d.font,
        language: d.language,
        width: d.width,
        height: d.height,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
