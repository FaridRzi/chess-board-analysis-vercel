import { useEffect, useRef, useState } from 'react';
import { Engine } from './lib/engine.js';
import { chessAt, turnOf } from './lib/chess.js';

/**
 * Runs Stockfish on `fen` and returns its top lines (White's point of view).
 * `cache` keeps the last known lines per position, used to rank the move played.
 */
export function useEngine({ fen, enabled, depth }) {
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState({ depth: 0, nps: 0 });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const engineRef = useRef(null);
  const cacheRef = useRef(new Map());
  const fenRef = useRef(fen);
  const buf = useRef([]);
  const metaBuf = useRef({ depth: 0, nps: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const flush = () => {
      raf.current = 0;
      setLines(buf.current.slice());
      setMeta({ ...metaBuf.current });
    };
    const engine = new Engine(
      (info, efen) => {
        if (efen !== fenRef.current) return;
        const sign = turnOf(efen) === 'white' ? 1 : -1;
        buf.current[info.multipv - 1] = {
          depth: info.depth,
          kind: info.kind,
          value: info.value * sign,
          pv: info.pv,
          fen: efen,
        };
        cacheRef.current.set(efen, buf.current.slice());
        if (info.multipv === 1) metaBuf.current = { depth: info.depth, nps: info.nps || metaBuf.current.nps };
        if (!raf.current) raf.current = requestAnimationFrame(flush);
      },
      (state, msg) => {
        if (state === 'error') setError(msg);
        setStatus(state === 'ready' ? 'done' : state);
      }
    );
    engineRef.current = engine;
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      engine.terminate();
    };
  }, []);

  useEffect(() => {
    fenRef.current = fen;
    buf.current = [];
    metaBuf.current = { depth: 0, nps: 0 };
    setLines([]);
    setMeta({ depth: 0, nps: 0 });
    const engine = engineRef.current;
    if (!engine) return;
    if (!enabled || chessAt(fen).isGameOver()) engine.stop();
    else engine.analyze(fen, depth);
  }, [fen, enabled, depth]);

  return { lines, meta, status, error, ready: engineRef.current?.ready ?? false, cache: cacheRef.current };
}
