const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const { wrapper } = require('axios-cookiejar-support');
// @ts-ignore
const { CookieJar } = require('tough-cookie');

class SnapTikClient {
    constructor() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            baseURL: "https://snaptik.app",
            jar: this.jar,
            withCredentials: true,
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
                "Upgrade-Insecure-Requests": "1",
            },
            timeout: 30000,
        }));
    }

    async getToken() {
        const { data } = await this.client.get("/en2", {
            headers: { Referer: "https://snaptik.app/en2" },
        });
        const $ = cheerio.load(data);
        return $('input[name="token"]').val() || "";
    }

    async getScript(url) {
        const token = await this.getToken();
        if (!token) throw new Error("Gagal mengambil token dari SnapTik.");

        const form = new FormData();
        form.append("url", url);
        form.append("lang", "en2");
        form.append("token", token);

        const { data } = await this.client.post("/abc2.php", form, {
            headers: {
                ...form.getHeaders(),
                referer: "https://snaptik.app/en2",
                origin: "https://snaptik.app",
            },
        });

        return data;
    }

    async evalScript(script1) {
        const script2 = await new Promise((resolve) =>
            Function("eval", script1)(resolve)
        );

        return new Promise((resolve, reject) => {
            let html = "";
            const mocks = {
                $: () => ({
                    remove() { },
                    style: { display: "" },
                    get innerHTML() { return html; },
                    set innerHTML(v) { html = v; },
                }),
                app: { showAlert: reject },
                document: { getElementById: () => ({ src: "" }) },
                fetch: (url) => {
                    resolve({ html });
                    return { json: async () => ({}) };
                },
                XMLHttpRequest: function () { return { open() { }, send() { } }; },
                window: { location: { hostname: "snaptik.app" } },
                gtag() { },
                Math,
            };

            try {
                Function(...Object.keys(mocks), script2)(...Object.values(mocks));
            } catch (e) {
                reject(e);
            }
        });
    }

    async parseHtml(html) {
        const $ = cheerio.load(html);
        const title = $(".video-title").text().trim() || "No Title";
        const author = $(".info span").text().trim() || "Unknown";
        const thumbnail = $(".avatar").attr("src") || $("#thumbnail").attr("src") || null;

        const links = $("div.video-links a")
            .map((_, el) => $(el).attr("href"))
            .get()
            .filter(Boolean);

        if (!links.length) throw new Error("Video tidak ditemukan.");

        return {
            title,
            author,
            thumbnail,
            links: [...new Set(links)],
        };
    }

    async process(url) {
        try {
            const script = await this.getScript(url);
            const { html } = await this.evalScript(script);
            return await this.parseHtml(html);
        } catch (e) {
            throw new Error(e.message);
        }
    }
}

module.exports = async function tiktokHandler(req, res) {
    const url = req.query?.url || req.body?.url;

    if (!url) return res.status(400).json({ status: false, message: "URL required" });

    try {
        const client = new SnapTikClient();
        const result = await client.process(url);
        res.json({ status: true, data: result });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};
