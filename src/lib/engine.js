// Stockfish 19 (lite, single-threaded WASM) running in a Web Worker.
// The engine files live in /public so they're served from the same origin.
export const ENGINE_URL = '/stockfish-19-lite-single.js';
export const MULTIPV = 5;

export class Engine {
  constructor(onUpdate, onState) {
    this.onUpdate = onUpdate;
    this.onState = onState;
    this.restarts = 0;
    this.want = null;
    this.broken = false;
    this.boot();
  }
  boot() {
    this.ready = false;
    this.searching = false;
    this.stopping = false;
    this.fen = null;
    try {
      this.worker = new Worker(ENGINE_URL);
    } catch (e) {
      this.fail('Your browser blocked the engine from starting.');
      return;
    }
    this.worker.onmessage = (e) => this.handle(String(e.data));
    this.worker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      this.crashed();
    };
    this.send('uci');
  }
  crashed() {
    this.kill();
    if (this.restarts >= 3) {
      this.fail('The engine stopped working. Reload the page to try again.');
      return;
    }
    this.restarts++;
    this.boot();
  }
  kill() {
    try {
      this.worker && this.worker.terminate();
    } catch (e) {
      /* ignore */
    }
    this.worker = null;
  }
  terminate() {
    this.broken = true;
    this.kill();
  }
  fail(msg) {
    this.broken = true;
    this.onState('error', msg);
  }
  send(cmd) {
    this.worker && this.worker.postMessage(cmd);
  }
  handle(line) {
    if (line === 'uciok') {
      this.send(`setoption name MultiPV value ${MULTIPV}`);
      this.send('setoption name Hash value 32');
      this.send('isready');
      return;
    }
    if (line === 'readyok') {
      if (!this.ready) {
        this.ready = true;
        this.onState('ready');
        if (this.want) this.start();
      }
      return;
    }
    if (line.startsWith('bestmove')) {
      this.searching = false;
      this.stopping = false;
      if (this.want) this.start();
      else this.onState('done');
      return;
    }
    if (line.startsWith('info') && !this.stopping && line.includes(' pv ')) {
      const info = parseInfo(line);
      if (info) this.onUpdate(info, this.fen);
    }
  }
  // Never send a new position while a search is still running:
  // ask it to stop, and start the next search when its bestmove arrives.
  stop() {
    this.want = null;
    if (this.searching && !this.stopping) {
      this.send('stop');
      this.stopping = true;
    }
  }
  analyze(fen, depth) {
    if (this.broken) return;
    this.want = { fen, depth };
    if (!this.ready) return;
    if (this.searching) {
      if (!this.stopping) {
        this.send('stop');
        this.stopping = true;
      }
      return;
    }
    this.start();
  }
  start() {
    const w = this.want;
    this.want = null;
    this.fen = w.fen;
    this.send('position fen ' + w.fen);
    this.send('go depth ' + w.depth);
    this.searching = true;
    this.onState('thinking');
  }
}

export function parseInfo(line) {
  const t = line.split(' ');
  const info = {};
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'depth') info.depth = +t[++i];
    else if (k === 'multipv') info.multipv = +t[++i];
    else if (k === 'nps') info.nps = +t[++i];
    else if (k === 'nodes') info.nodes = +t[++i];
    else if (k === 'score') {
      info.kind = t[++i];
      info.value = +t[++i];
      if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
    } else if (k === 'pv') {
      info.pv = t.slice(i + 1);
      break;
    }
  }
  if (!info.pv || !info.pv.length || info.kind == null) return null;
  info.multipv = info.multipv || 1;
  return info;
}
