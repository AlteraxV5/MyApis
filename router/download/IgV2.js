const axios = require("axios")
const cheerio = require("cheerio")

const INTERNAL_APIKEY = "BVt4N"
const SITE_URL = "https://reelsvideo.io/"
const SITE_KEY = "0x4AAAAAACVCPoioqL3q_FXF"
const PROMO_HOSTS = ["ssstik.io", "ssstwitter.com", "getmyfb.com", "sssfacebook.com", "snapsave.app"]

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://reelsvideo.io/en-4",
    "Origin": "https://reelsvideo.io"
}

async function scrapeIG(igUrl) {
    const pageRes = await axios.get("https://reelsvideo.io/en-4", { headers })
    const $ = cheerio.load(pageRes.data)
    const tt = $("#tt").val()
    const ts = $("#ts").val()
    const cookies = pageRes.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || ""

    const tokenRes = await axios.get("https://api.theresav.biz.id/bypass/turnstile-min", {
        params: { url: SITE_URL, siteKey: SITE_KEY, apikey: INTERNAL_APIKEY }
    })
    const turnstileToken = tokenRes.data?.token
    if (!turnstileToken) throw new Error("Gagal dapat Turnstile token")

    const formData = new URLSearchParams()
    formData.append("id", igUrl)
    formData.append("locale", "en")
    formData.append("tt", tt)
    formData.append("ts", ts)
    formData.append("cf-turnstile-response", turnstileToken)

    const postRes = await axios.post("https://reelsvideo.io/", formData, {
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookies,
            "HX-Request": "true",
            "HX-Target": "target",
            "HX-Current-URL": "https://reelsvideo.io/en-4"
        }
    })

    const $r = cheerio.load(postRes.data)

    const links = []
    $r("a[href]").each((_, el) => {
        const href = $r(el).attr("href")
        const text = $r(el).text().replace(/\s+/g, " ").trim() || "Download"
        if (!href || !href.startsWith("http")) return
        if (href.includes("reelsvideo.io")) return
        if (PROMO_HOSTS.some(h => href.includes(h))) return
        links.push({ text, url: href })
    })

    const thumbnail = $r("img[src]").filter((_, el) => {
        const src = $r(el).attr("src") || ""
        return src.startsWith("http") && !src.includes("reelsvideo.io")
    }).first().attr("src") || null

    const errorText = $r(".error, [class*='error']").first().text().trim() || null
    if (errorText) throw new Error(errorText)
    if (!links.length) throw new Error("Tidak ada link download ditemukan")

    return { thumbnail, result: links }
}

module.exports = async function (req, res) {
    const url = req.query?.url || req.body?.url
    if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." })

    try {
        const data = await scrapeIG(url)
        return res.json({
            status: true,
            creator: "AltOffx",
            result: data
        })
    } catch (e) {
        return res.status(500).json({ status: false, message: e.message })
    }
}
