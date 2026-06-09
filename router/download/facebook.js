const axios = require("axios");

const API = "https://api.rifkyshre.biz.id";
const ROUTE = "/scrape/facebook";

const headers = {
  "Content-Type": "application/json",
  Origin: "https://code.rifkyshre.biz.id",
  Referer: "https://code.rifkyshre.biz.id/",
};

module.exports = async function facebookHandler(req, res) {
  const url = req.query?.url || req.body?.url;
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan.",
    });
  }

  try {
    const response = await axios.post(
      `${API}${ROUTE}`,
      { url },
      {
        headers,
        timeout: 30000,
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
        title: d.title,
        description: d.description,
        thumbnail: d.thumbnail,
        hd: d.hd,
        sd: d.sd,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
