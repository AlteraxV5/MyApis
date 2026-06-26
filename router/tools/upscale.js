const { basename, extname } = require("path")

const BASE = "https://sparkpix.ai"
const REFERER = "https://sparkpix.ai/aitools/free-hd-upscaler"
const API_UPLOAD_URL = `${BASE}/api/upload-url`
const API_UPSCALE = `${BASE}/api/free-hd-upscale`
const API_DOWNLOAD = `${BASE}/api/download-image`
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36"

function mimeFromPath(file = "") {
  const ext = extname(file).toLowerCase()
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

function parseQuality(input = "4k") {
  const raw = String(input).toLowerCase().replace(/\s+/g, "")
  if (["8k", "4", "4x"].includes(raw)) return { quality: "8K", scale: 4 }
  if (["6k", "3", "3x"].includes(raw)) return { quality: "6K", scale: 3 }
  return { quality: "4K", scale: 2 }
}

function parseBool(value) {
  const raw = String(value ?? "false").toLowerCase()
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on"
}

async function readJsonSafe(res) {
  const text = await res.text()
  try { return { json: JSON.parse(text), text } } catch { return { json: null, text } }
}

async function inputToBuffer(input, options = {}) {
  if (/^https?:\/\//i.test(input)) {
    const res = await fetch(input, {
      headers: { accept: "image/*,*/*;q=0.8", "user-agent": UA }
    })
    if (!res.ok) throw new Error(`Gagal fetch image URL: ${res.status}`)
    const arr = await res.arrayBuffer()
    const mime = res.headers.get("content-type") || "image/jpeg"
    return { buffer: Buffer.from(arr), filename: options.fileName || "image.jpg", mime, size: arr.byteLength, source: input }
  }
  throw new Error("Hanya support URL gambar.")
}

async function getUploadUrl(file) {
  const payload = { contentType: file.mime, size: file.size, fileName: file.filename }
  const res = await fetch(API_UPLOAD_URL, {
    method: "POST",
    headers: { accept: "*/*", "content-type": "application/json", origin: BASE, referer: REFERER, "user-agent": UA },
    body: JSON.stringify(payload)
  })
  const { json, text } = await readJsonSafe(res)
  if (!res.ok || !json?.success || !json?.uploadUrl || !json?.publicUrl)
    throw new Error(`upload-url gagal: ${JSON.stringify(json || text.slice(0, 300))}`)
  return json
}

async function uploadToR2(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.mime, "content-length": String(file.size) },
    body: file.buffer
  })
  if (!res.ok) throw new Error(`PUT upload gagal: ${res.status}`)
  return true
}

async function upscaleImage(imageUrl, options = {}) {
  const { quality, scale } = parseQuality(options.quality || "4k")
  const faceEnhance = parseBool(options.faceEnhance)
  const payload = { imageUrl, scale, face_enhance: faceEnhance }
  const started = Date.now()
  const res = await fetch(API_UPSCALE, {
    method: "POST",
    headers: { accept: "*/*", "content-type": "application/json", origin: BASE, referer: REFERER, "user-agent": UA },
    body: JSON.stringify(payload)
  })
  const { json, text } = await readJsonSafe(res)
  if (!res.ok || !json?.success || !json?.resultUrl)
    throw new Error(`upscale gagal: ${JSON.stringify(json || text.slice(0, 300))}`)
  return { quality, scale, face_enhance: faceEnhance, resultUrl: json.resultUrl, processingTime: json.processingTime ?? Date.now() - started }
}

module.exports = async function (req, res) {
  const url         = req.query?.url        || req.body?.url
  const quality     = req.query?.quality    || req.body?.quality    || "4k"
  const faceEnhance = req.query?.face       || req.body?.face       || "false"

  if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." })

  try {
    const file = await inputToBuffer(url)
    const upload = await getUploadUrl(file)
    await uploadToR2(upload.uploadUrl, file)
    const result = await upscaleImage(upload.publicUrl, { quality, faceEnhance })

    return res.json({
      status: true,
      creator: "AltOffx",
      result: {
        quality: result.quality,
        scale: result.scale,
        face_enhance: result.face_enhance,
        result_url: result.resultUrl,
        download_url: `${API_DOWNLOAD}?url=${encodeURIComponent(result.resultUrl)}`,
        processing_time: result.processingTime
      }
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
