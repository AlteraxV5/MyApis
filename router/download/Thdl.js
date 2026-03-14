const axios = require('axios')
const cheerio = require('cheerio')

async function threadsdl(url) {
  const get = await axios.get('https://sssthreads.net/')
  const cookies = get.headers['set-cookie'].map(v => v.split(';')[0]).join('; ')
  const $get = cheerio.load(get.data)
  const csrf = $get('meta[name="csrf-token"]').attr('content')

  const res = await axios.post('https://sssthreads.net/fetch-data',{ url },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrf,
        origin: 'https://sssthreads.net',
        referer: 'https://sssthreads.net/',
        Cookie: cookies
      }
    }
  )

  const $ = cheerio.load(res.data.html)

  const author = {
    username: $('.author-name').text().trim() || null,
    avatar: $('.author-avatar').attr('src') || null,
    caption: $('.post-description').text().trim() || null
  }

  const media = []

  $('.media-item').each((_, el) => {
    const thumb = $(el).find('.thumbnail-img').attr('data-src') || null

    const links = $(el).find('.download-link')
    let video = null
    let mp3 = null
    let image = null

    links.each((__, a) => {
      const href = $(a).attr('href')
      const text = $(a).text().toLowerCase()

      if (text.includes('video')) video = href
      else if (text.includes('mp3')) mp3 = href
      else if (text.includes('photo')) image = href
    })

    if (video || image) {
      media.push({
        type: video ? 'video' : 'image',
        thumbnail: thumb,
        download: video || image,
        mp3: mp3
      })
    }
  })

  return {
    author,
    media
  }
}

module.exports = async function handler(req, res) {

  const url = req.query?.url || req.body?.url

  if (!url) {
    return res.status(400).json({
      status: false,
      creator: "AltOffx",
      message: "Parameter 'url' diperlukan."
    })
  }

  try {

    const data = await threadsdl(url)

    res.json({
      status: true,
      creator: "AltOffx",
      result: data
    })

  } catch (error) {

    res.status(500).json({
      status: false,
      creator: "AltOffx",
      message: error.message
    })

  }

}

/* supaya bisa dipakai juga sebagai function */
module.exports.threadsdl = threadsdl
