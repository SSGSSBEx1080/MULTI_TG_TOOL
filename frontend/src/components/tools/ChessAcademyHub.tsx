import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  HelpCircle,
  Layers,
  Puzzle,
  RotateCcw,
  Swords,
  Undo2,
} from 'lucide-react';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

type Color = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
interface Piece {
  c: Color;
  t: PieceType;
}
type Board = (Piece | null)[][];

interface ChessMove {
  fr: number;
  fc: number;
  tr: number;
  tc: number;
  capture?: Piece | null;
  castle?: 'K' | 'Q';
  epCapture?: [number, number];
  promo?: PieceType;
  notation: string;
}

interface GameState {
  board: Board;
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  epTarget: [number, number] | null;
  history: string[];
  lastMove: { fr: number; fc: number; tr: number; tc: number } | null;
}

const PIECE_GLYPHS: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const sqName = (r: number, c: number) => `${FILES[c]}${8 - r}`;
const nameToSq = (sq: string): [number, number] => [8 - Number(sq[1]), FILES.indexOf(sq[0])];

function parseFEN(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += Number(ch);
      } else {
        const isUpper = ch === ch.toUpperCase();
        board[r][c] = { c: isUpper ? 'w' : 'b', t: ch.toLowerCase() as PieceType };
        c++;
      }
    }
  }
  const turn: Color = parts[1] === 'b' ? 'b' : 'w';
  const cas = parts[2] || '-';
  return {
    board,
    turn,
    castling: {
      wK: cas.includes('K'),
      wQ: cas.includes('Q'),
      bK: cas.includes('k'),
      bQ: cas.includes('q'),
    },
    epTarget: parts[3] && parts[3] !== '-' ? nameToSq(parts[3]) : null,
    history: [],
    lastMove: null,
  };
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isSquareAttacked(board: Board, tr: number, tc: number, byColor: Color): boolean {
  // Pawn attacks
  const pDir = byColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = tr + pDir;
    const pc = tc + dc;
    if (inBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.c === byColor && p.t === 'p') return true;
    }
  }
  // Knights
  const kJumps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of kJumps) {
    const r = tr + dr;
    const c = tc + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.c === byColor && p.t === 'n') return true;
    }
  }
  // King
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = tr + dr;
      const c = tc + dc;
      if (inBounds(r, c)) {
        const p = board[r][c];
        if (p && p.c === byColor && p.t === 'k') return true;
      }
    }
  }
  // Rook / Queen lines
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.c === byColor && (p.t === 'r' || p.t === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  // Bishop / Queen diagonals
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.c === byColor && (p.t === 'b' || p.t === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.c === color && p.t === 'k') return [r, c];
    }
  }
  return null;
}

function isInCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  if (!k) return false;
  return isSquareAttacked(board, k[0], k[1], color === 'w' ? 'b' : 'w');
}

function applyMoveState(st: GameState, mv: ChessMove): GameState {
  const nb = cloneBoard(st.board);
  const moving = nb[mv.fr][mv.fc]!;
  nb[mv.fr][mv.fc] = null;

  if (mv.epCapture) {
    nb[mv.epCapture[0]][mv.epCapture[1]] = null;
  }
  if (mv.castle === 'K') {
    nb[mv.tr][5] = nb[mv.tr][7];
    nb[mv.tr][7] = null;
  } else if (mv.castle === 'Q') {
    nb[mv.tr][3] = nb[mv.tr][0];
    nb[mv.tr][0] = null;
  }

  nb[mv.tr][mv.tc] = mv.promo ? { c: moving.c, t: mv.promo } : moving;

  const cas = { ...st.castling };
  if (moving.t === 'k') {
    if (moving.c === 'w') {
      cas.wK = false;
      cas.wQ = false;
    } else {
      cas.bK = false;
      cas.bQ = false;
    }
  }
  if (mv.fr === 7 && mv.fc === 7) cas.wK = false;
  if (mv.fr === 7 && mv.fc === 0) cas.wQ = false;
  if (mv.fr === 0 && mv.fc === 7) cas.bK = false;
  if (mv.fr === 0 && mv.fc === 0) cas.bQ = false;
  if (mv.tr === 7 && mv.tc === 7) cas.wK = false;
  if (mv.tr === 7 && mv.tc === 0) cas.wQ = false;
  if (mv.tr === 0 && mv.tc === 7) cas.bK = false;
  if (mv.tr === 0 && mv.tc === 0) cas.bQ = false;

  let ep: [number, number] | null = null;
  if (moving.t === 'p' && Math.abs(mv.tr - mv.fr) === 2) {
    ep = [(mv.fr + mv.tr) / 2, mv.fc];
  }

  const nextTurn: Color = st.turn === 'w' ? 'b' : 'w';
  return {
    board: nb,
    turn: nextTurn,
    castling: cas,
    epTarget: ep,
    history: [...st.history, mv.notation],
    lastMove: { fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc },
  };
}

function generateLegalMoves(st: GameState): ChessMove[] {
  const pseudo: ChessMove[] = [];
  const { board, turn, castling, epTarget } = st;
  const enemy: Color = turn === 'w' ? 'b' : 'w';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.c !== turn) continue;

      if (p.t === 'p') {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        const promoRow = turn === 'w' ? 0 : 7;

        const r1 = r + dir;
        if (inBounds(r1, c) && !board[r1][c]) {
          const promo = r1 === promoRow ? ('q' as PieceType) : undefined;
          pseudo.push({
            fr: r,
            fc: c,
            tr: r1,
            tc: c,
            promo,
            notation: `${sqName(r1, c)}${promo ? '=Q' : ''}`,
          });
          const r2 = r + dir * 2;
          if (r === startRow && !board[r2][c]) {
            pseudo.push({ fr: r, fc: c, tr: r2, tc: c, notation: sqName(r2, c) });
          }
        }
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!inBounds(r1, nc)) continue;
          const target = board[r1][nc];
          if (target && target.c === enemy) {
            const promo = r1 === promoRow ? ('q' as PieceType) : undefined;
            pseudo.push({
              fr: r,
              fc: c,
              tr: r1,
              tc: nc,
              capture: target,
              promo,
              notation: `${FILES[c]}x${sqName(r1, nc)}${promo ? '=Q' : ''}`,
            });
          } else if (epTarget && epTarget[0] === r1 && epTarget[1] === nc) {
            pseudo.push({
              fr: r,
              fc: c,
              tr: r1,
              tc: nc,
              epCapture: [r, nc],
              notation: `${FILES[c]}x${sqName(r1, nc)}`,
            });
          }
        }
      } else if (p.t === 'n') {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const t = board[nr][nc];
          if (!t || t.c === enemy) {
            pseudo.push({
              fr: r,
              fc: c,
              tr: nr,
              tc: nc,
              capture: t,
              notation: `N${t ? 'x' : ''}${sqName(nr, nc)}`,
            });
          }
        }
      } else if (p.t === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = board[nr][nc];
            if (!t || t.c === enemy) {
              pseudo.push({
                fr: r,
                fc: c,
                tr: nr,
                tc: nc,
                capture: t,
                notation: `K${t ? 'x' : ''}${sqName(nr, nc)}`,
              });
            }
          }
        }
        // Castling
        const homeRow = turn === 'w' ? 7 : 0;
        if (r === homeRow && c === 4 && !isSquareAttacked(board, homeRow, 4, enemy)) {
          const canK = turn === 'w' ? castling.wK : castling.bK;
          const canQ = turn === 'w' ? castling.wQ : castling.bQ;
          if (
            canK &&
            !board[homeRow][5] &&
            !board[homeRow][6] &&
            !isSquareAttacked(board, homeRow, 5, enemy) &&
            !isSquareAttacked(board, homeRow, 6, enemy)
          ) {
            pseudo.push({ fr: r, fc: c, tr: homeRow, tc: 6, castle: 'K', notation: 'O-O' });
          }
          if (
            canQ &&
            !board[homeRow][1] &&
            !board[homeRow][2] &&
            !board[homeRow][3] &&
            !isSquareAttacked(board, homeRow, 3, enemy) &&
            !isSquareAttacked(board, homeRow, 2, enemy)
          ) {
            pseudo.push({ fr: r, fc: c, tr: homeRow, tc: 2, castle: 'Q', notation: 'O-O-O' });
          }
        }
      } else {
        const dirs =
          p.t === 'b'
            ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
            : p.t === 'r'
            ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
            : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
        const sym = p.t.toUpperCase();
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          while (inBounds(nr, nc)) {
            const t = board[nr][nc];
            if (!t) {
              pseudo.push({ fr: r, fc: c, tr: nr, tc: nc, notation: `${sym}${sqName(nr, nc)}` });
            } else {
              if (t.c === enemy) {
                pseudo.push({
                  fr: r,
                  fc: c,
                  tr: nr,
                  tc: nc,
                  capture: t,
                  notation: `${sym}x${sqName(nr, nc)}`,
                });
              }
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
      }
    }
  }

  return pseudo.filter((mv) => {
    const next = applyMoveState(st, mv);
    return !isInCheck(next.board, turn);
  });
}

// Positional evaluation + Alpha-Beta AI
const PIECE_VAL: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      let val = PIECE_VAL[p.t];
      // Center control bonus
      const centerDist = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      if (p.t === 'n' || p.t === 'b') val += (4 - centerDist) * 8;
      if (p.t === 'p') {
        const adv = p.c === 'w' ? 6 - r : r - 1;
        val += adv * 10 + (c >= 2 && c <= 5 ? 8 : 0);
      }
      score += p.c === 'w' ? val : -val;
    }
  }
  return score;
}

function chooseBestMove(st: GameState, depth: number, jitter = 0): ChessMove | null {
  const moves = generateLegalMoves(st);
  if (!moves.length) return null;

  // Order captures first for fast alpha-beta cutoffs
  moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

  const search = (node: GameState, d: number, alpha: number, beta: number): number => {
    if (d === 0) return evaluateBoard(node.board);
    const legals = generateLegalMoves(node);
    if (!legals.length) {
      if (isInCheck(node.board, node.turn)) {
        return node.turn === 'w' ? -99999 - d : 99999 + d;
      }
      return 0;
    }
    if (node.turn === 'w') {
      let best = -Infinity;
      for (const m of legals) {
        best = Math.max(best, search(applyMoveState(node, m), d - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of legals) {
        best = Math.min(best, search(applyMoveState(node, m), d - 1, alpha, beta));
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  };

  let bestMove = moves[0];
  let bestVal = st.turn === 'w' ? -Infinity : Infinity;
  for (const mv of moves) {
    const raw = search(applyMoveState(st, mv), depth - 1, -Infinity, Infinity);
    const noise = jitter ? (Math.random() - 0.5) * jitter : 0;
    const v = raw + noise;
    if (st.turn === 'w' ? v > bestVal : v < bestVal) {
      bestVal = v;
      bestMove = mv;
    }
  }
  return bestMove;
}

// ==============================================================================
// OPENINGS & TACTICAL PUZZLES LESSONS DATABASE
// ==============================================================================
interface OpeningLesson {
  id: string;
  title: string;
  eco: string;
  summary: string;
  steps: { from: string; to: string; comment: string }[];
}

const OPENING_LESSONS: OpeningLesson[] = [
  {
    id: 'italian',
    title: 'Итальянская партия (Giuoco Piano)',
    eco: 'C50',
    summary: 'Классический открытый дебют: мгновенный захват центра, быстрый вывод коня и слона с прицелом на уязвимый пункт f7.',
    steps: [
      { from: 'e2', to: 'e4', comment: '1. e4 — Белые захватывают центр и открывают диагонали ферзю и белопольному слону.' },
      { from: 'e7', to: 'e5', comment: '1... e5 — Чёрные симметрично встречают пешку в центре.' },
      { from: 'g1', to: 'f3', comment: '2. Кf3 — Развитие коня с прямым нападением на центральную пешку e5.' },
      { from: 'b8', to: 'c6', comment: '2... Кc6 — Чёрные надёжно защищают пешку e5 с темпом развития.' },
      { from: 'f1', to: 'c4', comment: '3. Сc4! — Слон выходит на самую активную диагональ a2–g8, атакуя слабое поле f7 около короля.' },
      { from: 'f8', to: 'c5', comment: '3... Сc5 — Классическая Итальянская партия: оба короля готовы к короткой рокировке.' },
    ],
  },
  {
    id: 'sicilian',
    title: 'Сицилианская защита',
    eco: 'B20–B99',
    summary: 'Самый боевой и результативный ответ чёрных на 1.e4 — асимметричная борьба за поле d4 и контратака на ферзевом фланге.',
    steps: [
      { from: 'e2', to: 'e4', comment: '1. e4 — Белые начинают открытую игру.' },
      { from: 'c7', to: 'c5', comment: '1... c5! — Чёрные не копируют белых, а берут под бой ключевое центральное поле d4 с фланга.' },
      { from: 'g1', to: 'f3', comment: '2. Кf3 — Белые готовят прорыв d2–d4.' },
      { from: 'd7', to: 'd6', comment: '2... d6 — Контроль поля e5 и открытие дороги белопольному слону.' },
      { from: 'd2', to: 'd4', comment: '3. d4 — Вскрытие центра, где белые получают пространство, а чёрные — полуоткрытую линию «c».' },
      { from: 'c5', to: 'd4', comment: '3... cxd4 — Размен фланговой пешки c5 на центральную пешку d4 белых!' },
    ],
  },
  {
    id: 'queens_gambit',
    title: 'Ферзевый гамбит',
    eco: 'D06–D69',
    summary: 'Фундамент позиционных шахмат: белые предлагают пешку c4 ради тотального доминирования в центре.',
    steps: [
      { from: 'd2', to: 'd4', comment: '1. d4 — Надёжный захват центра под защитой ферзя.' },
      { from: 'd7', to: 'd5', comment: '1... d5 — Чёрные удерживают равновесие в центре.' },
      { from: 'c2', to: 'c4', comment: '2. c4! — Ферзевый гамбит: подрываем опору чёрных на d5. Брать пешку чёрным опасно из-за потери центра.' },
      { from: 'e7', to: 'e6', comment: '2... e6 — Отказанный ферзевый гамбит: чёрные укрепляют пункт d5 и открывают слона f8.' },
      { from: 'b1', to: 'c3', comment: '3. Кc3 — Усиливаем давление на d5 и поле e4.' },
      { from: 'g8', to: 'f6', comment: '3... Кf6 — Гармоничное развитие королевского фланга.' },
    ],
  },
  {
    id: 'scholars_defense',
    title: 'Защита от Детского мата',
    eco: 'Урок №1',
    summary: 'Как грамотно наказать ранний выпад ферзя 2.Фh5 и перехватить инициативу с выигрышем темпов.',
    steps: [
      { from: 'e2', to: 'e4', comment: '1. e4 — Открытие диагонали ферзю и слону.' },
      { from: 'e7', to: 'e5', comment: '1... e5 — Занимаем центр.' },
      { from: 'd1', to: 'h5', comment: '2. Фh5?! — Ранний выпад ферзя с двойным ударом на пешку e5 и поле f7.' },
      { from: 'b8', to: 'c6', comment: '2... Кc6! — Первое правило: сначала защищаем пешку e5 развитием фигуры (НЕ g6 — иначе Фxe5+ с потерей ладьи!).' },
      { from: 'f1', to: 'c4', comment: '3. Сc4 — Белые грозят детским матом Фxf7# в один ход!' },
      { from: 'g7', to: 'g6', comment: '3... g6! — Теперь, когда пешка e5 защищена конём, ход g6 перекрывает атаку на f7 и отбрасывает ферзя белых!' },
    ],
  },
];

interface TacticsPuzzle {
  id: string;
  title: string;
  theme: string;
  fen: string;
  solutionFrom: string;
  solutionTo: string;
  explanation: string;
}

const CLEAN_TACTICS: TacticsPuzzle[] = [
  {
    id: 'puz_1',
    title: 'Задача №1: Мат по последней горизонтали',
    theme: 'Мат в 1 ход',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solutionFrom: 'd1',
    solutionTo: 'd8',
    explanation: 'Лd8#! Чёрный король заперт собственными пешками f7–g7–h7 на восьмой горизонтали.',
  },
  {
    id: 'puz_2',
    title: 'Задача №2: Королевская вилка конём',
    theme: 'Выигрыш ферзя (Вилка)',
    fen: '4k3/5ppp/q7/3N4/8/8/5PPP/6K1 w - - 0 1',
    solutionFrom: 'd5',
    solutionTo: 'c7',
    explanation: 'Кc7+! Конь одновременно объявляет шах королю на e8 и атакует незащищённого ферзя на a6.',
  },
  {
    id: 'puz_3',
    title: 'Задача №3: Батарея ферзя и слона (Мат в 1)',
    theme: 'Атака на короля',
    fen: 'r4rk1/ppp2p1p/6p1/8/2B5/5Q2/PPP2PPP/6K1 w - - 0 1',
    solutionFrom: 'f3',
    solutionTo: 'f6',
    explanation: 'Фf6! Неотразимая угроза мата Фg7# по ослабленным чёрным полям вокруг короля.',
  },
  {
    id: 'puz_4',
    title: 'Задача №4: Арабский мат конём и ладьёй',
    theme: 'Мат в 1 ход',
    fen: '7k/1R6/5N2/8/8/8/6PP/6K1 w - - 0 1',
    solutionFrom: 'b7',
    solutionTo: 'h7',
    explanation: 'Лh7#! Классический арабский мат: конь с f6 защищает ладью h7 и отнимает поле g8 у короля.',
  },
];

export const ChessAcademyHub: React.FC<{
  onScoreSubmit: (gameId: string, score: number) => void;
  onToast: (msg: string) => void;
}> = ({ onScoreSubmit, onToast }) => {
  const [section, setSection] = useState<'play' | 'openings' | 'puzzles'>('play');
  const [opponent, setOpponent] = useState<'ai1' | 'ai2' | 'ai3' | 'human'>('ai2');
  const [view3D, setView3D] = useState(true);
  const [flipped, setFlipped] = useState(false);

  const [game, setGame] = useState<GameState>(() => parseFEN(START_FEN));
  const [prevStack, setPrevStack] = useState<GameState[]>([]);
  const [selectedSq, setSelectedSq] = useState<[number, number] | null>(null);
  const [hintMove, setHintMove] = useState<ChessMove | null>(null);

  // Openings trainer state
  const [lessonIdx, setLessonIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  // Tactics puzzle state
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);

  const legalMoves = useMemo(() => generateLegalMoves(game), [game]);
  const inCheckNow = useMemo(() => isInCheck(game.board, game.turn), [game]);

  const gameStatus = useMemo(() => {
    if (legalMoves.length === 0) {
      if (inCheckNow) {
        return game.turn === 'w' ? 'Мат! Победа чёрных ♚' : 'Мат! Победа белых ♔';
      }
      return 'Пат — Ничья 🤝';
    }
    return null;
  }, [legalMoves, inCheckNow, game.turn]);

  // Switch modes cleanly
  const resetToMode = (nextSec: 'play' | 'openings' | 'puzzles', idx = 0) => {
    setSection(nextSec);
    setSelectedSq(null);
    setHintMove(null);
    setPrevStack([]);
    if (nextSec === 'play') {
      setGame(parseFEN(START_FEN));
    } else if (nextSec === 'openings') {
      setLessonIdx(idx);
      setStepIdx(0);
      setGame(parseFEN(START_FEN));
    } else {
      setPuzzleIdx(idx);
      setPuzzleSolved(false);
      setGame(parseFEN(CLEAN_TACTICS[idx].fen));
    }
  };

  // AI Response in 'play' mode (plays Black)
  useEffect(() => {
    if (section !== 'play' || opponent === 'human' || game.turn !== 'b' || gameStatus) return;
    const timer = window.setTimeout(() => {
      const depth = opponent === 'ai1' ? 1 : opponent === 'ai2' ? 2 : 3;
      const jitter = opponent === 'ai1' ? 140 : opponent === 'ai2' ? 25 : 0;
      const aiMv = chooseBestMove(game, depth, jitter);
      if (aiMv) {
        setGame((prev) => applyMoveState(prev, aiMv));
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [section, opponent, game, gameStatus]);

  // Report checkmate win vs AI to leaderboard
  useEffect(() => {
    if (section === 'play' && opponent !== 'human' && gameStatus?.includes('Победа белых')) {
      const pts = opponent === 'ai3' ? 1200 : opponent === 'ai2' ? 750 : 400;
      onScoreSubmit('chess_academy', pts);
      onToast(`♟️ Мат поставлен! +${pts} очков рейтинга в таблицу лидеров!`);
    }
  }, [gameStatus]);

  const currentLesson = OPENING_LESSONS[lessonIdx];
  const expectedLessonStep = section === 'openings' ? currentLesson.steps[stepIdx] : null;
  const currentPuzzle = CLEAN_TACTICS[puzzleIdx];

  const handleSquareClick = (r: number, c: number) => {
    if (gameStatus && section === 'play') return;
    if (section === 'play' && opponent !== 'human' && game.turn === 'b') return;

    const clickedPiece = game.board[r][c];

    if (selectedSq) {
      const candidate = legalMoves.find(
        (m) => m.fr === selectedSq[0] && m.fc === selectedSq[1] && m.tr === r && m.tc === c
      );
      if (candidate) {
        // Mode validation for Openings & Puzzles
        if (section === 'openings' && expectedLessonStep) {
          const fromStr = sqName(candidate.fr, candidate.fc);
          const toStr = sqName(candidate.tr, candidate.tc);
          if (fromStr !== expectedLessonStep.from || toStr !== expectedLessonStep.to) {
            onToast(`По теории дебюта сделайте ход ${expectedLessonStep.from} → ${expectedLessonStep.to}`);
            setSelectedSq(null);
            return;
          }
          setGame((g) => applyMoveState(g, candidate));
          setStepIdx((s) => s + 1);
          setSelectedSq(null);
          return;
        }

        if (section === 'puzzles' && !puzzleSolved) {
          const fromStr = sqName(candidate.fr, candidate.fc);
          const toStr = sqName(candidate.tr, candidate.tc);
          if (fromStr === currentPuzzle.solutionFrom && toStr === currentPuzzle.solutionTo) {
            setGame((g) => applyMoveState(g, candidate));
            setPuzzleSolved(true);
            const nextSolved = solvedCount + 1;
            setSolvedCount(nextSolved);
            onScoreSubmit('chess_academy', nextSolved * 250);
            onToast('✨ Блестящий тактический удар! Задача решена верно.');
          } else {
            onToast('Не самый точный ход — найдите форсированный тактический удар!');
          }
          setSelectedSq(null);
          return;
        }

        setPrevStack((st) => [...st.slice(-20), game]);
        setGame((g) => applyMoveState(g, candidate));
        setSelectedSq(null);
        setHintMove(null);
        return;
      }
    }

    if (clickedPiece && clickedPiece.c === game.turn) {
      setSelectedSq([r, c]);
    } else {
      setSelectedSq(null);
    }
  };

  const selectedTargets = useMemo(() => {
    if (!selectedSq) return new Map<string, ChessMove>();
    const map = new Map<string, ChessMove>();
    for (const m of legalMoves) {
      if (m.fr === selectedSq[0] && m.fc === selectedSq[1]) {
        map.set(`${m.tr}_${m.tc}`, m);
      }
    }
    return map;
  }, [selectedSq, legalMoves]);

  const undoMove = () => {
    if (!prevStack.length) return;
    const prev = prevStack[prevStack.length - 1];
    setPrevStack((s) => s.slice(0, -1));
    setGame(prev);
    setSelectedSq(null);
    setHintMove(null);
  };

  const askEngineHint = () => {
    const best = chooseBestMove(game, 2, 0);
    setHintMove(best);
    if (best) {
      onToast(`💡 Совет движка: ${sqName(best.fr, best.fc)} → ${sqName(best.tr, best.tc)} (${best.notation})`);
    }
  };

  const displayRows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="chess_academy" color="#6366f1" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              ♟️ Шахматы — Игра с ИИ, Дебюты и Тактические Задачи
            </h3>
            <p className="text-[11px] text-slate-400">
              Полные правила ФИДЕ (рокировка, взятие на проходе, превращение), 3D/2D доска и обучение
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => resetToMode('play')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              section === 'play'
                ? 'bg-indigo-500/25 border-indigo-400 text-indigo-100'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" /> Партия
          </button>
          <button
            type="button"
            onClick={() => resetToMode('openings', 0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              section === 'openings'
                ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Уроки дебютов
          </button>
          <button
            type="button"
            onClick={() => resetToMode('puzzles', 0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              section === 'puzzles'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" /> Задачи ({solvedCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Interactive 3D / 2D Chessboard */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-3">
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs px-1">
            <span className="font-semibold text-slate-200">
              {gameStatus ? (
                <span className="text-amber-300 font-bold">{gameStatus}</span>
              ) : (
                <>
                  Ход: <b>{game.turn === 'w' ? '⚪ Белых' : '⚫ Чёрных'}</b>
                  {inCheckNow && <span className="ml-2 text-rose-400 font-bold">• ШАХ!</span>}
                </>
              )}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setView3D((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 ${
                  view3D
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                <Layers className="w-3 h-3" /> {view3D ? '3D Доска' : '2D Доска'}
              </button>
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px]"
              >
                Перевернуть
              </button>
            </div>
          </div>

          {/* Board Container with Optional 3D Tournament Perspective */}
          <div
            className="w-full max-w-[430px] mx-auto py-1"
            style={{ perspective: view3D ? '920px' : 'none' }}
          >
            <div
              style={{
                transform: view3D ? 'rotateX(19deg)' : 'none',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className={`rounded-2xl p-2 bg-slate-950 border-2 border-indigo-500/35 ${
                view3D ? 'shadow-[0_22px_36px_rgba(2,6,23,0.85)] border-b-[8px] border-b-slate-800' : 'shadow-xl'
              }`}
            >
              <div className="grid grid-cols-8 aspect-square rounded-xl overflow-hidden border border-white/15">
                {displayRows.map((r) =>
                  displayCols.map((c) => {
                    const isLight = (r + c) % 2 === 0;
                    const p = game.board[r][c];
                    const isSelected = selectedSq?.[0] === r && selectedSq?.[1] === c;
                    const targetMv = selectedTargets.get(`${r}_${c}`);
                    const isLast =
                      (game.lastMove?.fr === r && game.lastMove?.fc === c) ||
                      (game.lastMove?.tr === r && game.lastMove?.tc === c);
                    const isHint =
                      (hintMove?.fr === r && hintMove?.fc === c) ||
                      (hintMove?.tr === r && hintMove?.tc === c);
                    const sqStr = sqName(r, c);
                    const isLessonTarget =
                      expectedLessonStep &&
                      (expectedLessonStep.from === sqStr || expectedLessonStep.to === sqStr);
                    const isKingCheck = p?.t === 'k' && p.c === game.turn && inCheckNow;

                    return (
                      <button
                        key={`${r}_${c}`}
                        type="button"
                        onClick={() => handleSquareClick(r, c)}
                        className={`relative flex items-center justify-center select-none transition-colors ${
                          isKingCheck
                            ? 'bg-rose-600/80'
                            : isSelected
                            ? 'bg-amber-400/75'
                            : isLessonTarget
                            ? 'bg-emerald-500/45 ring-2 ring-inset ring-emerald-300'
                            : isHint
                            ? 'bg-sky-500/50'
                            : isLast
                            ? isLight
                              ? 'bg-[#cbd5a0]'
                              : 'bg-[#698755]'
                            : isLight
                            ? 'bg-[#cbd5e1] hover:bg-[#dbe4ef]'
                            : 'bg-[#475569] hover:bg-[#52627a]'
                        }`}
                      >
                        {/* Coordinates on board edge */}
                        {c === displayCols[0] && (
                          <span
                            className={`absolute top-0.5 left-1 text-[9px] font-mono font-bold ${
                              isLight ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            {8 - r}
                          </span>
                        )}
                        {r === displayRows[7] && (
                          <span
                            className={`absolute bottom-0.5 right-1 text-[9px] font-mono font-bold ${
                              isLight ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            {FILES[c]}
                          </span>
                        )}

                        {/* Legal move dot / capture ring */}
                        {targetMv && !p && (
                          <span className="w-3 h-3 rounded-full bg-slate-900/45 pointer-events-none" />
                        )}
                        {targetMv && p && (
                          <span className="absolute inset-1 rounded-full border-[3px] border-rose-500/80 pointer-events-none" />
                        )}

                        {p && (
                          <span
                            style={{
                              transform: view3D ? 'rotateX(-14deg) translateY(-2px)' : 'none',
                              textShadow:
                                p.c === 'w'
                                  ? '0 2px 3px rgba(15,23,42,0.85), 0 0 1px #000'
                                  : '0 2px 3px rgba(255,255,255,0.35)',
                            }}
                            className={`text-2xl sm:text-3xl leading-none transition-transform ${
                              p.c === 'w' ? 'text-white' : 'text-slate-950'
                            }`}
                          >
                            {PIECE_GLYPHS[`${p.c}${p.t}`]}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls, Academy Coach & Move History */}
        <div className="lg:col-span-5 space-y-3.5">
          {section === 'play' && (
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3">
              <div className="text-xs font-bold text-slate-200">Соперник и уровень игры:</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: 'ai1', label: '🤖 ИИ Новичок (800)' },
                  { id: 'ai2', label: '🧠 ИИ Клубный (1350)' },
                  { id: 'ai3', label: '⚡ ИИ Мастер (1750)' },
                  { id: 'human', label: '👥 Вдвоём на экране' },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOpponent(o.id as any);
                      resetToMode('play');
                    }}
                    className={`p-2 rounded-xl border font-semibold text-left transition ${
                      opponent === o.id
                        ? 'bg-indigo-500/25 border-indigo-400 text-white'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={undoMove}
                  disabled={!prevStack.length}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Отменить ход
                </button>
                <button
                  type="button"
                  onClick={askEngineHint}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-semibold text-amber-200 flex items-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Подсказка
                </button>
                <button
                  type="button"
                  onClick={() => resetToMode('play')}
                  className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-xs font-semibold text-indigo-200 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Новая партия
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Запись ходов партии:</div>
                <div className="text-xs font-mono text-slate-200 max-h-32 overflow-y-auto leading-relaxed">
                  {game.history.length === 0
                    ? 'Сделайте первый ход белыми (например e2 → e4)'
                    : game.history
                        .reduce((acc: string[], mv, idx) => {
                          if (idx % 2 === 0) acc.push(`${Math.floor(idx / 2) + 1}. ${mv}`);
                          else acc[acc.length - 1] += ` ${mv}`;
                          return acc;
                        }, [])
                        .join('   ')}
                </div>
              </div>
            </div>
          )}

          {section === 'openings' && (
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-400/30 space-y-3">
              <div className="text-xs font-bold text-amber-200">Выберите дебют для изучения на доске:</div>
              <div className="space-y-1.5">
                {OPENING_LESSONS.map((les, idx) => (
                  <button
                    key={les.id}
                    type="button"
                    onClick={() => resetToMode('openings', idx)}
                    className={`w-full p-2.5 rounded-xl border text-left transition ${
                      lessonIdx === idx
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{les.title}</span>
                      <span className="font-mono text-[10px] text-amber-300">{les.eco}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2 text-xs">
                <div className="text-slate-300 leading-relaxed">{currentLesson.summary}</div>
                {expectedLessonStep ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-200">
                    <b>Шаг {stepIdx + 1}/{currentLesson.steps.length}:</b> сделайте на доске подсвеченный ход{' '}
                    <span className="font-mono font-bold text-white">
                      {expectedLessonStep.from} → {expectedLessonStep.to}
                    </span>
                    <div className="text-[11px] text-slate-200 mt-1">{expectedLessonStep.comment}</div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-100 font-semibold">
                    🎓 Дебют полностью разыгран и изучен! Выберите следующий урок или повторите заново.
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'puzzles' && (
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-400/30 space-y-3">
              <div className="text-xs font-bold text-emerald-200">Тактический тренажёр (ход белых):</div>
              <div className="grid grid-cols-1 gap-1.5">
                {CLEAN_TACTICS.map((pz, idx) => (
                  <button
                    key={pz.id}
                    type="button"
                    onClick={() => resetToMode('puzzles', idx)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      puzzleIdx === idx
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{pz.title}</div>
                    <div className="text-[10px] text-emerald-300">{pz.theme}</div>
                  </button>
                ))}
              </div>

              {puzzleSolved ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 space-y-2 text-xs">
                  <div className="font-bold text-emerald-200 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-300" /> Верно!
                  </div>
                  <p className="text-slate-200 leading-relaxed">{currentPuzzle.explanation}</p>
                  <button
                    type="button"
                    onClick={() => resetToMode('puzzles', (puzzleIdx + 1) % CLEAN_TACTICS.length)}
                    className="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                  >
                    Следующая задача →
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
                  Найдите сильнейший тактический ход за белых прямо на доске.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
