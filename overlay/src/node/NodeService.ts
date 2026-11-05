/**
 * nodejs-mobile 子线程的生命周期 + 桥消息管理。单例。
 *
 * 桥协议见 overlay/nodejs-project/main.js 头部注释。
 * 这里是 App 侧唯一跟 Node 打交道的地方，其它模块一律走 HTTP 或 getBaseUrl()。
 */
import nodejs from 'nodejs-mobile-react-native';
import { BOOT_TIMEOUT } from '../config';

type Cb<T> = (v: T) => void;

class NodeServiceImpl {
    private started = false;
    private ready = false;
    private baseUrl: string | null = null;
    private bootedAt = 0;
    private waiters: { resolve: Cb<string>; reject: Cb<any> }[] = [];
    private logCbs: Cb<string>[] = [];
    private errCbs: Cb<string>[] = [];
    private logs: string[] = [];
    private lastError = '';

    /** 最近 N 条日志，给「我的 → 诊断」页看 */
    recentLogs(n = 200): string[] {
        return this.logs.slice(-n);
    }

    lastErrorText(): string {
        return this.lastError;
    }

    onLog(cb: Cb<string>) {
        this.logCbs.push(cb);
        return () => {
            this.logCbs = this.logCbs.filter((c) => c !== cb);
        };
    }

    onError(cb: Cb<string>) {
        this.errCbs.push(cb);
        return () => {
            this.errCbs = this.errCbs.filter((c) => c !== cb);
        };
    }

    private pushLog(msg: string) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        this.logs.push(line);
        if (this.logs.length > 500) this.logs = this.logs.slice(-400);
        this.logCbs.forEach((c) => c(line));
    }

    private pushErr(err: string) {
        this.lastError = err;
        this.logs.push(`[ERR] ${err}`);
        this.errCbs.forEach((c) => c(err));
    }

    /** 启动内嵌 Node 并绑定桥。幂等，重复调用无副作用。 */
    init() {
        if (this.started) return;
        this.started = true;
        this.bootedAt = Date.now();
        try {
            nodejs.start('main.js');
        } catch (e: any) {
            this.pushErr('Node 启动失败: ' + String(e?.message || e));
            this.rejectAll(new Error(String(e?.message || e)));
            return;
        }
        nodejs.channel.addListener('message', (raw: string) => {
            let m: any;
            try {
                m = JSON.parse(raw);
            } catch (e) {
                return;
            }
            switch (m.type) {
                case 'ready':
                    this.ready = true;
                    this.pushLog('Node ready' + (m.dataDir ? ` (${m.dataDir})` : ''));
                    if (m.degraded) this.pushErr('服务降级启动，部分功能可能不可用');
                    break;
                case 'port':
                    if (typeof m.port === 'number' && m.port > 0) {
                        this.baseUrl = `http://127.0.0.1:${m.port}`;
                        this.pushLog('服务端口 ' + m.port);
                        this.waiters.splice(0).forEach((w) => w.resolve(this.baseUrl as string));
                    }
                    break;
                case 'log':
                    this.pushLog(String(m.msg));
                    break;
                case 'error':
                    this.pushErr(String(m.error));
                    this.rejectAll(new Error(String(m.error)));
                    break;
                case 'sites':
                    // 主动查询的返回，交给调用方订阅
                    this.siteCbs.forEach((c) => c(m.sites || []));
                    break;
                case 'pong':
                    this.lastPong = Date.now();
                    break;
                default:
                    break;
            }
        });
    }

    private siteCbs: Cb<any[]>[] = [];
    lastPong = 0;

    onSites(cb: Cb<any[]>) {
        this.siteCbs.push(cb);
        return () => {
            this.siteCbs = this.siteCbs.filter((c) => c !== cb);
        };
    }

    private rejectAll(err: Error) {
        this.waiters.splice(0).forEach((w) => w.reject(err));
    }

    private send(obj: any) {
        try {
            nodejs.channel.send(JSON.stringify(obj));
        } catch (e) {
            this.pushErr('桥发送失败: ' + String(e));
        }
    }

    /** 拿本地服务地址。未就绪时挂起，超时/出错则 reject。 */
    getBaseUrl(): Promise<string> {
        if (this.baseUrl) return Promise.resolve(this.baseUrl);
        return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
                const stillWaiting = this.waiters.find((w) => w.resolve === resolve);
                if (stillWaiting) {
                    this.waiters = this.waiters.filter((w) => w !== stillWaiting);
                    reject(new Error(`内嵌服务启动超时（${BOOT_TIMEOUT / 1000}s）`));
                }
            }, BOOT_TIMEOUT);
            this.waiters.push({
                resolve: (u: string) => {
                    clearTimeout(timer);
                    resolve(u);
                },
                reject: (e: any) => {
                    clearTimeout(timer);
                    reject(e);
                },
            });
            // 已 ready 但端口还没回来时，补一次 kick
            if (this.ready && !this.baseUrl) this.send({ type: 'restart' });
        });
    }

    /** 重启内嵌服务（改了站点配置或服务卡死时用）。 */
    async restart(): Promise<string> {
        this.baseUrl = null;
        this.send({ type: 'restart' });
        return this.getBaseUrl();
    }

    /** 心跳，用于判断服务是否还活着。 */
    ping() {
        this.send({ type: 'ping' });
    }
}

export default new NodeServiceImpl();
