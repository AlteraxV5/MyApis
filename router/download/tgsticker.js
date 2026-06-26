const axios = require("axios");

const TOKEN = "8685426110:AAElxp42MGdsSrGTcpo7xnUAHa_YIdl_OVg" //Bot Token

class TelegramStickerPlugin {
  constructor(token) {
    if (!token) throw new Error("Bot token is required");
    this.token = token;
    this.base = `https://api.telegram.org/bot${token}`;
  }

  extractPackName(url) {
    const match = url.match(/addstickers\/(.+)$/);
    if (!match) throw new Error("Invalid sticker pack URL");
    return match[1];
  }

  async getStickerSet(packName) {
    const { data } = await axios.get(`${this.base}/getStickerSet`, {
      params: { name: packName },
    });
    if (!data.ok) throw new Error("Failed to fetch sticker set");
    return data.result;
  }

  async getFileUrl(fileId) {
    const { data } = await axios.get(`${this.base}/getFile`, {
      params: { file_id: fileId },
    });
    if (!data.ok) throw new Error("Failed to fetch file");
    return `https://api.telegram.org/file/bot${this.token}/${data.result.file_path}`;
  }

  async fetchStickerPack(url) {
    const packName = this.extractPackName(url);
    const stickerSet = await this.getStickerSet(packName);

    const results = await Promise.all(
      stickerSet.stickers.map(async (sticker) => {
        const fileUrl = await this.getFileUrl(sticker.file_id);
        return {
          emoji: sticker.emoji,
          type: sticker.is_animated ? "animated" : "static",
          url: fileUrl,
        };
      })
    );

    return {
      title: stickerSet.title,
      name: stickerSet.name,
      total: results.length,
      stickers: results,
    };
  }
}

module.exports = async function (req, res) {
  const url = req.query?.url || req.body?.url

  if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." })

  try {
    const plugin = new TelegramStickerPlugin(TOKEN)
    const result = await plugin.fetchStickerPack(url)

    return res.json({
      status: true,
      creator: "AltOffx",
      result
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
