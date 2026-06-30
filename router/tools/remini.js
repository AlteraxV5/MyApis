const crypto = require('crypto')

const API = 'https://a.android.api.remini.ai/v1/mobile'
const ORACLE = 'https://api.remini.ai/v1/mobile/oracle'

function genId() {
  const a = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return { android_id: a, aaid: crypto.randomUUID(), backup_persistent_id: a + '_com.bigwinepot.nwdn.international', non_backup_persistent_id: crypto.randomUUID() }
}

function bh(dev, extra) {
  return {
    'bsp-id': 'com.bigwinepot.nwdn.international.android',
    'build-number': '202514479', 'build-version': '3.7.1020',
    'country': 'US', 'device-manufacturer': 'Samsung', 'device-model': 'SM-G998B',
    'device-type': '6.8', 'language': 'en', 'locale': 'en_US',
    'os-version': '33', 'platform': 'Android', 'timezone': 'America/New_York',
    'android-id': dev.android_id, 'aaid': dev.aaid,
    'accept-encoding': 'gzip', 'user-agent': 'okhttp/4.12.0',
    ...(extra || {}),
  }
}

function ah(dev, token, extra) {
  const h = bh(dev, extra)
  if (token) h['identity-token'] = token
  return h
}

async function auth(dev) {
  const r = await fetch(ORACLE + '/setup', {
    headers: bh(dev, {
      'first-install-timestamp': Math.floor(Date.now() / 1000) + 'E9',
      'backup-persistent-id': dev.backup_persistent_id,
      'non-backup-persistent-id': dev.non_backup_persistent_id,
      'environment': 'Production', 'settings-response-version': 'v2',
      'is-app-running-in-background': 'false', 'is-old-user': 'true',
      'app-set-id': crypto.randomUUID(),
    })
  })
  const d = await r.json()
  const token = d.settings?.__identity__?.token
  if (!token) throw new Error('Gagal mendapatkan token autentikasi')
  await fetch(API + '/users/@me', { headers: ah(dev, token) })
  return token
}

async function reminiHD(imageUrl) {
  const dev = genId()
  const token = await auth(dev)

  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Gagal download gambar: ${imgRes.status}`)
  const cont = Buffer.from(await imgRes.arrayBuffer())
  const mime = imgRes.headers.get('content-type') || 'image/jpeg'
  const md5 = crypto.createHash('md5').update(cont).digest('base64')

  const taskR = await fetch(API + '/tasks', {
    method: 'POST',
    headers: ah(dev, token, { 'content-type': 'application/json; charset=UTF-8' }),
    body: JSON.stringify({
      image_content_type: mime,
      image_md5: md5,
      feature: { type: 'enhance', models: [] },
      metadata: { size: cont.length },
      options: { high_quality_output: false, save_input: true },
    })
  })
  const taskD = await taskR.json()
  if (!taskD.task_id || !taskD.upload_url || !taskD.upload_headers) throw new Error('Gagal membuat task')

  await fetch(taskD.upload_url, {
    method: 'PUT',
    headers: { ...taskD.upload_headers, 'Content-Length': cont.length, 'User-Agent': 'okhttp/4.12.0' },
    body: cont,
  })

  await fetch(API + '/tasks/' + taskD.task_id + '/process', {
    method: 'POST',
    headers: ah(dev, token, { 'content-length': '0' }),
  })

  let cdnUrl = null
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const pr = await fetch(API + '/tasks/' + taskD.task_id, { headers: ah(dev, token) })
    const pd = await pr.json()
    if (pd.status === 'completed') {
      const outs = pd.result?.outputs
      if (Array.isArray(outs) && outs[0]?.url) cdnUrl = outs[0].url
      break
    }
    if (pd.status === 'failed' || pd.status === 'error') throw new Error('Task gagal diproses')
  }

  if (!cdnUrl) throw new Error('Timeout, tidak ada output URL')
  return cdnUrl
}

module.exports = async function (req, res) {
  const url = req.query?.url || req.body?.url

  if (!url) return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." })

  try {
    const resultUrl = await reminiHD(url)

    return res.json({
      status: true,
      creator: "AltOffx",
      result: { url: resultUrl }
    })
  } catch (e) {
    return res.status(500).json({ status: false, message: e.message })
  }
}
