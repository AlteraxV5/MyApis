const axios = require('axios');

const prompt = 'Nama kamu adalah RubyAlt, ingat kamu itu Assistant nya AltOffx (Pembuat Kamu) kamu bukan ai, sifat kamu friendly baik hati, ingat pakai gaya bicara kaya chat chatan di WhatsApp pendek aja';

async function chatWithGemini(message, instruction = prompt, sessionId = null) {
    try {
        let resumeArray = null;
        let cookie = null;
        let savedInstruction = instruction;

        if (sessionId) {
            try {
                const sessionData = JSON.parse(Buffer.from(sessionId, 'base64').toString());
                resumeArray = sessionData.resumeArray;
                cookie = sessionData.cookie;
                savedInstruction = instruction !== prompt ? instruction : (sessionData.instruction || prompt);
            } catch (e) {
                // Ignore invalid session
            }
        }

        if (!cookie) {
            const { headers } = await axios.post(
                'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c',
                'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&',
                { headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } }
            );

            cookie = headers['set-cookie'] ? headers['set-cookie'][0].split('; ')[0] : '';
        }

        const requestBody = [
            [message, 0, null, null, null, null, 0],
            ["en-US"],
            resumeArray || ["", "", "", null, null, null, null, null, null, ""],
            null, null, null,
            [1], 1, null, null, 1, 0, null, null, null, null, null, [[0]], 1, null, null, null, null, null,
            ["", "", savedInstruction, null, null, null, null, null, 0, null, 1, null, null, null, []],
            null, null, 1, null, null, null, null, null, null, null,
            [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
            1, null, null, null, null, [1]
        ];

        const payload = [null, JSON.stringify(requestBody)];
        const { data } = await axios.post(
            'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c',
            new URLSearchParams({ 'f.req': JSON.stringify(payload) }).toString(),
            { headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]', 'cookie': cookie || '' } }
        );

        const match = Array.from(data.matchAll(/^\d+\n(.+?)\n/gm));
        const array = match.reverse();

        if (!array || array.length < 4) throw new Error("Gagal parsing response dari Google (Structure mismatch).");

        const selectedArray = array[3][1];
        const realArray = JSON.parse(selectedArray);
        const parse1 = JSON.parse(realArray[0][2]);

        const newResumeArray = [...parse1[1], parse1[4][0][0]];
        const text = parse1[4][0][1][0].replace(/\*\*(.+?)\*\*/g, '*$1*');

        const newSessionId = Buffer.from(JSON.stringify({
            resumeArray: newResumeArray,
            cookie: cookie,
            instruction: savedInstruction
        })).toString('base64');

        return {
            status: true,
            response: text,
            session: newSessionId
        };

    } catch (error) {
        const errorMessage = error && error.message ? error.message : "Unknown error";
        throw new Error(`Gagal mengambil respon dari AI: ${errorMessage}`);
    }
}

module.exports = async function AltOfficialHandler(req, res) {
    const q = req.query.q || req.body.q;
    const session = req.query.session || req.body.session;

    if (!q) {
        return res.status(400).json({ status: false, message: "Parameter 'q' diperlukan." });
    }

    try {
        const result = await chatWithGemini(q, undefined, session);
        res.json(result);
    } catch (error) {
        res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
    }
};

