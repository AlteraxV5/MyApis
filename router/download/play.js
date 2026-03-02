const axios = require("axios")
const crypto = require("crypto")
const ytSearch = require("yt-search")

const KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex")
const VALID_FORMAT = ["144", "240", "360", "480", "720", "1080", "mp3"]

const REGEX =
  /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/

async function youtubeScraper(input, format = "mp3") {
  try {
    if (!input) {
      return { success: false, message: "URL / keyword diperlukan." }
    }

    if (!VALID_FORMAT.includes(format)) {
      return { success: false, message: "Format tidak tersedia." }
    }

    let url = input

    // 🔎 Kalau bukan link → search dulu
    if (!input.includes("youtube.com") && !input.includes("youtu.be")) {
      const search = await ytSearch(input)

      if (!search.videos.length) {
        return { success: false, message: "Video tidak ditemukan." }
      }

      url = search.videos[0].url
    }

    const id = url.match(REGEX)?.[3]
    if (!id) {
      return { success: false, message: "URL YouTube tidak valid." }
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

    // 🔹 Ambil CDN
    const cdnRes = await instance.get(
      "https://media.savetube.vip/api/random-cdn"
    )

    if (!cdnRes.data || !cdnRes.data.cdn) {
      return { success: false, message: "Gagal ambil CDN." }
    }

    const cdn = cdnRes.data.cdn

    // 🔹 Ambil info video
    const infoRes = await instance.post(`https://${cdn}/v2/info`, {
      url: `https://www.youtube.com/watch?v=${id}`
    })

    if (!infoRes.data || !infoRes.data.data) {
      return { success: false, message: "Gagal ambil info video." }
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
      return { success: false, message: "Key video tidak ditemukan." }
    }

    // 🔹 Request download link
    const downloadRes = await instance.post(`https://${cdn}/download`, {
      id,
      downloadType: format === "mp3" ? "audio" : "video",
      quality: format === "mp3" ? "128" : format,
      key: videoData.key
    })

    if (!downloadRes.data?.data?.downloadUrl) {
      return { success: false, message: "Gagal ambil download link." }
    }

    return {
      success: true,
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
    }

  } catch (err) {
    return {
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: err.response?.data || err.message
    }
  }
}

module.exports = youtubeScraper
