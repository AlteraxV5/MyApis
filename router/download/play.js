const axios = require('axios')
const crypto = require('crypto')

const DECRYPT_KEY = "C5D58EF67A7584E4A29F6C35BBC4EB12"

const headers = {
  origin: "https://yt.savetube.me",
  referer: "https://yt.savetube.me/",
  "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  accept: "*/*"
}

async function searchYT(q) {
  const res = await axios.get(`https://test.flvto.online/search/?q=${encodeURIComponent(q)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'origin': 'https://v5.ytmp4.is',
      'referer': 'https://v5.ytmp4.is/'
    }
  })

  if (!res.data.items?.length) throw new Error("Tidak ada hasil pencarian")

  return res.data.items.map(v => ({
    id: v.id,
    title: v.title,
    duration: v.duration,
    url: `https://www.youtube.com/watch?v=${v.id}`
  }))
}

function decrypt(enc) {
  const buff = Buffer.from(enc, "base64")
  const k = Buffer.from(DECRYPT_KEY, "hex")
  const iv = buff.slice(0, 16)
  const data = buff.slice(16)
  const decipher = crypto.createDecipheriv("aes-128-cbc", k, iv)
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString())
}

async function getCDN() {
  const res = await axios.get("https://media.savetube.vip/api/random-cdn")
  return res.data.cdn
}

async function getInfo(cdn, videoId) {
  const res = await axios.post(
    `https://${cdn}/v2/info`,
    { url: `https://www.youtube.com/watch?v=${videoId}` },
    { headers }
  )
  return decrypt(res.data.data)
}

async function convertAudio(cdn, videoId, key) {
  const res = await axios.post(
    `https://${cdn}/download`,
    { id: videoId, downloadType: "audio", quality: "128", key },
    { headers }
  )
  return res.data.data
}

async function searchAndDownload(q) {
  const results = await searchYT(q)
  const top = results[0]

  const cdn = await getCDN()
  const infoData = await getInfo(cdn, top.id)
  const convertData = await convertAudio(cdn, top.id, infoData.key)

  return {
    status: true,
    query: q,
    id: top.id,
    title: infoData.title,
    duration: top.duration,
    type: "mp3",
    download: convertData.downloadUrl
  }
}

module.exports = async function handler(req, res) {
  const q = req.query.q || req.body.q

  if (!q)
    return res.status(400).json({ status: false, message: "Parameter 'q' diperlukan." })

  try {
    const result = await searchAndDownload(q)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || err })
  }
}
