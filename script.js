/* Caça-Palavras Minimalista
 * Requisitos atendidos:
 * - Grade 8x8 ocupando quase toda a viewport (85vmin para manter quadrado)
 * - Seleção por clique e arraste; células entram quando cursor cruza 50% da área
 * - Palavras carregadas de words-pt.txt (fetch) e colocadas em qualquer direção (8 dirs + invertidas)
 * - Palavras podem compartilhar letras (mesclagem)
 * - Seleção pode fazer curvas (palavras compostas por caminho contíguo livre)
 * - Flash < 1s nas células selecionadas
 * - Contadores e rotação 90° do tabuleiro
 */

const SIZE = 8;
const boardEl = document.getElementById('board');
const foundCountEl = document.getElementById('foundCount');
const totalCountEl = document.getElementById('totalCount');
const wordListEl = document.getElementById('wordList');
const rotateBtn = document.getElementById('rotateBtn');

let board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
let words = []; // todas as palavras carregadas
let placedWords = []; // {word, path:[{r,c}]}
let foundWords = new Set();
let rotation = 0; // graus

// Direções (8) para posicionamento linear
const DIRS = [
  [0, 1], [1, 0], [0, -1], [-1, 0], // horizontais / verticais
  [1, 1], [1, -1], [-1, 1], [-1, -1] // diagonais
];

function createCells() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r; div.dataset.c = c;
      div.textContent = board[r][c] || '';
      boardEl.appendChild(div);
    }
  }
}

async function loadWords() {
  try {
    const res = await fetch('words-pt.txt');
    const text = await res.text();
    words = text.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(Boolean).filter(w => w.length <= SIZE);
    // Embaralhar
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[words[i], words[j]] = [words[j], words[i]]; }
  } catch (e) {
    console.error('Falha ao carregar words-pt.txt', e);
  }
}

function canPlace(word, r, c, dr, dc) {
  const path = [];
  for (let i = 0; i < word.length; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return null;
    const cell = board[nr][nc];
    if (cell && cell !== word[i]) return null; // conflito
    path.push({ r: nr, c: nc });
  }
  return path;
}

function placeWords() {
  placedWords = [];
  // Tentamos colocar até caber ou até limite
  for (const word of words) {
    let placed = false; let attempts = 0;
    const options = DIRS.slice();
    while (options.length) {
      const dirIndex = Math.floor(Math.random() * options.length);
      const [dr, dc] = options.splice(dirIndex, 1)[0];
      // Tentar várias seeds
      for (let tries = 0; tries < 50 && !placed; tries++) {
        const r = Math.floor(Math.random() * SIZE);
        const c = Math.floor(Math.random() * SIZE);
        const path = canPlace(word, r, c, dr, dc);
        if (path) {
          path.forEach((p, i) => { board[p.r][p.c] = word[i]; });
          placedWords.push({ word, path });
          placed = true;
        }
      }
      if (placed) break;
    }
  }
}

function fillRandom() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) board[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
}

function refreshBoardLetters() {
  [...boardEl.children].forEach(cell => {
    const r = +cell.dataset.r, c = +cell.dataset.c;
    cell.textContent = board[r][c];
  });
}

function buildWordList() {
  wordListEl.innerHTML = '';
  const unique = [...new Set(placedWords.map(p => p.word))];
  totalCountEl.textContent = unique.length;
  unique.forEach(w => {
    const li = document.createElement('li');
    li.textContent = w; li.dataset.word = w;
    const span = document.createElement('span'); span.className = 'len'; span.textContent = w.length;
    li.appendChild(span);
    wordListEl.appendChild(li);
  });
}

// Seleção livre (caminho contíguo) com threshold 50%
let isPointerDown = false; let currentPath = []; let visitedSet = new Set();
const THRESHOLD = 0.5; // 50%

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.classList || !el.classList.contains('cell')) return null;
  return el;
}

function addCellToPath(cell) {
  const key = cell.dataset.r + ',' + cell.dataset.c;
  if (visitedSet.has(key)) return;
  // Verifica contiguidade se já existe um anterior
  if (currentPath.length) {
    const last = currentPath[currentPath.length - 1];
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (Math.abs(last.r - r) > 1 || Math.abs(last.c - c) > 1) return; // não vizinho
  }
  currentPath.push({ r: +cell.dataset.r, c: +cell.dataset.c, el: cell });
  visitedSet.add(key);
  cell.classList.add('active-path');
}

function pointerMove(e) {
  if (!isPointerDown) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  if (cx >= rect.width * THRESHOLD && cy >= rect.height * THRESHOLD ||
    cx >= rect.width * THRESHOLD && cy <= rect.height * (1 - THRESHOLD) ||
    cy >= rect.height * THRESHOLD && cx <= rect.width * (1 - THRESHOLD) ||
    (cx >= rect.width * THRESHOLD && cy >= rect.height * THRESHOLD)) {
    addCellToPath(cell);
  }
}

function evaluatePath() {
  const letters = currentPath.map(p => board[p.r][p.c]).join('');
  // Procurar se alguma palavra é subsequência contígua dentro desse caminho (como especificado: palavras podem formar curvas contíguas)
  // Estratégia: gerar todas as substrings contíguas do caminho e verificar se existem nas placedWords (por caminho exato)
  const foundThisDrag = new Set();
  for (const pw of placedWords) {
    if (foundWords.has(pw.word)) continue; // já encontrada
    // Verificar se todas as coords de pw.path aparecem na currentPath na mesma ordem
    let idx = 0;
    for (let i = 0; i < currentPath.length; i++) {
      if (currentPath[i].r === pw.path[idx].r && currentPath[i].c === pw.path[idx].c) {
        idx++;
        if (idx === pw.path.length) {
          foundThisDrag.add(pw.word);
          break;
        }
      }
    }
  }
  if (foundThisDrag.size) {
    foundThisDrag.forEach(w => {
      foundWords.add(w);
      const li = wordListEl.querySelector('li[data-word="' + w + '"]');
      if (li) li.classList.add('found');
    });
    foundCountEl.textContent = foundWords.size;
  }
  // efeito flash nas células usadas
  currentPath.forEach(p => {
    p.el.classList.remove('active-path');
    p.el.classList.add('flash');
    setTimeout(() => p.el.classList.remove('flash'), 750);
    if (foundThisDrag.size) {
      // se qualquer palavra encontrada inclui este ponto? marcar
      const involved = [...foundThisDrag].some(w => {
        const pw = placedWords.find(x => x.word === w);
        return pw.path.some(pt => pt.r === p.r && pt.c === p.c);
      });
      if (involved) p.el.classList.add('part-of-found');
    }
  });
}

function clearActivePath() {
  currentPath.forEach(p => p.el.classList.remove('active-path'));
  currentPath = []; visitedSet.clear();
}

boardEl.addEventListener('pointerdown', e => {
  if (!(e.target).classList.contains('cell')) return;
  isPointerDown = true;
  clearActivePath();
  addCellToPath(e.target);
});
window.addEventListener('pointermove', pointerMove);
window.addEventListener('pointerup', () => { if (isPointerDown) { evaluatePath(); clearActivePath(); isPointerDown = false; } });
window.addEventListener('pointerleave', () => { if (isPointerDown) { evaluatePath(); clearActivePath(); isPointerDown = false; } });

rotateBtn.addEventListener('click', () => {
  rotation = (rotation + 90) % 360;
  boardEl.style.transform = `rotate(${rotation}deg)`;
  // Rotacionar visual; letras giram junto, compensa rotação interna para manter legíveis
  [...boardEl.children].forEach(c => { c.style.transform = `rotate(${-rotation}deg)`; });
});

async function init() {
  await loadWords();
  placeWords();
  fillRandom();
  createCells();
  refreshBoardLetters();
  buildWordList();
}

init();
