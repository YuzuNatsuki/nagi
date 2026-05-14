/**
 * 「凪に話す」アシスタント応答。
 *
 * **Vertex AI のみ**（ランタイム SA + Application Default Credentials の OAuth）。
 * Google AI Studio の API キー経路は持たない。
 *
 * 既定は `locations/global` + `aiplatform.googleapis.com`（Publisher の Gemini 向け）。`NAGI_VERTEX_AI_LOCATION` で上書き。
 * 利用者の発言は Vertex に送られる。DPA・データ所在地・ログにプロンプトを残さない運用は別途設計する。
 * `NAGI_CHAT_AI_ENABLED=0` のときは常にローカル分岐のみ。
 */

import { GoogleAuth } from "google-auth-library";
import { resolveFirebaseProjectId } from "./ensure-firebase-admin.js";

function chatAiGloballyOff(): boolean {
  return process.env.NAGI_CHAT_AI_ENABLED === "0";
}

/** Vertex 用モデル ID（リージョンの Publisher モデル名） */
function geminiModelIdVertex(): string {
  const m = process.env.NAGI_VERTEX_GEMINI_MODEL?.trim();
  return m !== undefined && m !== "" ? m : "gemini-2.0-flash-001";
}

/**
 * Vertex の `locations/...` セグメント。Publisher の Gemini は公式例どおり **`global`** が無難。
 * リージョン固定が必要なら `NAGI_VERTEX_AI_LOCATION` に `asia-northeast1` 等（従来の `NAGI_VERTEX_AI_REGION` も未指定時のフォールバック）。
 */
function vertexLocationPath(): string {
  const loc = process.env.NAGI_VERTEX_AI_LOCATION?.trim();
  if (loc !== undefined && loc !== "") {
    return loc;
  }
  const legacy = process.env.NAGI_VERTEX_AI_REGION?.trim();
  if (legacy !== undefined && legacy !== "") {
    return legacy;
  }
  return "global";
}

function vertexApiHost(locationPath: string): string {
  if (locationPath === "global") {
    return "aiplatform.googleapis.com";
  }
  return `${locationPath}-aiplatform.googleapis.com`;
}

function chatAiDebug(message: string): void {
  if (process.env.NAGI_CHAT_AI_DEBUG === "1") {
    console.warn("[vertex gemini debug]", message);
  }
}

/** 従来の Phase 1 ダミー応答（オフライン・テスト用・Vertex 失敗時のフォールバック） */
export function buildAssistantReplyLocal(userText: string, topicUserId: string | null): string {
  const t = userText.trim();
  const topicPrefix =
    topicUserId !== null && topicUserId !== ""
      ? "その方の話題に留めて推察しますが、"
      : "";
  if (/疲れ|つかれ/.test(t)) {
    return `${topicPrefix}いまの言葉には、からだの声が少し混じっているようにも見えます。休める幅を広げてもよさそうです。断定ではありません。`;
  }
  if (/心配|しんぱい/.test(t)) {
    return `${topicPrefix}気にかかっているようですね。事実と想像の境は、あえてゆるめておいてもよさそうです。`;
  }
  if (/天気|雨|晴/.test(t)) {
    return `${topicPrefix}空の話題に見えます。身のまわりの小さな変化として受け取ってもよいかもしれません。`;
  }
  if (/ありがと|感謝/.test(t)) {
    return `${topicPrefix}いまの言葉はやわらかいですね。その調子を保てば十分そうに見えます。`;
  }
  return `${topicPrefix}短い一行にも、いまの輪郭が少し映っているように感じます。急いで整えなくても大丈夫です。`;
}

const SYSTEM_INSTRUCTION = `あなたはアプリ「凪」の対話パートです。利用者の短い発言に、やわらかく短く返します。
次の制約を守ってください。
- 普通の日本語。命令口調にしない。絵文字は使わない。
- 数値スコア・順位・比率による評価は出さない。
- 断定は避け、推察の言い回しにする。
- 返答はおおむね300文字以内。段落は1つにまとめる。
話題として別の利用者IDが指定されている場合は、その方についての推察にとどめ、断定しない。`;

function buildUserBlock(userText: string, topicUserId: string | null): string {
  const topicLine =
    topicUserId !== null && topicUserId !== ""
      ? `話題として指定された利用者 ID: ${topicUserId}\n`
      : "話題の指定: なし（特に誰か一人に絞らない）\n";
  return `${topicLine}利用者の発言:\n${userText}`;
}

function generateContentBody(userBlock: string): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: userBlock }] }],
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.65,
    },
  };
}

function stripEmojiLike(s: string): string {
  return s.replace(/\p{Extended_Pictographic}/gu, "");
}

function extractGeminiText(json: unknown): string | null {
  if (json === null || typeof json !== "object") {
    return null;
  }
  const root = json as Record<string, unknown>;
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const pf = root.promptFeedback;
    if (pf !== null && typeof pf === "object" && "blockReason" in pf) {
      chatAiDebug(`応答に candidates が無い（promptFeedback あり）`);
    } else {
      chatAiDebug("応答に candidates が無い");
    }
    return null;
  }
  const c0 = candidates[0];
  if (c0 === null || typeof c0 !== "object") {
    return null;
  }
  const c0r = c0 as Record<string, unknown>;
  if (typeof c0r.finishReason === "string" && c0r.finishReason !== "STOP" && c0r.finishReason !== "") {
    chatAiDebug(`finishReason=${c0r.finishReason}`);
  }
  const content = c0r.content;
  if (content === null || typeof content !== "object") {
    return null;
  }
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }
  const p0 = parts[0];
  if (p0 === null || typeof p0 !== "object") {
    return null;
  }
  const text = (p0 as Record<string, unknown>).text;
  return typeof text === "string" ? text : null;
}

function finalizeModelText(text: string): string | null {
  const cleaned = stripEmojiLike(text).trim();
  if (cleaned === "") {
    return null;
  }
  if (cleaned.length > 2000) {
    return `${cleaned.slice(0, 1997)}…`;
  }
  return cleaned;
}

async function getVertexAccessToken(): Promise<string | null> {
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    return token ?? null;
  } catch (e) {
    console.warn("[vertex gemini] auth failed", e);
    return null;
  }
}

async function generateGeminiReplyViaVertex(userText: string, topicUserId: string | null): Promise<string | null> {
  if (chatAiGloballyOff()) {
    return null;
  }
  const project = resolveFirebaseProjectId();
  if (project === "") {
    chatAiDebug("FIREBASE_PROJECT_ID / GCLOUD_PROJECT が無いため Vertex をスキップ");
    return null;
  }
  const locationPath = vertexLocationPath();
  const host = vertexApiHost(locationPath);
  const model = geminiModelIdVertex();
  const token = await getVertexAccessToken();
  if (token === null || token === "") {
    chatAiDebug("アクセストークンが取れないため Vertex をスキップ（ADC / SA を確認）");
    return null;
  }
  const userBlock = buildUserBlock(userText, topicUserId);
  const url = `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(locationPath)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(generateContentBody(userBlock)),
    });
    const rawText = await res.text();
    if (!res.ok) {
      console.warn("[vertex gemini] HTTP", res.status, rawText.slice(0, 200));
      chatAiDebug(`HTTP ${String(res.status)} — モデル・ロケーション・Vertex API 有効化を確認`);
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      return null;
    }
    const extracted = extractGeminiText(parsed);
    if (extracted === null || extracted.trim() === "") {
      return null;
    }
    return finalizeModelText(extracted);
  } catch (e) {
    console.warn("[vertex gemini] request failed", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** アシスタント本文を決定する。Vertex 失敗・未設定時はローカル分岐。 */
export async function resolveAssistantReply(userText: string, topicUserId: string | null): Promise<string> {
  if (chatAiGloballyOff()) {
    return buildAssistantReplyLocal(userText, topicUserId);
  }
  const fromVertex = await generateGeminiReplyViaVertex(userText, topicUserId);
  if (fromVertex !== null) {
    return fromVertex;
  }
  return buildAssistantReplyLocal(userText, topicUserId);
}
