import { useEffect, useRef, useState } from 'react';
import { Reviewer, classify, mainLine } from './lib/review.js';
import { chessAt } from './lib/chess.js';

const IDLE = { status: 'idle', done: 0, total: 0, marks: new Map(), moves: new Map(), summary: null };

/**
 * Reviews the game's main line in the background with its own engine, position by position.
 * Marks and the summary fill in as it goes; switching games (or turning it off) stops it.
 */
export function useReview(tree, enabled) {
  const [state, setState] = useState(IDLE);
  const cache = useRef(new Map()); // fen → engine lines, so toggling off/on doesn't start over

  useEffect(() => {
    const nodes = mainLine(tree);
    if (!enabled || nodes.length < 2) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    let reviewer = null;
    const evals = [];
    const publish = (i) => {
      const done = i + 1;
      setState({ status: done === nodes.length ? 'done' : 'running', done, total: nodes.length, ...classify(nodes, evals, done === nodes.length) });
    };

    setState({ ...IDLE, status: 'running', total: nodes.length });
    (async () => {
      try {
        for (let i = 0; i < nodes.length; i++) {
          const fen = nodes[i].fen;
          if (chessAt(fen).isGameOver()) evals[i] = null;
          else if (cache.current.has(fen)) evals[i] = cache.current.get(fen);
          else {
            if (!reviewer) {
              reviewer = new Reviewer();
              await reviewer.ready;
            }
            if (cancelled) return;
            evals[i] = await reviewer.analyze(fen);
            cache.current.set(fen, evals[i]);
          }
          if (cancelled) return;
          publish(i);
        }
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: e.message }));
      } finally {
        if (reviewer) reviewer.terminate();
      }
    })();

    return () => {
      cancelled = true;
      if (reviewer) reviewer.terminate();
    };
  }, [tree, enabled]);

  return state;
}
