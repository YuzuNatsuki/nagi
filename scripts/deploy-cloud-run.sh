#!/usr/bin/env bash
# Cloud Run に Artifact Registry のイメージを載せる（フルイメージ URL を毎回打たない用）。
# 既定は .github/workflows/gcp-api-image.yml と同じ:
#   REGION=asia-northeast1, REPOSITORY=nagi, IMAGE_NAME=nagi-api
#
# .env.deploy に GCP_PROJECT_ID を書いておけば、デプロイは次だけでよい:
#   ./scripts/deploy-cloud-run.sh
#
# 引数（GCP_PROJECT_ID が .env.deploy にあるとき）:
#   第1引数のみ → イメージタグ（例: 短い SHA）。省略時は latest
#   第1・第2引数 → プロジェクト ID、タグ
#
# gcloud の追加フラグは「--」のあと:
#   ./scripts/deploy-cloud-run.sh -- --set-env-vars=OTHER=x
# （既定で FIREBASE_PROJECT_ID は GCP_PROJECT_ID と同じに入れます。違う場合は .env.deploy に FIREBASE_PROJECT_ID= を書く）
set -euo pipefail

REGION="${REGION:-asia-northeast1}"
REPOSITORY="${REPOSITORY:-nagi}"
IMAGE_NAME="${IMAGE_NAME:-nagi-api}"
SERVICE="${SERVICE:-nagi-api}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT}/.env.deploy" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "${ROOT}/.env.deploy"
  set +a
fi

trim() {
  # shellcheck disable=SC2001
  echo -n "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

PROJECT="$(trim "${GCP_PROJECT_ID:-}")"
TAG="$(trim "${IMAGE_TAG:-latest}")"
EXTRA=()

if [[ $# -gt 0 && "$1" == "--" ]]; then
  shift
  EXTRA=("$@")
elif [[ $# -eq 1 ]]; then
  if [[ -z "$PROJECT" ]]; then
    PROJECT="$(trim "$1")"
  else
    TAG="$(trim "$1")"
  fi
elif [[ $# -ge 2 ]]; then
  PROJECT="$(trim "$1")"
  TAG="$(trim "$2")"
  shift 2
  if [[ $# -gt 0 && "$1" == "--" ]]; then
    shift
    EXTRA=("$@")
  elif [[ $# -gt 0 ]]; then
    echo "不明な引数: $*（gcloud 用は -- の後に渡してください）" >&2
    exit 1
  fi
fi

if [[ -z "$PROJECT" ]]; then
  echo "GCP_PROJECT_ID がありません。.env.deploy に書くか、第1引数でプロジェクト ID を渡してください。" >&2
  echo "例: cp .env.deploy.example .env.deploy && 編集" >&2
  echo "例: ./scripts/deploy-cloud-run.sh my-gcp-project-id" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG="latest"
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/${IMAGE_NAME}:${TAG}"

FIREBASE_PID="$(trim "${FIREBASE_PROJECT_ID:-}")"
if [[ -z "$FIREBASE_PID" ]]; then
  FIREBASE_PID="${PROJECT}"
fi

echo "Cloud Run: service=${SERVICE} region=${REGION} project=${PROJECT}"
echo "Image: ${IMAGE}"
echo "FIREBASE_PROJECT_ID (for Admin token verify): ${FIREBASE_PID}"

exec gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="NODE_ENV=production,BIND_HOST=0.0.0.0,FIREBASE_PROJECT_ID=${FIREBASE_PID}" \
  "${EXTRA[@]}"
