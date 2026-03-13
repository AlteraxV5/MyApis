const axios = require('axios')
const crypto = require('crypto')

const key = "C5D58EF67A7584E4A29F6C35BBC4EB12"

const headers = {
  origin: "https://yt.savetube.me",
  referer: "https://yt.savetube.me/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  accept: "*/*"
}

function decrypt(enc) {
  const buff = Buffer.from(enc, "base64")
  const k = Buffer.from(key, "hex")

  const iv = buff.slice(0, 16)
  const data = buff.slice(16)

  const decipher = crypto.createDecipheriv("aes-128-cbc", k, iv)

  return JSON.parse(
    Buffer.concat([decipher.update(data), decipher.final()]).toString()
  )
}

function ekstrakid(url) {
  const m =
    /youtu\.be\/([a-zA-Z0-9_-]{11})/.exec(url) ||
    /v=([a-zA-Z0-9_-]{11})/.exec(url) ||
    /\/shorts\/([a-zA-Z0-9_-]{11})/.exec(url) ||
    /\/live\/([a-zA-Z0-9_-]{11})/.exec(url)

  if (!m) throw new Error("URL Youtube invalid")

  return m[1]
}

async function getcdn() {
  const res = await axios.get(
    "https://media.savetube.vip/api/random-cdn"
  )
  return res.data.cdn
}

async function info(cdn, id) {
  const res = await axios.post(
    `https://${cdn}/v2/info`,
    { url: `https://www.youtube.com/watch?v=${id}` },
    { headers }
  )

  return decrypt(res.data.data)
}

async function convert(cdn, id, type, key) {

  const isAudio = type === "mp3"

  const res = await axios.post(
    `https://${cdn}/download`,
    {
      id,
      downloadType: isAudio ? "audio" : "video",
      quality: isAudio ? "128" : "720",
      key
    },
    { headers }
  )

  return res.data.data
}

module.exports = async function SaveTubeHandler(req, res) {

  const url = req.query.url || req.body.url
  let type = (req.query.type || req.body.type || "mp3").toLowerCase()

  if (!["mp3","mp4"].includes(type)) {
    return res.status(400).json({
      status: false,
      message: "Type hanya mendukung mp3 atau mp4"
    })
  }

  if (!url)
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan."
    })

  try {

    const id = ekstrakid(url)

    const cdn = await getcdn()

    const infodata = await info(cdn, id)

    const convertdata = await convert(
      cdn,
      id,
      type,
      infodata.key
    )

    return res.json({
      creator: "AltOffx",
      status: true,
      id,
      title: infodata.title,
      type,
      download: convertdata.downloadUrl
    })

  } catch (err) {

    return res.status(500).json({
      status: false,
      message: err.message || err
    })
  }
}
