const axios = require('axios');
const FormData = require('form-data');

const COOKIE = "cf_clearance=24txQjIRrNFlQkG1Dw3385bpI1T9jhaUE4HgGDOODkc-1766044598-1.2.1.1-es78ywtWLJGPH2MHnSB0obbSe6QFLbQULaNndpJbFjs9z9H2TL2SRP4rxUFSFXh4m4_2K0o0Jz99kzEDfstdlWrsIMm21IfSXWte_oT7vC9EgJXzngKk9I36LeNnGzEk3UIS_qMrQZ1_T5zuXX43EAEAfdQSHB1IxPflwHmMkNe8dtHDauYf4RqQexmTzB_q6PdyuJfSGndlvQVtixfapxOLHwLxBM8qVSjZ2.q1Ybw; _ga=GA1.1.361816903.1766044600;"
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"

const COMMON_HEADERS = {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': COOKIE,
    'Origin': 'https://imgupscaler.com',
    'Referer': 'https://imgupscaler.com/',
    'Sec-Ch-Ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': USER_AGENT
}

async function uploadImageFromUrl(imageUrl) {
    const filename = imageUrl.split('/').pop().split('?')[0] || 'image.jpg'
    const response = await axios.get(imageUrl, { responseType: 'stream' })

    const form = new FormData()
    form.append('tool', 'upscaler')
    form.append('mode', 'batch')
    form.append('scaleRadio', '2')
    form.append('file', response.data, { filename })

    const res = await axios.post('https://imgupscaler.com/api/legacy/upload', form, {
        headers: { ...COMMON_HEADERS, ...form.getHeaders() }
    })

    const taskId = res.data?.data?.code || res.data?.taskId
    if (!taskId) throw new Error("Gagal mendapatkan taskId dari response upload")
    return taskId
}

async function checkStatus(taskId) {
    const payload = { tool: "upscaler", taskId, scaleRadio: "2" }
    const maxAttempts = 15

    for (let i = 0; i < maxAttempts; i++) {
        const res = await axios.post('https://imgupscaler.com/api/legacy/status', payload, {
            headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' }
        })

        const data = res.data
        const status = data?.status || data?.raw?.data?.status
        const urls = data?.downloadUrls || data?.raw?.data?.downloadUrls

        if (status === 'success' && urls?.length > 0) return urls[0]

        await new Promise(r => setTimeout(r, 3000))
    }

    throw new Error("Timeout. Gagal mendapatkan URL download.")
}

module.exports = async function (req, res) {
    const url = req.query?.url || req.body?.url

    if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." })

    try {
        const taskId = await uploadImageFromUrl(url)
        const downloadUrl = await checkStatus(taskId)

        return res.json({
            status: true,
            creator: "AltOffx",
            result: { download_url: downloadUrl }
        })
    } catch (e) {
        return res.status(500).json({ status: false, message: e.message })
    }
}
