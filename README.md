/* ===============================
   HOLA I`AM AltOficial ID ( Backend Development )
================================= */

                              REST API
Simple, Fast, and Dynamic REST API Base built with Express & TypeScript.

✨ Fitur Utama
Fitur	Deskripsi
🚀 TypeScript	Coding lebih aman, rapi, dan minim bug dengan static typing.
⚙️ Dynamic Routing	Tambah endpoint via src/config.json tanpa perlu mengubah index.ts.
📖 Auto Docs	Halaman /docs otomatis tergenerate berdasarkan config yang dibuat.
🎨 Modern UI	Tampilan Landing page & Docs yang bersih, modern, dan responsif.
📊 Visitor Counter	Database JSON sederhana untuk melacak traffic API.
📂 Modular Structure	Susunan folder dikelompokkan rapi berdasarkan kategori.
🔧 Build System	Script otomatis untuk kompilasi TypeScript ke JavaScript (Production Ready).

.
├── index.js                   # Entry point utama server                # Compiled JavaScript files (Production)          # Compiled main server file
├── src/                       # Compiled source files & configs                # Compiled route handlers
├── public/                    # Frontend files
│   ├── 404.html
│   ├── docs.html              # Halaman docs API
│   ├── landing.html           # Halaman utama
│   └── ...
├── router/                    # Folder Endpoint (Kategori - JavaScript)
│   ├── ai/
│   ├── download/
│   ├── maker/
│   ├── random/
│   ├── search/
│   └── tools/
├── src/                       # Source files & Logic
│   ├── autoload.js            # Logic auto load router
│   ├── config.json            # Configuration router
│   └── ...
├── package.json               # Dependencies & scripts            # TypeScript configuration
└── vercel.json                # Vercel deployment config

📦 Build System & Folder dist/ Apa itu Folder dist/? dist/ (singkatan dari distribution) adalah folder yang berisi hasil kompilasi kode dari TypeScript menjadi JavaScript. Folder ini penting karena:

Runtime: Node.js hanya bisa menjalankan JavaScript, bukan TypeScript secara langsung.
Performance: Kode yang dikompilasi lebih optimal untuk production.
Deploy: Folder ini yang akan dijalankan di server. Perbandingan Mode | Mode | Command | Folder | Keterangan | |---|---|---|---| | Development | npm run dev | Memory | Langsung jalankan TS dengan ts-node (Hot Reload). | | Production | npm run build + npm start | dist/ | Kompilasi TS ke JS dulu, lalu jalankan file JS. | 🛠️ Installation & Running Pastikan kamu sudah menginstall Node.js (versi 18 atau lebih baru).