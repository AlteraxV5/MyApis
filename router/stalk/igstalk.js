const axios = require('axios')
const cheerio = require('cheerio')

class InstagramAnalyzer {
  constructor(username) {
    this.username = username
    this.url = `https://instaanalyzer.com/report/${username}/instagram`
    this.headers = {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: 'https://instaanalyzer.com/',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    }
  }

  async fetchData() {
    const { data } = await axios.get(this.url, { headers: this.headers })
    return this.parseData(data)
  }

  parseData(html) {
    const $ = cheerio.load(html)
    const data = {}
    const profileInfo = $('.d-flex.flex-column.flex-sm-row.flex-wrap.margin-bottom-6')
    data.username = profileInfo.find('.col-sm-8 a.text-dark').text().trim()
    data.fullName = profileInfo.find('.col-sm-8 h1').text().trim()
    data.avatar = profileInfo.find('img.instagram-avatar').attr('src')
    data.description = profileInfo.find('.col-sm-8 small.text-muted').text().trim()
    const stats = $('.col-md-12.col-lg-4 .col')
    data.followers = stats.eq(0).find('.report-header-number').text().trim()
    data.uploads = stats.eq(1).find('.report-header-number').text().trim()
    data.engagement = stats.eq(2).find('.report-header-number').text().trim()
    const nums = $('.report-content-number').map((_, el) => $(el).text().trim()).get()
    data.engagementRate = nums[0] || null
    data.averageLikes = nums[1] || null
    data.averageComments = nums[2] || null
    data.futureProjections = $('table tbody tr').map((_, el) => {
      const cells = $(el).find('td')
      return cells.length ? {
        timeUntil: cells.eq(0).text().trim(),
        date: cells.eq(1).text().trim(),
        followers: cells.eq(2).text().trim(),
        uploads: cells.eq(3).text().trim()
      } : null
    }).get().filter(v => v && v.timeUntil)
    return data
  }
}

module.exports = async function (req, res) {
  const username = req.query?.username || req.body?.username
  if (!username) return res.status(400).json({ status: false, message: "Parameter 'username' diperlukan." })

  try {
    const analyzer = new InstagramAnalyzer(username)
    const result = await analyzer.fetchData()

    if (!result || !result.username) return res.status(500).json({ status: false, message: "Gagal mengambil data atau username tidak ditemukan." })

    return res.json({
      status: true,
      creator: "AltOffx",
      result
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
