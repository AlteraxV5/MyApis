/* ===============================
  ADMIN ACCESS
================================= */
const fs = require('fs');
const path = require('path');

const adminFile = path.join(__dirname, 'admins.json');
// ===== HELPER =====
function loadAdmins() {
    if (!fs.existsSync(adminFile)) {
        fs.writeFileSync(adminFile, JSON.stringify([], null, 2));
        return [];
    }
    return JSON.parse(fs.readFileSync(adminFile, 'utf8'));
}

// ================= FUNCTIONS =================
function saveAdmins(admins) {
    fs.writeFileSync(adminFile, JSON.stringify(admins, null, 2));
}
// Tambah admin
function addAdmin(username, password) {
    const admins = loadAdmins();
    admins.push({ username, password });
    saveAdmins(admins);
}

// Hapus admin
function delAdmin(username) {
    const admins = loadAdmins().filter(
        a => a.username.toLowerCase() !== username.toLowerCase()
    );
    saveAdmins(admins);
}

// Cek login admin
function checkAdmin(username, password) {
    const admins = loadAdmins();
    return admins.some(a =>
        a.username.trim().toLowerCase() === username.trim().toLowerCase() &&
        a.password.trim() === password.trim()
    );
}

module.exports = { addAdmin, delAdmin, checkAdmin };