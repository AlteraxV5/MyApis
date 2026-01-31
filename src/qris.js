const STATIC_QRIS =
  "00020101021126610014COM.GO-JEK.WWW01189360091433235676600210G3235676600303UMI51440014ID.CO.QRIS.WWW0215ID10264726415900303UMI5204899953033605802ID5925DANDI EKA SAPUTRA, Digita6006BANTUL61055576362070703A01630460EC";

function crc16(s) {
  let crc = 0xFFFF;

  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000)
        ? (crc << 1) ^ 0x1021
        : crc << 1;
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}

function convertCRC16(str) {
  return str + crc16(str);
}

function generateQrisDynamic(nominal) {
  try {
    if (!STATIC_QRIS || STATIC_QRIS.trim() === "") return "";

    let qris = STATIC_QRIS.slice(0, -4);
    qris = qris.replace("010211", "010212");

    const amount = nominal.toString();
    const tag54 = "54" + amount.length.toString().padStart(2, "0") + amount;

    const split = qris.split("5802ID");
    if (split.length < 2) return "";

    const finalStr = split[0] + tag54 + "5802ID" + split[1] + "6304";
    return convertCRC16(finalStr);

  } catch (e) {
    return "";
  }
}

function validateQRIS(qrisString) {
  if (!qrisString || qrisString.length < 20) return false;

  try {
    const data = qrisString.slice(0, -4);
    const crc = qrisString.slice(-4);
    return crc === crc16(data);
  } catch (e) {
    return false;
  }
}

function isStaticQrisConfigured() {
  return STATIC_QRIS.trim() !== "";
}

// **FINAL EXPORT** — Hanya sekali
module.exports = {
  STATIC_QRIS,
  generateQrisDynamic,
  validateQRIS,
  isStaticQrisConfigured
};
