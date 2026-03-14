const axios = require("axios")

module.exports = async function igstalkHandler(req, res) {

  const username = req.query?.username || req.body?.username

  if (!username) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'username' diperlukan"
    })
  }

  try {

    const response = await axios.post(
      "https://api.boostfluence.com/api/instagram-profile-v2",
      { username },
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
          "Content-Type": "application/json",
          origin: "https://www.boostfluence.com",
          referer: "https://www.boostfluence.com/"
        },
        timeout: 30000
      }
    )

    const data = response.data

    if (!data) throw new Error("Gagal mengambil data")

    res.json({
      status: true,
      creator: "AltOffx",
      result: data
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: `Gagal mengambil data: ${err.message}`
    })

  }

}
