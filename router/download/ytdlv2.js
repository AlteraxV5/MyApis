const fetch = require('node-fetch')

module.exports = async function handler(req, res) {

  const url = req.query?.url || req.body?.url

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
    const bestAudio = audios[0] || null

    const getDownload = async (mediaUrl) => {

      const step2 = await fetch('https://app.ytdown.to/proxy.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://app.ytdown.to',
          'Referer': 'https://app.ytdown.to/id2/'
        },
        body: `url=${encodeURIComponent(mediaUrl)}`
      })

      let data = await step2.json()
      let attempts = 0

      while (data.api.status === 'queued' && attempts < 20) {

        await new Promise(r => setTimeout(r, 2000))

        const poll = await fetch('https://app.ytdown.to/proxy.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://app.ytdown.to',
            'Referer': 'https://app.ytdown.to/id2/'
          },
          body: `url=${encodeURIComponent(mediaUrl)}`
        })

        data = await poll.json()
        attempts++

      }

      if (data.api.status !== 'completed') {
        throw new Error('Download timeout')
      }

      return {
        url: data.api.fileUrl,
        filename: data.api.fileName,
        size: data.api.fileSize
      }

    }

    const video = await getDownload(bestVideo.mediaUrl)
    const audio = bestAudio ? await getDownload(bestAudio.mediaUrl) : null

    res.json({
      status: true,
      creator: "AltOffx",
      result: {
        title,
        video,
        audio
      }
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })

  }

}
