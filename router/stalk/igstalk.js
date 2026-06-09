const crypto = require("crypto")
const { Buffer } = require("buffer")

const SIGNING_KEY_HEX = "792525efde6d921d6055a5d62dcebd39c8b5364e99fa87c5adf0e89391266d9c"
const TS_BASELINE = 1773148641059
const API_BASE = "https://api-wh.fastdl.app/api/v1/instagram"
const CORS_PROXY = "https://cors.siputzx.my.id/"

async function callEndpoint(endpoint, body) {
  const ts = Date.now()
  const key = Buffer.from(SIGNING_KEY_HEX, "hex")
  const _s = crypto.createHmac("sha256", key).update(JSON.stringify(body) + ts).digest("hex")
  const payload = { ...body, ts, _ts: TS_BASELINE, _tsc: 0, _sv: 2, _s }

  const res = await fetch(`${CORS_PROXY}${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "origin": "https://fastdl.app",
      "referer": "https://fastdl.app/",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${endpoint} HTTP ${res.status}: ${errText.slice(0, 100)}`)
  }
  return await res.json()
}

function cleanUsername(raw) {
  if (!raw) return null
  return String(raw)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim()
}

async function stalkInstagram(usernameRaw) {
  const username = cleanUsername(usernameRaw)
  if (!username) throw new Error("Username kosong / invalid")
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    throw new Error("Username format invalid (alphanumeric + . _ only)")
  }

  const [profileRes, userInfoRes, storiesRes] = await Promise.all([
    callEndpoint("profile", { username }).catch(e => ({ error: e.message })),
    callEndpoint("userInfo", { username }).catch(e => ({ error: e.message })),
    callEndpoint("stories", { username }).catch(e => ({ error: e.message }))
  ])

  const u = userInfoRes?.result?.[0]?.user || {}
  const p = profileRes?.result || {}
  const stories = Array.isArray(storiesRes?.result) ? storiesRes.result : []

  return {
    username: u.username || p.username || username,
    fullName: u.full_name || p.full_name || null,
    bio: u.biography || p.biography || null,
    isVerified: Boolean(u.is_verified ?? p.is_verified),
    isPrivate: Boolean(u.is_private ?? p.is_private),
    isBusiness: Boolean(u.is_business),
    category: u.category || p.category || null,
    followers: u.follower_count ?? null,
    following: u.following_count ?? null,
    postsCount: u.media_count ?? null,
    profilePic: u.profile_pic_url || p.profile_pic_url || null,
    profilePicHd: u.hd_profile_pic_url_info?.url || u.profile_pic_url_hd || null,
    externalUrl: u.external_url || p.external_url || null,
    userId: u.id || u.pk || p.id || null,
    activeStoriesCount: stories.length,
    activeStories: stories.slice(0, 10).map(s => ({
      type: s.media_type === 2 ? "video" : "image",
      thumbnail: s.image_versions2?.candidates?.[0]?.url || null,
      videoUrl: s.video_versions?.[0]?.url || null,
      takenAt: s.taken_at
    }))
  }
}

module.exports = async function igstalkHandler(req, res) {
  const username = req.query?.username || req.body?.username
  if (!username) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'username' diperlukan"
    })
  }
  try {
    const result = await stalkInstagram(username)
    res.json({
      status: true,
      creator: "AltOffx",
      result
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: `Gagal mengambil data: ${err.message}`
    })
  }
}
