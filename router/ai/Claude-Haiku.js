const crypto = require("crypto")

const API = "https://api.overchat.ai/v1/chat/completions"
const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36"

const pack = obj => Buffer.from(JSON.stringify(obj)).toString("base64")
const unpack = s => { try { return JSON.parse(Buffer.from(s, "base64").toString()) } catch { return null } }

async function ClaudeHaiku(prompt, options = {}) {
  const sess = options.sessionId ? unpack(options.sessionId) : null
  const chatId = sess?.chatId || crypto.randomUUID()
  const deviceId = sess?.deviceId || crypto.randomUUID()
  const customPrompt = options.customPrompt || sess?.customPrompt || ""
  const model = "claude-haiku-4-5-20251001"

  const messages = [
    ...(sess?.history || []).map(item => ({
      id: crypto.randomUUID(),
      role: item.role,
      content: item.content
    })),
    {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt
    },
    {
      id: crypto.randomUUID(),
      role: "system",
      content: customPrompt || "Ikuti bahasa user dan jawab dengan gaya natural, singkat, dan jelas."
    }
  ]

  const body = {
    chatId, model, messages,
    personaId: "claude-haiku-4-5-landing",
    frequency_penalty: 0,
    max_tokens: 4000,
    presence_penalty: 0,
    stream: true,
    temperature: 0.5,
    top_p: 0.95
  }

  const headers = {
    "sec-ch-ua-platform": `"Android"`,
    "x-device-uuid": deviceId,
    "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
    "sec-ch-ua-mobile": "?1",
    "x-device-language": "id-ID",
    "x-device-platform": "web",
    "x-device-version": "1.0.44",
    "user-agent": ua,
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://overchat.ai",
    referer: "https://overchat.ai/",
    "accept-language": "id-ID,id;q=0.9",
    priority: "u=1, i"
  }

  const response = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = "", answer = "", responseId = null, responseModel = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (!data || data === "[DONE]") continue
      try {
        const json = JSON.parse(data)
        if (typeof json.id === "string") responseId = json.id
        if (typeof json.model === "string") responseModel = json.model
        const content = json.choices?.[0]?.delta?.content
        if (typeof content === "string") answer += content
      } catch {}
    }
  }

  // simpan history buat session
  const newHistory = [
    ...(sess?.history || []),
    { role: "user", content: prompt },
    { role: "assistant", content: answer }
  ]

  const sessionId = pack({ chatId, deviceId, customPrompt, history: newHistory })

  return { answer, responseId, model: responseModel || model, sessionId }
}

module.exports = async function (req, res) {
  const q           = req.query?.q           || req.body?.q
  const sessionId   = req.query?.session     || req.body?.session     || null
  const newPrompt   = req.query?.customPrompt || req.body?.customPrompt || ""

  if (!q) return res.status(400).json({ status: false, message: "Parameter 'q' diperlukan." })

  const sess = sessionId ? unpack(sessionId) : null
  const customPrompt = newPrompt || sess?.customPrompt || ""

  try {
    const result = await ClaudeHaiku(q, { sessionId, customPrompt })

    return res.json({
      status: true,
      creator: "AltOffx",
      response: result.answer,
      model: result.model,
      session: result.sessionId
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
