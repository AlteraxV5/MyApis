const axios = require('axios');

const gB = Buffer.from('ZXBzaWxvbmNsb3VkLm9yZw==', 'base64').toString();
const headers = {
  origin: 'https://ytmp3.ai',
  referer: 'https://ytmp3.ai/',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  accept: '*/*'
};

let json = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => Math.floor(Date.now() / 1000);

async function getjson() {
  if (json) return json;
  const get = await axios.get('https://ytmp3.ai');
  const html = get.data;
  const m = /var json = JSON\.parse\('([^']+)'\)/.exec(html);
  if (!m) throw new Error('Gagal ambil json ytmp3.ai');
  json = JSON.parse(m[1]);
  return json;
}

function authorization() {
  let e = '';
  for (let i = 0; i < json[0].length; i++) {
    e += String.fromCharCode(json[0][i] - json[2][json[2].length - (i + 1)]);
  }
  if (json[1]) e = e.split('').reverse().join('');
  return e.length > 32 ? e.slice(0, 32) : e;
}

function ekstrakid(url) {
  const m = /youtu\.be\/([a-zA-Z0-9_-]{11})/.exec(url) ||
            /v=([a-zA-Z0-9_-]{11})/.exec(url) ||
            /\/shorts\/([a-zA-Z0-9_-]{11})/.exec(url) ||
            /\/live\/([a-zA-Z0-9_-]{11})/.exec(url);
  if (!m) throw new Error('URL Youtube invalid');
  return m[1];
}

async function init() {
  await getjson();
  const key = String.fromCharCode(json[6]);
  const url = `https://epsilon.${gB}/api/v1/init?${key}=${authorization()}&t=${ts()}`;
  const res = await axios.get(url, { headers });
  if (res.data.error && res.data.error !== 0 && res.data.error !== '0') throw res.data;
  return res.data;
}

async function convert(converturl, id, format) {
  const res = await axios.get(`${converturl}&v=${id}&f=${format}&t=${ts()}`, { headers });
  if (res.data.error && res.data.error !== 0) throw res.data;
  return res.data;
}

async function progress(urlprogress) {
  for (;;) {
    await sleep(3000);
    const res = await axios.get(`${urlprogress}&t=${ts()}`, { headers });
    if (res.data.error && res.data.error !== 0) throw res.data;
    if (res.data.progress === 3) return res.data;
  }
}

// === Handler API ===
module.exports = async function Ytmp3Handler(req, res) {
  const url = req.query.url || req.body.url;
  const format = req.query.format || req.body.format || 'mp3';

  if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." });

  try {
    const id = ekstrakid(url);
    const initdata = await init();
    let convertdata = await convert(initdata.convertURL, id, format);

    if (convertdata.redirect === 1 && convertdata.redirectURL) {
      const redirect = await axios.get(`${convertdata.redirectURL}&t=${ts()}`, { headers });
      convertdata = redirect.data;
    }

    if (convertdata.downloadURL && !convertdata.progressURL) {
      return res.json({ status: true, id, title: convertdata.title, format, download: convertdata.downloadURL });
    }

    const dataprogress = await progress(convertdata.progressURL);

    return res.json({ status: true, id, title: dataprogress.title, format, download: convertdata.downloadURL });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || err });
  }
};