const crypto = require("node:crypto")
const axios = require("axios")
const { CookieJar } = require("tough-cookie")
const { wrapper } = require("axios-cookiejar-support")
const FormData = require("form-data")

const SECRET = "9e25796ab4947aac332fb0681f615a5cc1bafec95075e7e978c468c9ddc4c60f"
const ORIGIN = "https://inflact.com"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"

// ✅ in-memory, no fs
let cachedClientId = null
function loadClientId() {
  if (!cachedClientId) cachedClientId = crypto.randomBytes(16).toString("hex")
  return cachedClientId
}

function randHex(nBytes) {
  return crypto.randomBytes(nBytes).toString("hex")
}

function signRequest(clientId) {
  const payload = {
    timestamp: Math.floor(Date.now() / 1000),
    clientId,
    nonce: randHex(16)
  }
  const tokenString = JSON.stringify(payload)
  const signature = crypto
    .createHmac("sha256", Buffer.from(SECRET, "utf8"))
    .update(tokenString, "utf8")
    .digest("hex")
  return {
    "x-client-token": Buffer.from(tokenString, "utf8").toString("base64"),
    "x-client-signature": signature
  }
}

function makeBaggage() {
  const traceId = randHex(16)
  return {
    baggage:
      "sentry-environment=production,sentry-public_key=1b282a50293c4c9738e871bb3fadd05c,sentry-trace_id=" +
      traceId +
      ",sentry-sampled=false,sentry-sample_rand=" +
      Math.random().toFixed(16) +
      ",sentry-sample_rate=0",
    "sentry-trace": traceId + "-" + randHex(8) + "-0"
  }
}

function commonHeaders() {
  return {
    "user-agent": UA,
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": "\"Chromium\";v=\"139\", \"Not;A=Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\""
  }
}

function makeClient() {
  const jar = new CookieJar()
  const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 45000,
    decompress: true,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: commonHeaders()
  }))
  return { client, jar }
}

async function bootstrap(client, jar, username) {
  await client.get(ORIGIN + "/instagram-viewer/", {
    headers: {
      ...commonHeaders(),
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1"
    }
  })
  try {
    await jar.setCookie(
      "user_timezone=6955b611b116d5b29b93adb8418400d1c3e9dc802d687187112f247d7fa83010a%3A2%3A%7Bi%3A0%3Bs%3A13%3A%22user_timezone%22%3Bi%3A1%3Bs%3A12%3A%22Asia%2FJakarta%22%3B%7D; Path=/; Domain=inflact.com",
      ORIGIN + "/"
    )
  } catch (_) {}
}

function buildForm(fields) {
  const form = new FormData()
  for (const k of Object.keys(fields)) {
    form.append(k, fields[k] == null ? "" : String(fields[k]))
  }
  return form
}

async function postApi(client, clientId, urlPath, fields, refererPath) {
  const form = buildForm(fields)
  const sig = signRequest(clientId)
  const baggage = makeBaggage()
  const headers = {
    ...form.getHeaders(),
    ...sig,
    ...baggage,
    "origin": ORIGIN,
    "referer": ORIGIN + (refererPath || "/instagram-viewer/"),
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin"
  }
  const res = await client.post(ORIGIN + urlPath, form, { headers })
  return { status: res.status, data: res.data }
}

function sanitizeUsername(input) {
  if (!input) return ""
  let s = String(input).trim().replace(/^@/, "")
  const m = s.match(/instagram\.com\/([^/?#]+)/i)
  if (m) s = m[1]
  return s.replace(/[^A-Za-z0-9._]/g, "")
}

function pickProfileData(raw) {
  if (!raw || typeof raw !== "object") return null
  const root = raw.data && typeof raw.data === "object" ? raw.data : raw
  const user = root.user || root.profile || root
  if (!user || typeof user !== "object") return null
  return {
    id: user.id || user.pk || user.user_id || null,
    username: user.username || user.user_name || null,
    fullName: user.full_name || user.fullname || user.name || null,
    biography: user.biography || user.bio || null,
    isPrivate: typeof user.is_private === "boolean" ? user.is_private : null,
    isVerified: typeof user.is_verified === "boolean" ? user.is_verified : null,
    profilePic: user.profile_pic_url_hd || user.profile_pic_url || user.profile_pic || null,
    followers: user.edge_followed_by?.count ?? user.follower_count ?? user.followers ?? null,
    following: user.edge_follow?.count ?? user.following_count ?? user.following ?? null,
    posts: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? user.posts ?? null,
    externalUrl: user.external_url || null,
    category: user.category_name || user.category || null,
  }
}

module.exports = async function (req, res) {
  const username = req.query?.username || req.body?.username
  if (!username) return res.status(400).json({ status: false, message: "Parameter 'username' diperlukan." })

  const uname = sanitizeUsername(username)
  if (!uname) return res.status(400).json({ status: false, message: "Username tidak valid." })

  try {
    const { client, jar } = makeClient()
    const clientId = loadClientId()
    await bootstrap(client, jar, uname)

    const profRes = await postApi(client, clientId, "/downloader/api/viewer/profile/?lang=en", { url: uname })
    if (profRes.status >= 400) throw new Error(`Profile request gagal: HTTP ${profRes.status}`)

    const profile = pickProfileData(profRes.data)

    return res.json({
      status: true,
      creator: "AltOffx",
      result: { username: uname, profile }
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
