type MoodDailyPromptDef = {
  question: string;
  labels: string[];
  lines: string[];
};

/** Phase 1: 日付＋ペアで決まる「今日のメモ」用の質問（ダミー AI）。 */
const MOOD_DAILY_PROMPTS: MoodDailyPromptDef[] = [
  {
    question: "いまの眠気の度合いに近いのは、どれですか。",
    labels: ["ほとんどない", "少しある", "つよい", "わからない"],
    lines: [
      "眠気はほとんど感じていません。",
      "眠気が少しあります。",
      "眠気がつよめです。",
      "眠気の度合いは、まだはっきりしません。",
    ],
  },
  {
    question: "からだの重さに近いのは、どれですか。",
    labels: ["軽め", "ふつう", "重め", "わからない"],
    lines: [
      "からだはいま、軽めに感じます。",
      "からだの重さは、ふつうです。",
      "からだはいま、重めに感じます。",
      "からだの重さは、まだわかりません。",
    ],
  },
  {
    question: "いまの気持ちの色に近いのは、どれですか。",
    labels: ["明るめ", "まざりあい", "暗め", "つかめない"],
    lines: [
      "気持ちは、明るめの色に近いです。",
      "気持ちは、明るさと暗さがまざっている感じです。",
      "気持ちは、暗めの色に近いです。",
      "気持ちの色は、いまはつかめていません。",
    ],
  },
  {
    question: "今日の予定の多さに近いのは、どれですか。",
    labels: ["すいている", "ちょうどよい", "ぎっしり", "まだわからない"],
    lines: [
      "今日の予定は、すいているほうです。",
      "今日の予定は、ちょうどよい感じです。",
      "今日の予定は、ぎっしりめです。",
      "今日の予定の多さは、まだわかりません。",
    ],
  },
  {
    question: "外の空気に触れたい気持ちに近いのは、どれですか。",
    labels: ["つよく触れたい", "少しでよい", "いまは内向き", "わからない"],
    lines: [
      "外の空気に、つよく触れたい気持ちがあります。",
      "外の空気には、少し触れたいです。",
      "いまは、内向きの気持ちに近いです。",
      "外に出たい気持ちの度合いは、まだわかりません。",
    ],
  },
  {
    question: "だれかに話しかけたい気持ちに近いのは、どれですか。",
    labels: ["つよい", "少しある", "いまは静かがよい", "わからない"],
    lines: [
      "だれかに話しかけたい気持ちが、つよめです。",
      "だれかに話しかけたい気持ちが、少しあります。",
      "いまは、静かなほうがよさそうです。",
      "話しかけたい気持ちの度合いは、まだわかりません。",
    ],
  },
];

function moodDailyPromptIndex(dayKey: string, pairId: string): number {
  let h = 0;
  const s = `${dayKey}::${pairId}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)!) | 0;
  }
  return Math.abs(h) % MOOD_DAILY_PROMPTS.length;
}

export type MoodDailyChoiceItem = { id: string; label: string };

export type MoodDailyPromptPayload = {
  promptId: string;
  question: string;
  choices: MoodDailyChoiceItem[];
};

export function buildMoodDailyPromptPayload(dayKey: string, pairId: string): MoodDailyPromptPayload {
  const idx = moodDailyPromptIndex(dayKey, pairId);
  const def = MOOD_DAILY_PROMPTS[idx]!;
  return {
    promptId: `p${idx}`,
    question: def.question,
    choices: def.labels.map((label, i) => ({ id: String(i), label })),
  };
}

export function moodDailyChoiceLine(dayKey: string, pairId: string, choiceId: string): string | null {
  const idx = moodDailyPromptIndex(dayKey, pairId);
  const def = MOOD_DAILY_PROMPTS[idx]!;
  const i = Number.parseInt(choiceId, 10);
  if (!Number.isInteger(i) || i < 0 || i >= def.lines.length) {
    return null;
  }
  return def.lines[i]!;
}
