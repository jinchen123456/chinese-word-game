# 截稿倒數60秒 — 技術規格文件

> 最後更新：2026-06-22  
> GitHub：`jinchen123456/chinese-word-game`

---

## 一、專案概覽

| 項目 | 內容 |
|---|---|
| 遊戲類型 | 純前端靜態網頁，零後端 |
| 核心玩法 | 60 秒內找出文句中的錯別字，累積分數晉升職位 |
| 目標裝置 | 手機優先（max-width 480px），桌機亦可 |
| 語言 | HTML / CSS / JavaScript（無框架、無 npm） |
| 資料儲存 | `localStorage`（排行榜） |

---

## 二、檔案結構

```
chinese-word-game/
├── index.html      # 畫面結構（4 個 screen）
├── style.css       # 全站樣式
├── game.js         # 遊戲邏輯、分級、計時、排行榜
├── questions.js    # 題庫（785 題，陣列格式）
└── sounds.js       # 音效（Web Audio API，無外部資源）
```

---

## 三、遊戲流程

```
開始畫面 → 遊戲畫面（60秒倒數）→ 結算畫面 → 排行榜
               ↑                        |
               └─────── 再玩一次 ────────┘
```

**失敗條件**
- 全域計時器歸零（截稿時間到）
- 答錯 3 次扣完所有愛心（校對失誤）

**單題計時**
- 每題 10 秒，超時或答錯皆扣 1 顆心
- 得分 = `max(10, round(100 × 剩餘時間 / 10))`（魔王題 ×2）

---

## 四、題庫格式（questions.js）

所有題目放在全域陣列 `const questions = [ ... ]`。

### 4-1 普通題（type: 'errorchar'）

```js
{
  id: 'ec-001',          // 唯一 ID，格式自訂，不可重複
  type: 'errorchar',
  difficulty: 2,         // 1（易）/ 2（中）/ 3（難）
  sentence: '他莫明其妙地離開了',
  errors: [2],           // 錯字在 sentence 中的字元索引（0-based）
  corrections: ['名'],   // 對應正確字，與 errors 順序一致
  explanation: '「莫名其妙」的「名」常誤寫為「明」。'
}
```

**索引計算方式**：`sentence` 以「每個中文字/符號 = 1 個字元」計算。

```
他 莫 明 其 妙 地 離 開 了
0  1  2  3  4  5  6  7  8
         ↑
      errors:[2]
```

### 4-2 魔王題（type: 'boss'）

```js
{
  id: 'boss-001',
  type: 'boss',
  difficulty: 3,
  sentence: '他莫明其妙，按步就班地完成工作',
  errors: [2, 7],                  // 兩個錯字的索引
  corrections: ['名', '部'],       // 兩個對應正確字
  explanation: '「莫名其妙」的「名」常誤寫為「明」；「按部就班」的「部」常誤寫為「步」。'
}
```

### 4-3 目前題庫統計

| 類型 | 數量 |
|---|---|
| 普通題（errorchar） | 647 題 |
| 魔王題（boss） | 138 題 |
| **合計** | **785 題** |

---

## 五、分級系統（game.js）

```js
const BOSS_MIN = 1000;   // 達到此分數切換魔王題

const LEVELS = [
  { min: 0,    title: '實習校稿員',    icon: '📝', boss: false },
  { min: 150,  title: '特約校稿',      icon: '✏️', boss: false },
  { min: 400,  title: '資深編輯',      icon: '📋', boss: false },
  { min: 750,  title: '校稿主編',      icon: '🏅', boss: false },
  { min: 1000, title: '金牌主編挑戰賽', icon: '🥇', boss: true  },
];
```

- 分數 ≥ 1000 時，`pickQuestion()` 自動改出 `type:'boss'` 題
- 魔王題答對得 **雙倍分數**（最高 200 分）

---

## 六、新增題目的方法

### 方法 A：直接編輯 questions.js

在陣列最後、`];` 之前加入新物件：

```js
  { id: 'new-300', type: 'errorchar', difficulty: 2,
    sentence: '他再接再勵，終於成功',
    errors: [5], corrections: ['厲'],
    explanation: '「再接再厲」的「厲」常誤寫為「勵」，兩字音同義異。' },
```

**注意事項**
1. `id` 必須唯一，建議用流水號命名
2. `errors` 索引從 0 開始，標點符號也算 1 個字元
3. `corrections[i]` 對應 `errors[i]`，順序不可錯
4. 新增後本地開啟 `index.html` 測試，確認無 JS 錯誤

### 方法 B：Python 批次產生（適合大量新增）

參考 `/tmp/gen_boss.py` 的結構，定義正確詞語 + 錯字 + 位置，腳本自動計算索引並輸出 JS 格式。

---

## 七、關鍵函式說明

| 函式 | 位置 | 說明 |
|---|---|---|
| `pickQuestion()` | game.js:35 | 依分數決定出普通題或魔王題 |
| `loadQuestion()` | game.js:116 | 渲染題目字磚、重置計時條 |
| `submitErrorChar()` | game.js:165 | 判斷答題對錯、給分、扣心 |
| `onTimeout()` | game.js:214 | 單題超時處理 |
| `endGame(reason)` | game.js:331 | 結算、存排行榜、顯示職位階梯 |
| `getLevel(score)` | game.js:11 | 依分數回傳對應職位物件 |
| `renderLeaderboard()` | game.js:292 | 從 localStorage 渲染排行榜 |

---

## 八、音效（sounds.js）

使用 Web Audio API 即時合成，**不需要任何音效檔案**。

| 事件 | 呼叫 |
|---|---|
| 遊戲開始 | `sounds.start()` |
| 答對 | `sounds.correct()` |
| 答錯 | `sounds.wrong()` |
| 單題超時 | `sounds.qTimeout()` |
| 全域計時最後 10 秒 | `sounds.tick()` |
| 升職 | `sounds.levelUp()` |
| 時間到結束 | `sounds.timesUp()` |
| 遊戲結束（扣心） | `sounds.gameOver()` |
| 新紀錄 | `sounds.newRecord()` |

---

## 九、部署方式

**Netlify 自動部署（已設定）**

1. 修改任意檔案
2. `git add . && git commit -m "說明" && git push`
3. Netlify 偵測到 push 後約 60 秒自動更新網站

---

## 十、優化建議清單

### 題庫
- [ ] 題目分類標籤（如：成語、新聞用語、公文用語），未來可依類別出題
- [ ] 建立 Google Sheet 題庫，透過 CSV API 動態載入，讓非技術同事直接填題
- [ ] 增加題目難度 4（魔王題進階：3 個錯字）

### 遊戲機制
- [ ] 連續答對獎勵（Combo 加分）
- [ ] 「救援道具」系統（如：跳過、加時、提示）
- [ ] 每日挑戰模式（固定題組，可比較同事分數）
- [ ] 多人同步競賽模式（需後端或 WebSocket）

### 使用者體驗
- [ ] 記錄歷史答錯題目，遊戲結束後顯示複習清單
- [ ] 答題後顯示正確字的字形對比（錯字 vs 正確字放大顯示）
- [ ] 支援鍵盤操作（數字鍵選字、Enter 確認）
- [ ] 加入 Open Graph meta tag，分享連結時顯示預覽圖

### 技術債
- [ ] 題庫拆分為多個 JS 檔案（目前單檔 2700+ 行）
- [ ] 加入題目驗證腳本，CI 階段自動檢查新題目格式正確性
