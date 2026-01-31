const express = require('express');
const fs = require('fs');
const path = require('path');
const { logRouterRequest } = require('./logger');

/* ===============================
   AUTOLOAD [FIX]
================================= */
let regRouter = new Set(); // [FIX] hapus TypeScript <string>
let currentConfig = null;  // [FIX] hapus :any
let appInstance = null;     // [FIX] hapus :Application

// [FIX] initAutoLoad
function initAutoLoad(app, config, configPath) {
    appInstance = app;
    currentConfig = config;

    console.log('[✓] Auto Load Activated');

    // Watch config file
    if (fs.existsSync(configPath)) {
        fs.watch(configPath, (eventType, filename) => {
            if (filename && eventType === 'change') {
                console.log(`Config file changed: ${filename}`);
                try {
                    const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    currentConfig = newConfig;
                    console.log('[✓] Config reloaded successfully');
                    reloadRouter(); // pastikan fungsi reloadRouter ada
                } catch (error) {
                    console.error('[ㄨ] Failed to reload config:', error);
                }
            }
        });
    }

    // Watch router directory
    const routerDir = path.join(process.cwd(), 'router');
    if (fs.existsSync(routerDir)) {
        console.log(`[i] Watching router directory: ${routerDir}`);
        fs.watch(routerDir, { recursive: true }, (eventType, filename) => {
            if (filename && (filename.endsWith('.js') || filename.endsWith('.ts'))) {
                console.log(`[✓] Route file changed: ${filename}`);

                const fullPath = path.join(routerDir, filename);

                if (require.cache[fullPath]) {
                    delete require.cache[fullPath];
                }

                console.log(`Route cache cleared for: ${filename}`);
                reloadSingleRoute(filename); // pastikan fungsi reloadSingleRoute ada
            }
        });
    } else {
        console.warn(`[!] Router directory not found at: ${routerDir}`);
    }
}

/* ===============================
   ROUTER HANDLER [FIX]
================================= */
// [FIX] reload single route
function reloadSingleRoute(filename) {
    const normalized = filename.split(path.sep).join('/');
    const parts = normalized.split('/');

    const category = parts.length > 1 ? parts[parts.length - 2] : null;
    const fileNameWithExt = parts[parts.length - 1];
    const routeName = fileNameWithExt.replace(/\.(ts|js)$/, '');

    if (category && currentConfig && currentConfig.tags && currentConfig.tags[category]) {
        const route = currentConfig.tags[category].find(r => r.filename === routeName);
        if (route) {
            const routeKey = `${route.method}:${route.endpoint}`;
            regRouter.delete(routeKey);
            registerRoute(route, category); // pastikan fungsi registerRoute ada
        }
    }
}

// [FIX] reload all routes
function reloadRouter() {
    console.log('Reloading all routes...');
    regRouter.clear();
    loadRouter(appInstance, currentConfig); // pastikan loadRouter sudah ada
}

// [FIX] load router
function loadRouter(app, config) {
    appInstance = app; // simpan reference
    currentConfig = config;

    const tags = config.tags;
    const creatorName = config.settings.creator;

    if (!tags) {
        console.error("[!] Error: 'tags' not found in config.json");
        return;
    }

    Object.keys(tags).forEach(category => {
        const routes = tags[category];
        routes.forEach(route => {
            registerRoute(route, category, creatorName, app); // pastikan registerRoute ada
        });
    });
}

/* ===============================
   REGISTER ROUTE [FIX]
================================= */
// regRouter & appInstance harus diimport dari autoload atau dideklarasikan global

// [FIX] registerRoute function
function registerRoute(route, category, creatorName, app) {
    const targetApp = app || appInstance;
    const targetCreator = creatorName || (currentConfig && currentConfig.settings && currentConfig.settings.creator);

    if (!targetApp || !targetCreator) return;

    const routeKey = `${route.method}:${route.endpoint}`;

    if (regRouter.has(routeKey)) {
        return;
    }

    const possibleBaseDirs = [
        path.join(__dirname, '..', 'router', category),
        path.join(process.cwd(), 'router', category),
        path.join(process.cwd(), 'dist', 'router', category)
    ];

    const extensions = ['.ts', '.js'];
    let modulePath = '';

    outerLoop:
    for (const dir of possibleBaseDirs) {
        for (const ext of extensions) {
            const attemptPath = path.join(dir, `${route.filename}${ext}`);
            if (fs.existsSync(attemptPath)) {
                modulePath = attemptPath;
                break outerLoop;
            }
        }
    }

    if (modulePath) {
        try {
            try { delete require.cache[require.resolve(modulePath)]; } catch (e) {}

            const handlerModule = require(modulePath);
            const handler = handlerModule.default || handlerModule;

            if (typeof handler === 'function') {
                const wrappedHandler = async (req, res, next) => {
                    logRouterRequest(req, res); // pastikan fungsi ini ada

                    const originalJson = res.json;
                    res.json = function(body) {
                        if (body && typeof body === 'object' && !Array.isArray(body)) {
                            const modifiedBody = { creator: targetCreator, ...body };
                            return originalJson.call(this, modifiedBody);
                        }
                        return originalJson.call(this, body);
                    };

                    try {
                        await handler(req, res, next);
                    } catch (err) {
                        console.error(`Error in route ${route.endpoint}:`, err);
                        res.status(500).json({ error: 'Internal Server Error', message: err instanceof Error ? err.message : String(err) });
                    }
                };

                if (route.method === 'GET') targetApp.get(route.endpoint, wrappedHandler);
                else if (route.method === 'POST') targetApp.post(route.endpoint, wrappedHandler);

                regRouter.add(routeKey);
                console.log(`[✓] LOADED: ${route.method} ${route.endpoint} -> ${path.basename(modulePath)}`);
            } else {
                console.error(`[ㄨ] Invalid handler type in ${modulePath}. Expected function, got ${typeof handler}`);
            }
        } catch (error) {
            console.error(`[ㄨ] Failed to load route ${route.endpoint} from ${modulePath}:`, error);
        }
    } else {
        console.error(`[!] FILE NOT FOUND: router/${category}/${route.filename}.js`);
    }
}

/* ===============================
   EXPORT [FIX]
================================= */
module.exports = { initAutoLoad, loadRouter };
