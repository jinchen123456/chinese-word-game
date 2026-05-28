const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _ctx = null;

function ac() {
  if (!_ctx) _ctx = new AudioCtx();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function note(freq, start, dur, vol = 0.22, type = 'sine', endFreq) {
  const c = ac();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq != null) osc.frequency.linearRampToValueAtTime(endFreq, start + dur);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

const sounds = {
  // 答對：上升四音，清脆歡快
  correct() {
    const t = ac().currentTime;
    note(523,  t,       0.08, 0.20);   // C5
    note(659,  t+0.09,  0.08, 0.20);   // E5
    note(784,  t+0.18,  0.12, 0.22);   // G5
    note(1047, t+0.30,  0.22, 0.18);   // C6
  },

  // 答錯：卡通下滑 wah wah
  wrong() {
    const t = ac().currentTime;
    note(280, t,       0.14, 0.28, 'sawtooth', 200);
    note(210, t+0.16,  0.20, 0.22, 'sawtooth', 150);
  },

  // 每題超時：短促電子嗶聲
  qTimeout() {
    const t = ac().currentTime;
    note(420, t,       0.07, 0.22, 'square');
    note(320, t+0.09,  0.14, 0.18, 'square');
  },

  // 最後 10 秒每秒 tick
  tick() {
    const t = ac().currentTime;
    note(1400, t, 0.035, 0.14, 'sine');
  },

  // 遊戲開始：上升小號角
  start() {
    const t = ac().currentTime;
    [392, 523, 659, 784].forEach((f, i) => note(f, t + i * 0.09, 0.11, 0.18));
  },

  // 新紀錄：生日快樂前四音，俏皮版
  newRecord() {
    const t = ac().currentTime;
    const melody = [523, 523, 587, 523, 698, 659];
    const beats  = [0, 0.16, 0.32, 0.48, 0.64, 0.82];
    melody.forEach((f, i) => note(f, t + beats[i], 0.14, 0.24));
  },

  // 時間到：三音收尾
  timesUp() {
    const t = ac().currentTime;
    note(523, t,       0.18, 0.22);
    note(494, t+0.20,  0.18, 0.22);
    note(440, t+0.40,  0.45, 0.26);
  },

  // 心歸零：下沉四音，哀傷
  gameOver() {
    const t = ac().currentTime;
    [392, 370, 330, 294].forEach((f, i) => note(f, t + i * 0.22, 0.24, 0.20));
  },
};
