const GLOBAL_TIME = 60;
const TYPE_LABEL = { pronunciation: '字音', form: '字形', truefalse: '辨別正誤' };

const DIFF_SETTINGS = {
  1: { perQTime: 12, hearts: 3 },
  2: { perQTime: 10, hearts: 3 },
  3: { perQTime:  8, hearts: 2 },
};

function heartDisplay(hearts, max) {
  return '❤️'.repeat(hearts) + '🖤'.repeat(max - hearts);
}

let state = {};
let selectedDifficulty = 1;
let lastRoundIds = new Set();

// ─── helpers ──────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function el(id) { return document.getElementById(id); }

// ─── init ─────────────────────────────────────────────

function buildQueue(difficulty) {
  const pool = questions.filter(q => q.difficulty === difficulty);
  const fresh = shuffle(pool.filter(q => !lastRoundIds.has(q.id)));
  const seen  = shuffle(pool.filter(q =>  lastRoundIds.has(q.id)));
  return [...fresh, ...seen];
}

function initState(difficulty) {
  clearInterval(state.globalInterval);
  clearInterval(state.perQInterval);
  lastRoundIds = state.seenIds || new Set();
  const s = DIFF_SETTINGS[difficulty];
  state = {
    difficulty,
    hearts: s.hearts,
    maxHearts: s.hearts,
    perQTime: s.perQTime,
    score: 0,
    globalTimeLeft: GLOBAL_TIME,
    perQTimeLeft: s.perQTime,
    answered: 0,
    correct: 0,
    seenIds: new Set(),
    queue: buildQueue(difficulty),
    qIndex: 0,
    globalInterval: null,
    perQInterval: null,
    isAnswered: false,
    gameOver: false,
  };
}

// ─── start ────────────────────────────────────────────

function startGame() {
  showScreen('screen-game');
  el('global-timer').textContent = state.globalTimeLeft;
  el('global-timer').classList.remove('urgent');
  el('score-display').textContent = '0';
  el('hearts-display').textContent = heartDisplay(state.hearts, state.maxHearts);
  sounds.start();

  state.globalInterval = setInterval(() => {
    if (state.gameOver) return;
    state.globalTimeLeft--;
    el('global-timer').textContent = state.globalTimeLeft;
    if (state.globalTimeLeft <= 10) {
      el('global-timer').classList.add('urgent');
      sounds.tick();
    }
    if (state.globalTimeLeft <= 0) endGame('timeout');
  }, 1000);

  loadQuestion();
}

// ─── question ─────────────────────────────────────────

function loadQuestion() {
  if (state.gameOver) return;

  if (state.qIndex >= state.queue.length) {
    state.queue = buildQueue(state.difficulty);
    state.qIndex = 0;
  }

  const q = state.queue[state.qIndex++];
  state.seenIds.add(q.id);
  state.isAnswered = false;
  state.currentQ = q;

  el('question-type-badge').textContent = TYPE_LABEL[q.type];
  el('question-text').textContent = q.question;
  el('explanation').style.display = 'none';

  const grid = el('options-grid');
  grid.innerHTML = '';
  grid.className = 'options-grid' + (q.type === 'truefalse' ? ' two-col' : '');

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => pick(i, q));
    grid.appendChild(btn);
  });

  startPerQTimer(q);
}

function startPerQTimer(q) {
  clearInterval(state.perQInterval);
  state.perQTimeLeft = state.perQTime;

  const bar = el('per-q-bar');
  bar.style.width = '100%';
  bar.className = 'per-q-bar';

  state.perQInterval = setInterval(() => {
    if (state.gameOver) return;
    state.perQTimeLeft -= 0.1;
    const pct = Math.max(0, (state.perQTimeLeft / state.perQTime) * 100);
    bar.style.width = pct + '%';
    if (pct <= 30) bar.classList.add('low');
    if (state.perQTimeLeft <= 0) {
      clearInterval(state.perQInterval);
      if (!state.isAnswered) onTimeout(q);
    }
  }, 100);
}

// ─── answer logic ─────────────────────────────────────

function pick(idx, q) {
  if (state.isAnswered || state.gameOver) return;
  state.isAnswered = true;
  clearInterval(state.perQInterval);
  state.answered++;

  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);
  btns[q.answer].classList.add('reveal');

  const isCorrect = idx === q.answer;
  if (!isCorrect) btns[idx].classList.add('wrong');

  if (isCorrect) {
    state.correct++;
    const pts = Math.max(10, Math.round(100 * state.perQTimeLeft / state.perQTime));
    state.score += pts;
    el('score-display').textContent = state.score;
    floatScore('+' + pts);
    sounds.correct();
  } else {
    sounds.wrong();
    loseHeart();
    if (state.hearts <= 0) {
      showExplanation(q);
      setTimeout(() => endGame('hearts'), 1600);
      return;
    }
  }

  showExplanation(q);
  setTimeout(() => loadQuestion(), 1800);
}

function onTimeout(q) {
  if (state.isAnswered || state.gameOver) return;
  state.isAnswered = true;
  state.answered++;

  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);
  btns[q.answer].classList.add('reveal');

  sounds.qTimeout();
  loseHeart();
  showExplanation(q);

  if (state.hearts <= 0) {
    setTimeout(() => endGame('hearts'), 1600);
    return;
  }
  setTimeout(() => loadQuestion(), 1800);
}

function loseHeart() {
  state.hearts = Math.max(0, state.hearts - 1);
  el('hearts-display').textContent = heartDisplay(state.hearts, state.maxHearts);
}

function showExplanation(q) {
  el('answer-display').textContent = q.options[q.answer];
  el('explanation-text').textContent = q.explanation;
  el('explanation').style.display = 'block';
}

function floatScore(text) {
  const node = document.createElement('div');
  node.className = 'float-score';
  node.textContent = text;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 900);
}

// ─── leaderboard ──────────────────────────────────────

const LB_KEY = '字音字形_scores';
const DIFF_LABEL = { 1: '易', 2: '中', 3: '難' };
const RANK_MEDAL = ['🥇', '🥈', '🥉'];

function loadScores() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
  catch { return []; }
}

function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, 10);
  localStorage.setItem(LB_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function isNewRecord(score, difficulty) {
  const prev = loadScores().filter(s => s.difficulty === difficulty);
  return prev.length === 0 || score > prev[0].score;
}

function renderLeaderboard() {
  const scores = loadScores();
  const list  = el('lb-list');
  const empty = el('lb-empty');

  if (scores.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = scores.map((s, i) => {
    const rank    = i < 3 ? RANK_MEDAL[i] : `<span class="rank-num">${i + 1}</span>`;
    const diff    = DIFF_LABEL[s.difficulty] || '？';
    const date    = s.date || '';
    const acc     = s.accuracy != null ? s.accuracy + '%' : '-';
    return `
      <div class="lb-row ${i === 0 ? 'lb-top' : ''}">
        <div class="lb-rank">${rank}</div>
        <div class="lb-score">${s.score}<span class="lb-unit">分</span></div>
        <div class="lb-meta">
          <span class="lb-diff diff-${s.difficulty}">${diff}</span>
          <span class="lb-acc">正確率 ${acc}</span>
          <span class="lb-date">${date}</span>
        </div>
      </div>`;
  }).join('');
}

// ─── end ──────────────────────────────────────────────

function endGame(reason) {
  if (state.gameOver) return;
  state.gameOver = true;
  clearInterval(state.globalInterval);
  clearInterval(state.perQInterval);

  el('end-icon').textContent  = reason === 'timeout' ? '⏰' : '💔';
  el('end-title').textContent = reason === 'timeout' ? '時間到！' : '挑戰失敗';
  el('final-score').textContent = state.score;
  el('stat-correct').textContent = state.correct;
  el('stat-total').textContent   = state.answered;
  const acc = state.answered
    ? Math.round(state.correct / state.answered * 100)
    : 0;
  el('stat-acc').textContent = acc + '%';

  // 儲存並判斷是否新紀錄
  const isRecord = isNewRecord(state.score, state.difficulty);
  const today = new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  saveScore({
    score: state.score,
    difficulty: state.difficulty,
    correct: state.correct,
    answered: state.answered,
    accuracy: acc,
    date: today,
  });

  if (isRecord && state.score > 0) {
    el('new-record').style.display = 'block';
    sounds.newRecord();
  } else {
    el('new-record').style.display = 'none';
    reason === 'timeout' ? sounds.timesUp() : sounds.gameOver();
  }

  showScreen('screen-end');
}

// ─── event wiring ─────────────────────────────────────

function updateDiffDisplay(difficulty) {
  const s = DIFF_SETTINGS[difficulty];
  el('rule-hearts').textContent = s.hearts + ' 顆心';
  el('rule-per-q').textContent  = '每題 ' + s.perQTime + ' 秒';
}

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = parseInt(btn.dataset.diff);
    updateDiffDisplay(selectedDifficulty);
  });
});

el('start-btn').addEventListener('click', () => {
  initState(selectedDifficulty);
  startGame();
});

el('replay-btn').addEventListener('click', () => {
  initState(selectedDifficulty);
  startGame();
});

el('change-diff-btn').addEventListener('click', () => {
  showScreen('screen-start');
});

// 排行榜入口
el('lb-open-btn').addEventListener('click', () => {
  renderLeaderboard();
  showScreen('screen-lb');
});

el('end-lb-btn').addEventListener('click', () => {
  renderLeaderboard();
  showScreen('screen-lb');
});

el('lb-back-btn').addEventListener('click', () => {
  showScreen('screen-start');
});

el('lb-clear-btn').addEventListener('click', () => {
  if (confirm('確定要清除所有排行榜紀錄嗎？')) {
    localStorage.removeItem(LB_KEY);
    renderLeaderboard();
  }
});
