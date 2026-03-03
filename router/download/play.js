const axios = require("axios")
const crypto = require("crypto")
const ytSearch = require("yt-search")

const KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex")
const VALID_FORMAT = ["144", "240", "360", "480", "720", "1080", "mp3"]

const REGEX =
  /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/

module.exports = async function youtubeHandler(req, res) {
  const input = req.query?.url || req.body?.url
  const format = req.query?.format || req.body?.format || "mp3"

  if (!input) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan."
    })
  }

  if (!VALID_FORMAT.includes(format)) {
    return res.status(400).json({
      status: false,
      message: "Format tidak tersedia."
    })
  }

  try {
    let url = input

    // Kalau bukan link → search dulu
    if (!input.includes("youtube.com") && !input.includes("youtu.be")) {
      const search = await ytSearch(input)

      if (!search.videos.length) {
        return res.status(404).json({
          status: false,
          message: "Video tidak ditemukan."
        })
      }

      url = search.videos[0].url
    }

    const id = url.match(REGEX)?.[3]
    if (!id) {
      return res.status(400).json({
        status: false,
        message: "URL YouTube tidak valid."
      })
    }

    const instance = axios.create({
      timeout: 20000,
      headers: {
        "content-type": "application/json",
        origin: "https://yt.savetube.me",
        "user-agent":
          "Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"
      }
    })

    // Ambil CDN
    const cdnRes = await instance.get(
      "https://media.savetube.vip/api/random-cdn"
    )

    if (!cdnRes.data?.cdn) {
      throw new Error("Gagal ambil CDN.")
    }

    const cdn = cdnRes.data.cdn

    // Ambil info video
    const infoRes = await instance.post(`https://${cdn}/v2/info`, {
      url: `https://www.youtube.com/watch?v=${id}`
    })

    if (!infoRes.data?.data) {
      throw new Error("Gagal ambil info video.")
    }

    const encrypted = infoRes.data.data
    const buffer = Buffer.from(encrypted, "base64")

    const iv = buffer.subarray(0, 16)
    const data = buffer.subarray(16)

    const decipher = crypto.createDecipheriv("aes-128-cbc", KEY, iv)
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ])

    const videoData = JSON.parse(decrypted.toString())

    if (!videoData.key) {
      throw new Error("Key video tidak ditemukan.")
    }

    // Request download link
    const downloadRes = await instance.post(`https://${cdn}/download`, {
      id,
      downloadType: format === "mp3" ? "audio" : "video",
      quality: format === "mp3" ? "128" : format,
      key: videoData.key
    })

    if (!downloadRes.data?.data?.downloadUrl) {
      throw new Error("Gagal ambil download link.")
    }

    return res.json({
      status: true,
      result: {
        id,
        title: videoData.title,
        duration: videoData.duration,
        thumbnail:
          videoData.thumbnail ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        download_url: downloadRes.data.data.downloadUrl,
        format
      }
    })

  } catch (error) {
    console.log("YT ERROR:", error.response?.data || error.message)

    return res.status(500).json({
      status: false,
      message: error.response?.data || error.message
    })
  }
                                        }
