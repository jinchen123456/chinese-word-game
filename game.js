const GLOBAL_TIME = 60;
const PER_Q_TIME  = 10;

const BOSS_MIN = 1000;

const LEVELS = [
  { min: 0,        title: '實習校稿員',    icon: '📝', boss: false },
  { min: 150,      title: '特約校稿',      icon: '✏️', boss: false },
  { min: 400,      title: '資深編輯',      icon: '📋', boss: false },
  { min: 750,      title: '校稿主編',      icon: '🏅', boss: false },
  { min: BOSS_MIN, title: '金牌主編挑戰賽', icon: '🥇', boss: true  },
];

function getLevel(score) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (score >= l.min) lv = l; }
  return lv;
}

function heartDisplay(hearts, max) {
  return '❤️'.repeat(hearts) + '🖤'.repeat(max - hearts);
}

let state = {};
let globalSeenIds = new Set();

// ─── helpers ──────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function el(id) { return document.getElementById(id); }

// ─── question picking ──────────────────────────────────

function pickQuestion() {
  const isBossLevel = state.score >= BOSS_MIN;

  if (isBossLevel) {
    const bossPool = questions.filter(q => q.type === 'boss' && !globalSeenIds.has(q.id));
    if (bossPool.length > 0)
      return bossPool[Math.floor(Math.random() * bossPool.length)];
    // boss pool exhausted — reset boss seen IDs and retry
    questions.filter(q => q.type === 'boss').forEach(q => globalSeenIds.delete(q.id));
    const all = questions.filter(q => q.type === 'boss');
    return all[Math.floor(Math.random() * all.length)];
  }

  for (const d of [3, 2, 1]) {
    const pool = questions.filter(q =>
      q.type === 'errorchar' && q.difficulty === d && !globalSeenIds.has(q.id)
    );
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  globalSeenIds.clear();
  const all = questions.filter(q => q.type === 'errorchar');
  return all[Math.floor(Math.random() * all.length)];
}

// ─── init ─────────────────────────────────────────────

function initState() {
  clearInterval(state.globalInterval);
  clearInterval(state.perQInterval);
  clearTimeout(state.nextTimeout);
  state = {
    hearts: 3, maxHearts: 3,
    score: 0,
    globalTimeLeft: GLOBAL_TIME,
    answered: 0, correct: 0,
    globalInterval: null, perQInterval: null, nextTimeout: null,
    isAnswered: false, gameOver: false,
    perQTimeLeft: PER_Q_TIME,
    selectedTiles: new Set(),
  };
}

// ─── score / rank display ──────────────────────────────

function updateScoreDisplay() {
  el('score-display').textContent = state.score;
  el('rank-display').textContent  = getLevel(state.score).title;
}

function checkLevelUp(prevScore, newScore) {
  const prev = getLevel(prevScore);
  const curr = getLevel(newScore);
  if (curr.min > prev.min) floatLevelUp(curr.title);
}

// ─── start ────────────────────────────────────────────

function startGame() {
  showScreen('screen-game');
  el('global-timer').textContent = state.globalTimeLeft;
  el('global-timer').classList.remove('urgent');
  updateScoreDisplay();
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

  const q = pickQuestion();
  globalSeenIds.add(q.id);
  state.isAnswered = false;
  state.currentQ = q;
  state.perQTimeLeft = PER_Q_TIME;
  state.selectedTiles = new Set();

  const isBoss = q.type === 'boss';
  el('question-text').textContent = isBoss ? '🥇 金牌挑戰！請找出文句中的兩個錯字：' : '請找出文句中的錯字：';
  el('explanation').style.display = 'none';
  el('char-tiles-area').style.display = 'flex';
  el('ec-hint').textContent = `含 ${q.errors.length} 個錯字，請點選後按確認`;
  el('char-confirm-btn').disabled = false;

  const tilesEl = el('char-tiles');
  tilesEl.innerHTML = '';
  [...q.sentence].forEach((ch, i) => {
    const tile = document.createElement('button');
    tile.className = 'char-tile';
    tile.textContent = ch;
    tile.dataset.idx = i;
    tile.addEventListener('click', () => {
      if (state.isAnswered) return;
      if (state.selectedTiles.has(i)) {
        state.selectedTiles.delete(i);
        tile.classList.remove('selected');
      } else {
        state.selectedTiles.add(i);
        tile.classList.add('selected');
      }
    });
    tilesEl.appendChild(tile);
  });

  startPerQTimer();
}

function startPerQTimer() {
  clearInterval(state.perQInterval);
  state.perQTimeLeft = PER_Q_TIME;
  const bar = el('per-q-bar');
  bar.style.width = '100%';
  bar.className = 'per-q-bar';

  state.perQInterval = setInterval(() => {
    if (state.gameOver) return;
    state.perQTimeLeft -= 0.1;
    const pct = Math.max(0, (state.perQTimeLeft / PER_Q_TIME) * 100);
    bar.style.width = pct + '%';
    if (pct <= 40) bar.classList.add('low');
    if (state.perQTimeLeft <= 0) {
      clearInterval(state.perQInterval);
      if (!state.isAnswered) onTimeout(state.currentQ);
    }
  }, 100);
}

// ─── answer logic ─────────────────────────────────────

function submitErrorChar() {
  const q = state.currentQ;
  if (state.isAnswered || state.gameOver) return;
  state.isAnswered = true;
  clearInterval(state.perQInterval);
  state.answered++;
  el('char-confirm-btn').disabled = true;

  const errorSet = new Set(q.errors);
  const selected = state.selectedTiles;
  const isCorrect =
    selected.size === errorSet.size &&
    [...selected].every(i => errorSet.has(i));

  document.querySelectorAll('.char-tile').forEach(tile => {
    const i = parseInt(tile.dataset.idx);
    tile.disabled = true;
    if (errorSet.has(i) && selected.has(i))
      tile.classList.add('tile-correct');
    else if (!errorSet.has(i) && selected.has(i)) {
      tile.classList.remove('selected');
      tile.classList.add('tile-wrong');
    } else if (errorSet.has(i) && !selected.has(i))
      tile.classList.add('tile-missed');
  });

  if (isCorrect) {
    state.correct++;
    const base = Math.max(10, Math.round(100 * state.perQTimeLeft / PER_Q_TIME));
    const pts = state.currentQ.type === 'boss' ? base * 2 : base;
    const prevScore = state.score;
    state.score += pts;
    checkLevelUp(prevScore, state.score);
    updateScoreDisplay();
    floatScore('+' + pts);
    sounds.correct();
  } else {
    sounds.wrong();
    loseHeart();
    if (state.hearts <= 0) {
      showExplanation(q);
      state.nextTimeout = setTimeout(() => endGame('hearts'), 2000);
      return;
    }
  }

  showExplanation(q);
  state.nextTimeout = setTimeout(() => loadQuestion(), 2500);
}

function onTimeout(q) {
  if (state.isAnswered || state.gameOver) return;
  state.isAnswered = true;
  state.answered++;
  el('char-confirm-btn').disabled = true;

  const errorSet = new Set(q.errors);
  document.querySelectorAll('.char-tile').forEach(tile => {
    tile.disabled = true;
    if (errorSet.has(parseInt(tile.dataset.idx))) tile.classList.add('tile-missed');
  });

  sounds.qTimeout();
  loseHeart();
  showExplanation(q);

  if (state.hearts <= 0) {
    state.nextTimeout = setTimeout(() => endGame('hearts'), 2000);
    return;
  }
  state.nextTimeout = setTimeout(() => loadQuestion(), 2500);
}

function loseHeart() {
  state.hearts = Math.max(0, state.hearts - 1);
  el('hearts-display').textContent = heartDisplay(state.hearts, state.maxHearts);
}

function showExplanation(q) {
  const correctAnswer = q.errors.map((idx, j) =>
    `「${q.sentence[idx]}」→「${q.corrections[j]}」`
  ).join('、');
  el('answer-display').textContent = correctAnswer;
  el('explanation-text').textContent = q.explanation;
  el('explanation').style.display = 'block';
}

// ─── floating effects ──────────────────────────────────

function floatScore(text) {
  const node = document.createElement('div');
  node.className = 'float-score';
  node.textContent = text;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 900);
}

function floatLevelUp(title) {
  const node = document.createElement('div');
  node.className = 'float-level-up';
  node.textContent = '升職！' + title;
  document.body.appendChild(node);
  if (sounds.levelUp) sounds.levelUp();
  setTimeout(() => node.remove(), 1800);
}

// ─── leaderboard ──────────────────────────────────────

const LB_KEY = '客座編輯室_scores';
const RANK_MEDAL = ['🥇', '🥈', '🥉'];

function loadScores() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
  catch { return []; }
}

function recordDailyStreak() {
  const STREAK_KEY = 'cw_charger_streak';
  const PLAYED_KEY = 'cw_played_today';
  const today = new Date().toLocaleDateString('zh-TW');
  try {
    // streak
    const s = JSON.parse(localStorage.getItem(STREAK_KEY)) || { days: 0, lastDate: '' };
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('zh-TW');
    if (s.lastDate !== today) {
      s.days = s.lastDate === yesterday ? s.days + 1 : 1;
      s.lastDate = today;
      localStorage.setItem(STREAK_KEY, JSON.stringify(s));
    }
    // record which game was played today (for energy board)
    const played = JSON.parse(localStorage.getItem(PLAYED_KEY)) || {};
    if (!played[today]) played[today] = {};
    played[today].proofreading = true;
    localStorage.setItem(PLAYED_KEY, JSON.stringify(played));
  } catch {}
}

function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
}

function isNewRecord(score) {
  const prev = loadScores();
  return prev.length === 0 || score > prev[0].score;
}

function renderLeaderboard() {
  const scores = loadScores();
  const list  = el('lb-list');
  const empty = el('lb-empty');
  if (scores.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = scores.map((s, i) => {
    const rank = i < 3 ? RANK_MEDAL[i] : `<span class="rank-num">${i + 1}</span>`;
    const acc  = s.accuracy != null ? s.accuracy + '%' : '-';
    return `
      <div class="lb-row ${i === 0 ? 'lb-top' : ''}">
        <div class="lb-rank">${rank}</div>
        <div class="lb-score">${s.score}<span class="lb-unit">分</span></div>
        <div class="lb-meta">
          <span class="lb-title-tag">${s.rankTitle || ''}</span>
          <span class="lb-correct">答對 ${s.correct ?? '-'} 題</span>
          <span class="lb-acc">正確率 ${acc}</span>
          <span class="lb-date">${s.date || ''}</span>
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

  const finalLevel = getLevel(state.score);
  el('end-icon').textContent   = reason === 'timeout' ? '⏰' : '💔';
  el('end-title').textContent  = reason === 'timeout' ? '截稿時間到！' : '校對失誤！';
  el('final-score').textContent = state.score;
  el('stat-correct').textContent = state.correct;
  el('stat-total').textContent   = state.answered;
  el('end-rank').textContent = finalLevel.title;

  el('rank-ladder').innerHTML = LEVELS.slice().reverse().map(lv => {
    const isCurrent  = lv.min === finalLevel.min;
    const isAchieved = state.score >= lv.min;
    const bossExtra  = lv.boss ? ' rl-boss' : '';
    const cls = isCurrent
      ? `rl-row rl-current${bossExtra}`
      : isAchieved ? `rl-row rl-achieved${bossExtra}` : `rl-row${bossExtra}`;
    const right = isCurrent
      ? `<span class="rl-here">← 你在這裡</span>`
      : `<span class="rl-min">${lv.min} 分</span>`;
    const badge = lv.boss ? `<span class="rl-boss-tag">雙錯字</span>` : '';
    return `<div class="${cls}">
      <span class="rl-icon">${lv.icon}</span>
      <span class="rl-title">${lv.title}${badge}</span>
      ${right}
    </div>`;
  }).join('');

  const acc = state.answered
    ? Math.round(state.correct / state.answered * 100)
    : 0;
  el('stat-acc').textContent = acc + '%';

  recordDailyStreak();
  const isRecord = isNewRecord(state.score);
  const today = new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  saveScore({
    score: state.score, correct: state.correct,
    answered: state.answered, accuracy: acc,
    date: today, rankTitle: finalLevel.title,
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

el('start-btn').addEventListener('click', () => { initState(); startGame(); });
el('replay-btn').addEventListener('click', () => { initState(); startGame(); });
el('home-btn').addEventListener('click', () => { window.location.href = 'index.html'; });

el('lb-open-btn').addEventListener('click', () => { renderLeaderboard(); showScreen('screen-lb'); });
el('end-lb-btn').addEventListener('click',  () => { renderLeaderboard(); showScreen('screen-lb'); });
el('lb-back-btn').addEventListener('click', () => showScreen('screen-start'));

el('lb-clear-btn').addEventListener('click', () => {
  if (confirm('確定要清除所有排行榜紀錄嗎？')) {
    localStorage.removeItem(LB_KEY);
    renderLeaderboard();
  }
});

el('char-confirm-btn').addEventListener('click', submitErrorChar);
