const fetch = require("node-fetch");

const rand = n =>
  Array.from({ length: n }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");

const COOKIE = "REDACTED";

async function wrmgpt(prompt) {
  const msgId = `${rand(8)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(12)}`;

  const res = await fetch("https://chat.wrmgpt.com/api/chat", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://chat.wrmgpt.com",
      Referer: "https://chat.wrmgpt.com/",
      Cookie: COOKIE
    },
    body: JSON.stringify({
      id: msgId,
      message: {
        role: "user",
        parts: [{ type: "text", text: prompt }],
        id: msgId
      },
      selectedChatModel: "wormgpt-v5.5",
      selectedVisibilityType: "private",
      searchEnabled: false,
      memoryLength: 8
    })
  });

  if (!res.ok) throw new Error("API_FAIL");

  const raw = await res.text();
  let output = "";

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;

    const data = line.slice(6).trim();
    if (data === "[DONE]") break;

    try {
      const json = JSON.parse(data);
      if (json.type === "text-delta" && json.delta) {
        output += json.delta;
      }
    } catch {}
  }

  if (!output) throw new Error("EMPTY");

  return output;
}

module.exports = async function handler(req, res) {
  const start = Date.now();

  try {
    const data = req.method === "POST" ? req.body : req.query;

    if (!data?.message) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'message' diperlukan."
      });
    }

    const answer = await wrmgpt(data.message);

    return res.json({
      status: true,
      result: {
        message: data.message,
        answer
      },
      responseTime: `${Date.now() - start}ms`
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message || "Service Error"
    });
  }
};
