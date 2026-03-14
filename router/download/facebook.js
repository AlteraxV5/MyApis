const axios = require("axios")
const cheerio = require("cheerio")
const querystring = require("querystring")

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Origin": "https://fdownloader.net",
  "Referer": "https://fdownloader.net/"
}

module.exports = async function facebookHandler(req, res) {

  const url = req.query?.url || req.body?.url

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan."
    })
  }

  try {

    const body = querystring.stringify({
      q: url,
      lang: "en",
      web: "fdownloader.net",
      v: "v2",
      w: ""
    })

    const response = await axios.post(
      "https://v3.fdownloader.net/api/ajaxSearch",
      body,
      {
        headers,
        timeout: 15000
      }
    )

    if (!response.data || !response.data.data) {
      throw new Error("Response tidak valid")
    }

    const $ = cheerio.load(response.data.data)

    const thumbnail = $(".thumbnail img").attr("src") || null
    const duration = $(".content p").first().text().trim() || null

    const videos = []
    $("a.download-link-fb").each((_, el) => {
      const link = $(el).attr("href")
      const quality = $(el).attr("title")?.replace("Download ", "") || ""

      if (link) {
        videos.push({
          quality,
          url: link
        })
      }
    })

    if (!videos.length) {
      throw new Error("Video tidak ditemukan")
    }

    res.json({
      status: true,
      result: {
        thumbnail,
        duration,
        videos
      }
    })

  } catch (error) {

    res.status(500).json({
      status: false,
      message: error.message
    })

  }

}
