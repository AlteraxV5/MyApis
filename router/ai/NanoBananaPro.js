const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

function genserial() {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

async function upload(filename, apiKey) {
  const form = new FormData();
  form.append('file_name', filename);

  const res = await axios.post(
    'https://api.imgupscaler.ai/api/common/upload/upload-image',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'x-api-key': apiKey, 
        origin: 'https://imgupscaler.ai',
        referer: 'https://imgupscaler.ai/'
      }
    }
  );

  return res.data.result;
}

async function uploadtoOSS(putUrl, filePath) {
  const file = fs.readFileSync(filePath);
  const type = path.extname(filePath) === '.png' ? 'image/png' : 'image/jpeg';

  const res = await axios.put(putUrl, file, {
    headers: {
      'Content-Type': type,
      'Content-Length': file.length
    },
    maxBodyLength: Infinity
  });

  return res.status === 200;
}

async function createJob(imageUrl, prompt, apiKey) {
  const form = new FormData();
  form.append('model_name', 'magiceraser_v4');
  form.append('original_image_url', imageUrl);
  form.append('prompt', prompt);
  form.append('ratio', 'match_input_image');
  form.append('output_format', 'jpg');

  const res = await axios.post(
    'https://api.magiceraser.org/api/magiceraser/v2/image-editor/create-job',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'product-code': 'magiceraser',
        'product-serial': genserial(),
        'x-api-key': apiKey, 
        origin: 'https://imgupscaler.ai',
        referer: 'https://imgupscaler.ai/'
      }
    }
  );

  return res.data.result.job_id;
}

async function cekjob(jobId, apiKey) {
  const res = await axios.get(
    `https://api.magiceraser.org/api/magiceraser/v1/ai-remove/get-job/${jobId}`,
    {
      headers: {
        'x-api-key': apiKey, 
        origin: 'https://imgupscaler.ai',
        referer: 'https://imgupscaler.ai/'
      }
    }
  );

  return res.data;
}

async function nanobanana(imagePath, prompt, apiKey) {
  let tempFilePath = null;
  
  // Fungsi helper untuk cleanup file
  const cleanup = () => {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  try {
    // Check if imagePath is a URL
    const isUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');
    
    if (isUrl) {
      // Download image from URL
      const response = await axios.get(imagePath, { responseType: 'arraybuffer' });
      const ext = path.extname(imagePath) || '.png';
      tempFilePath = path.join('/tmp', `nano_${Date.now()}${ext}`);
      fs.writeFileSync(tempFilePath, response.data);
      imagePath = tempFilePath;
    }

    const filename = path.basename(imagePath);
    
    // Upload ke imgupscaler
    let uploadRes;
    try {
      uploadRes = await upload(filename, apiKey);
    } catch (uploadErr) {
      throw new Error(`Gagal upload gambar: ${uploadErr.message}`);
    }

    // Upload ke OSS
    try {
      await uploadtoOSS(uploadRes.url, imagePath);
    } catch (ossErr) {
      throw new Error(`Gagal upload ke OSS: ${ossErr.message}`);
    }

    // Cleanup temp file setelah berhasil upload ke OSS
    cleanup();

    const cdn = 'https://cdn.imgupscaler.ai/' + uploadRes.object_name;
    
    // Create job
    let jobId;
    try {
      jobId = await createJob(cdn, prompt, apiKey);
    } catch (jobErr) {
      throw new Error(`Gagal membuat job: ${jobErr.message}`);
    }

    // Cek job status
    let result;
    let attempts = 0;
    const maxAttempts = 20;
    
    do {
      await new Promise(r => setTimeout(r, 3000));
      try {
        result = await cekjob(jobId, apiKey);
      } catch (cekErr) {
        // Continue retrying on check errors
        result = { code: 300006 };
      }
      attempts++;
    } while (result.code === 300006 && attempts < maxAttempts);

    if (!result || !result.result) {
      throw new Error('Gagal mendapatkan hasil: response null');
    }

    if (!result.result.output_url || !result.result.output_url[0]) {
      throw new Error('Output URL tidak tersedia');
    }

    return {
      job_id: jobId,
      image: result.result.output_url[0]
    };
  } finally {
    // Pastikan cleanup selalu dieksekusi
    cleanup();
  }
}

module.exports = async function nanobananaHandler(req, res) {
  const imagePath = req.body.imagePath; 
  const prompt = req.body.prompt;
  const apiKey = req.apiKeyInfo ? req.apiKeyInfo.key : req.body.apiKey;
  
  if (!imagePath || !prompt) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'imagePath' dan 'prompt' diperlukan."
    });
  }

  if (!apiKey && !req.apiKeyInfo) {
    return res.status(401).json({
      status: false,
      message: "API Key diperlukan."
    });
  }

  try {
    const result = await nanobanana(imagePath, prompt, apiKey);
    res.json({ status: true, result });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
