'use strict';
/*
 * nodejs-mobile 内嵌 Node18 入口。
 *
 * 与原版 CatVodOpen 的差别：不再从远端下载 index.js + index.config.js，
 * 爬虫服务直接内置（server.js + spiders/），装完即可用，站点由用户在 App 里配。
 * 好处是断网也能起、不会被源站下线打死；代价是不能吃 CatVodOpen 的 fastify 插件式源，
 * 需要按 spiders/custom.js 头部的简化契约改写。
 *
 * 与 RN 的桥消息（JSON 字符串）：
 *   收: {type:'ping'} {type:'restart'} {type:'sites'} {type:'log-tail'}
 *   发: {type:'ready'} {type:'port',port} {type:'log',msg} {type:'error',error}
 *       {type:'sites',sites} {type:'pong',ts}
 */
const rn = require('rn-bridge');
const path = require('path');
const fs = require('fs');

let baseDir = process.cwd();
try {
    if (rn.app && typeof rn.app.datadir === 'function') baseDir = rn.app.datadir();
} catch (e) {
    /* 回落到 cwd，桌面端跑测试时走这条 */
}

const DATA = path.join(baseDir, 'boxclone');
try {
    fs.mkdirSync(DATA, { recursive: true });
} catch (e) {}

const send = (o) => {
    try {
        rn.channel.send(JSON.stringify(o));
    } catch (e) {}
};
const log = (...a) => send({ type: 'log', msg: a.map(String).join(' ') });

const store = require('./store')(DATA);
const { createServer } = require('./server');

let srv = null;
let port = 0;

function listen() {
    return new Promise((resolve, reject) => {
        const server = createServer(store, { dataDir: DATA, log });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            srv = server;
            port = srv.address().port;
            resolve(port);
        });
    });
}

function closeServer() {
    return new Promise((resolve) => {
        if (!srv) return resolve();
        try {
            srv.close(() => resolve());
        } catch (e) {
            resolve();
        }
        srv = null;
        port = 0;
    });
}

async function boot() {
    if (srv && port) {
        send({ type: 'port', port });
        return port;
    }
    await listen();
    log('server listening on 127.0.0.1:' + port);
    send({ type: 'port', port });
    return port;
}

rn.channel.on('message', async (raw) => {
    let m;
    try {
        m = JSON.parse(raw);
    } catch (e) {
        return;
    }
    try {
        switch (m && m.type) {
            case 'ping':
                send({ type: 'pong', ts: Date.now() });
                break;

            case 'restart':
                log('restarting…');
                await closeServer();
                await boot();
                break;

            case 'sites':
                send({ type: 'sites', sites: store.list() });
                break;

            case 'log-tail':
                send({ type: 'log', msg: 'dataDir=' + DATA });
                break;

            default:
                break;
        }
    } catch (e) {
        send({ type: 'error', error: String((e && e.stack) || e) });
    }
});

// 任何未捕获异常都不让 Node 线程静默死掉：回传后继续服务
process.on('uncaughtException', (e) => {
    send({ type: 'error', error: 'uncaught: ' + String((e && e.stack) || e) });
});
process.on('unhandledRejection', (e) => {
    send({ type: 'error', error: 'unhandled: ' + String((e && e.stack) || e) });
});

boot()
    .then(() => send({ type: 'ready', dataDir: DATA }))
    .catch((e) => {
        send({ type: 'error', error: 'boot failed: ' + String((e && e.stack) || e) });
        send({ type: 'ready', dataDir: DATA, degraded: true });
    });
