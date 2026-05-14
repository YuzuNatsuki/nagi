/**
 * Firebase Admin の初期化を 1 か所にまとめる。
 * 起動時・Bearer 検証時のどちらからでも呼べる（二重初期化はガードする）。
 */
export function resolveFirebaseProjectId(): string {
  return (process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "").trim();
}

/** 成功時 true（既に初期化済みも含む）。プロジェクト ID が無い・初期化失敗時は false。 */
export async function ensureFirebaseAdminInitialized(): Promise<boolean> {
  const projectId = resolveFirebaseProjectId();
  if (projectId === "") {
    return false;
  }

  const adminModule = await import("firebase-admin");
  const admin = adminModule.default;
  if (admin.apps.length > 0) {
    return true;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return true;
  } catch (err) {
    console.warn("[nagi] Firebase Admin initialization failed:", err);
    return false;
  }
}
