const mql = require("@microlink/mql");

module.exports = async function screenshotHandler(req, res) {
  const url = req.query?.url || req.body?.url;
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan.",
    });
  }

  const width = parseInt(req.query?.width || req.body?.width) || 1920;
  const height = parseInt(req.query?.height || req.body?.height) || 1080;
  const waitFor = parseInt(req.query?.waitFor || req.body?.waitFor) || 3000;
  const fullPage = (req.query?.fullPage || req.body?.fullPage) === "true";
  const element = req.query?.element || req.body?.element || null;

  try {
    const options = {
      screenshot: {
        optimizeForSpeed: true,
        fullPage,
      },
      viewport: {
        width,
        height,
      },
      waitFor,
      meta: false,
    };

    if (element) {
      options.screenshot.element = element;
    }

    const response = await mql(url, options);
    const data = response.data || {};
    const resultUrl = data.screenshot?.url || null;

    if (!resultUrl) {
      throw new Error(data.error?.message || data.message || "Screenshot failed");
    }

    res.json({
      status: true,
      result: {
        url: resultUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
