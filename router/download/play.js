const axios = require("axios")
const crypto = require("crypto")
const ytSearch = require("yt-search")

const KEY = "C5D58EF67A7584E4A29F6C35BBC4EB12"
const VALID_FORMAT = ["144", "240", "360", "480", "720", "1080", "mp3"]

const REGEX =
  /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/

async function youtubeScraper(input, format = "mp3") {
  if (!input) return { status: false, message: "URL / keyword diperlukan." }

  if (!VALID_FORMAT.includes(format))
    return { status: false, message: "Format tidak tersedia." }

  let url = input

  if (!input.includes("youtube.com") && !input.includes("youtu.be")) {
    const search = await ytSearch(input)
    if (!search.videos.length)
      return { status: false, message: "Video tidak ditemukan." }

    url = search.videos[0].url
  }

  const id = url.match(REGEX)?.[3]
  if (!id)
    return { status: false, message: "URL YouTube tidak valid." }

  try {
    const instance = axios.create({
      headers: {
        "content-type": "application/json",
        origin: "https://yt.savetube.me",
        "user-agent":
          "Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"
      }
    })

    const cdnRes = await instance.get(
      "https://media.savetube.vip/api/random-cdn"
    )

    if (!cdnRes.data?.cdn)
      return { status: false, message: "Gagal ambil CDN." }

    const cdn = cdnRes.data.cdn

    const infoRes = await instance.post(
      `https://${cdn}/v2/info`,
      { url: `https://www.youtube.com/watch?v=${id}` }
    )

    const encrypted = infoRes.data.data
    const buffer = Buffer.from(encrypted, "base64")
    const keyBuffer = Buffer.from(KEY, "hex")

    const iv = buffer.slice(0, 16)
    const data = buffer.slice(16)

    const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuffer, iv)
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ])

    const videoData = JSON.parse(decrypted.toString())

    const downloadRes = await instance.post(
      `https://${cdn}/download`,
      {
        id,
        downloadType: format === "mp3" ? "audio" : "video",
        quality: format === "mp3" ? "128" : format,
        key: videoData.key
      }
    )

    return {
      status: true,
      title: videoData.title,
      duration: videoData.duration,
      thumbnail:
        videoData.thumbnail ||
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      download_url: downloadRes.data.data.downloadUrl,
      format
    }

  } catch (error) {
    return {
      status: false,
      message: error.message
    }
  }
}

module.exports = youtubeScraper
