const fetch = require('node-fetch')

module.exports = async function handler(req, res) {

  const url = req.query?.url || req.body?.url
  const type = (req.query?.type || 'mp4').toLowerCase()

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan"
    })
  }

  try {

    const step1 = await fetch('https://app.ytdown.to/proxy.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://app.ytdown.to',
        'Referer': 'https://app.ytdown.to/id2/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: `url=${encodeURIComponent(url)}`
    })

    const videoInfo = await step1.json()

    if (!videoInfo.api || videoInfo.api.status !== 'ok') {
      throw new Error('Gagal mengambil info video')
    }

    const { title, mediaItems } = videoInfo.api

    const videos = mediaItems.filter(v => v.type === 'Video')
    const audios = mediaItems.filter(v => v.type === 'Audio')

    const bestVideo = videos[0]
    const bestAudio = audios[0]

    const target = type === "mp3" ? bestAudio : bestVideo

    const step2 = await fetch('https://app.ytdown.to/proxy.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://app.ytdown.to',
        'Referer': 'https://app.ytdown.to/id2/'
      },
      body: `url=${encodeURIComponent(target.mediaUrl)}`
    })

    const data = await step2.json()

    res.json({
      status: true,
      creator: "AltOffx",
      result: {
        title,
        type,
        url: data.api.fileUrl,
        filename: data.api.fileName,
        size: data.api.fileSize
      }
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })

  }

}
