# Token 优化 + 弹幕 Fallback 设计文档

日期：2026-02-10

## 目标

1. **路线 A**：有字幕时减少 Gemini AI Token 消耗
2. **路线 B**：无字幕时用弹幕数据作为 fallback 检测广告

## 现状问题

- 有字幕时：200+ 条字幕全部发给 AI，Token 消耗大
- 无字幕时：直接放弃检测，闪一下警告动画就结束了（`subtitle.ts:62-66`）

---

## 路线 A：有字幕时的 Token 优化

### 流程

```
字幕获取完成
  ↓
① 本地正则预筛（内置规则 + 自学习规则）
  ├─ 命中 → 直接定位广告时间段，零 Token
  └─ 未命中 ↓
② 字幕压缩（合并相邻字幕、去语气词）
  ↓
③ 压缩后的字幕发给 AI 检测
  ├─ 无广告 → 结束
  └─ 有广告 → 返回时间段 + 广告商关键词
       ↓
④ 自学习：将 AI 提取的关键词存入本地正则库
```

### ① 本地正则预筛

扫描所有字幕文本，用内置 + 自学习正则规则匹配。

**内置规则（初始集）：**

```typescript
const AD_KEYWORD_PATTERNS = [
  /[硬软推]广/,
  /广[告子]/,
  /恰饭/,
  /恰烂钱/,
  /感谢.*赞助/,
  /本期.*由/,
  /下[面个].*广告/,
  /接下来.*恰/,
];
```

- 命中 → 记录命中字幕的时间段，直接作为广告时间范围返回（或发给 AI 精确定位，只发命中附近的字幕）
- 未命中 → 进入步骤②

### ② 字幕压缩

减少发给 AI 的文本量：

1. **时间段合并**：每 30 秒的字幕合并为一段
   - 原始：`[0-2.5]:大家好;[2.5-5]:今天;[5-8]:我们来聊聊...`
   - 压缩：`[0-30s]: 大家好今天我们来聊聊...`
2. **去语气词**：过滤长度 ≤ 2 且为常见语气词的条目（"嗯"、"啊"、"那个"、"就是"）
3. **去重复**：相邻重复内容只保留一条

预计压缩率：50-70%

### ④ 自学习正则库

AI 检测到广告时，额外让它返回广告商/品牌名称。

**存储结构（chrome.storage.local）：**

```typescript
// key: AD_KEYWORD_RULES
type LearnedRule = {
  keyword: string;    // 广告商名称，如 "某某APP"
  pattern: string;    // 正则字符串，如 "某某APP|某某app"
  hitCount: number;   // 命中次数
  addedAt: number;    // 添加时间戳
};
```

**AI 响应 Schema 扩展：**

```typescript
const responseSchema = {
  type: 'OBJECT',
  properties: {
    startTime: { type: 'number', nullable: false },
    endTime: { type: 'number', nullable: false },
    advertiser: { type: 'string', nullable: true },  // 新增：广告商名称
  },
  required: ['startTime', 'endTime'],
};
```

**管理：** 用户可在 popup 页面查看和删除自学习规则。

---

## 路线 B：无字幕时的弹幕 Fallback

### 流程

```
无字幕
  ↓
① 获取弹幕（XML API）
  ├─ 无弹幕 → 闪警告动画，结束
  └─ 有弹幕 ↓
② 本地正则预筛（与路线 A 共用同一套规则库）
  ├─ 无命中 → 判定无广告，零 Token
  └─ 有命中 ↓
③ 提取命中关键词前后 30 秒时间窗口内的弹幕
  ↓
④ 发给 AI 精确定位广告起止时间 + 提取广告商关键词
  ↓
⑤ 自学习：新关键词存入本地规则库
```

### ① 弹幕获取

**API：** `https://api.bilibili.com/x/v1/dm/list.so?oid={cid}`

**cid 来源：** `window.__INITIAL_STATE__` 或已拦截的播放器 API 响应

**返回格式：** XML

```xml
<d p="120.5,1,25,16777215,1234567890,0,abc123,12345">恰饭时间</d>
```

`p` 属性各字段含义：
1. 弹幕出现时间（秒） ← 我们需要这个
2. 弹幕模式（1=滚动, 4=底部, 5=顶部）
3. 字号
4. 颜色
5. 发送时间戳
6. 弹幕池
7. 用户 hash
8. 弹幕 ID

**解析方式：** 浏览器原生 `DOMParser`

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(xmlText, 'text/xml');
const danmakuElements = doc.querySelectorAll('d');
```

### ② 本地正则预筛

与路线 A 共用同一套规则库（内置 + 自学习）。

扫描所有弹幕文本，记录命中的弹幕及其时间点。

### ③ 时间窗口提取

对每个命中的弹幕时间点，提取前后 30 秒窗口内的所有弹幕。

合并重叠窗口，去重后格式化：

```
[118s] 前面都是干货; [120s] 广告来了; [121s] 恰饭时间; [122s] 跳过跳过
```

### ④ AI 精确定位

发给 AI 的 prompt 需要针对弹幕调整：

```
以下是视频中某个时间段的弹幕（观众评论），弹幕中观众提到了广告相关内容。
请根据弹幕的时间分布和内容，判断广告的精确起止时间。
格式：[时间(秒)] 弹幕内容

------
{弹幕数据}
```

---

## 共享组件

### 自学习正则库（路线 A + B 共用）

```
chrome.storage.local
  ├─ AD_KEYWORD_RULES: LearnedRule[]     // 自学习规则
  ├─ AD_TIME_RANGE_CACHE: AdCacheEntry[] // 已有的广告时间缓存
  └─ ...其他配置
```

### 内置正则规则

```typescript
const BUILTIN_AD_PATTERNS: RegExp[] = [
  /[硬软推]广/,
  /广[告子]/,
  /恰饭/,
  /恰烂钱/,
  /感谢.*赞助/,
  /本期.*由/,
  /下[面个].*广告/,
  /接下来.*恰/,
  /跳过/,
  /广告时间/,
];
```

---

## 文件变更清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/services/danmaku.ts` | 弹幕获取与解析（XML API + DOMParser） |
| `src/services/ad-filter.ts` | 本地正则预筛 + 自学习规则管理 |
| `src/services/subtitle-compressor.ts` | 字幕压缩（合并、去语气词、去重） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/services/subtitle.ts` | `detectAdFromVideo` 中集成预筛和压缩逻辑；无字幕时调用弹幕 fallback |
| `src/ai.ts` | 响应 Schema 新增 `advertiser` 字段；新增弹幕专用 prompt |
| `src/types/index.ts` | 新增 `Danmaku`、`LearnedRule` 类型 |
| `src/constants/index.ts` | 新增内置正则规则、存储 key |
| `src/popup/App.tsx` | 新增自学习规则管理 UI（查看/删除） |

---

## Token 消耗预估

| 场景 | 现在 | 优化后 |
|------|------|--------|
| 有字幕 + 正则命中 | ~2000 tokens | 0 tokens |
| 有字幕 + 正则未命中 | ~2000 tokens | ~800 tokens（压缩后） |
| 无字幕（当前直接放弃） | 0 tokens | 0-500 tokens |
| 重复广告商（自学习命中） | ~2000 tokens | 0 tokens |
