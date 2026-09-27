# Candidate Lines

Chess analysis board. Load a Chess.com link, any PGN (Chess.com, Lichess, …) or hand-typed
moves from a paper game, and see Stockfish 19's top 5 lines, running in your browser.

- React + Vite, board by [chessground](https://github.com/lichess-org/chessground) (Lichess),
  rules by [chess.js](https://github.com/jhlywa/chess.js), engine by
  [Stockfish.js 19](https://github.com/nmrugg/stockfish.js) (lite, single-threaded WASM, GPLv3).
- `api/chesscom/[kind]/[id].js` is a Vercel serverless function that fetches a Chess.com game
  by its ID, so pasting a game link works.

## Deploy to Vercel

**Option A: GitHub (no terminal needed after the first push)**
1. Create a new GitHub repository and push this folder to it.
2. Go to https://vercel.com/new, import the repository, keep the detected settings (Vite), and click Deploy.
3. Every later push to the repository redeploys automatically.

**Option B: Vercel CLI**
```
npm install
npx vercel          # first time: log in and link the project (preview deploy)
npx vercel --prod   # production deploy
```

## Check the Chess.com fetch after deploying
Open `https://<your-project>.vercel.app/api/chesscom/daily/1016737514`.
JSON with a `moveList` means links work. `"Chess.com answered 403."` means Chess.com is
blocking Vercel's servers; pasting the PGN still works.

## Run locally
```
npm install
npm run dev
```
The dev server also serves `/api/chesscom/...`, so links work locally too.

## Project layout
```
api/chesscom/[kind]/[id].js   Chess.com proxy (Vercel function)
public/                       Stockfish engine files (served as-is)
src/App.jsx                   page layout and state
src/useEngine.js              React hook around the Stockfish worker
src/components/               Board, EnginePanel, MoveList, small pieces
src/lib/                      move tree, PGN reader, Chess.com decoder, engine protocol
```

Games still in progress (result `*`) load with the engine off, following Chess.com's fair-play rules.
