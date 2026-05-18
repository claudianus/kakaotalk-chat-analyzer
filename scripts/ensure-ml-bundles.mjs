#!/usr/bin/env node
/**
 * postinstall: 감정·임베딩 번들 자동 npm 설치 시도. 독성은 quality/KCA_TOXICITY 시 런타임 lazy.
 * 실패해도 exit 0 (전역 install 깨지지 않음).
 */
import {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  isEmbedBundleReady,
  isSentimentBundleReady,
  listMlModelRoots,
} from "./ml-bundle-lib.mjs";
import { installModelsPackageIfNeeded, readPinnedModelsVersion } from "./ml-bundle-install.mjs";

function warn(msg) {
  process.stderr.write(`[kca] ${msg}\n`);
}

function main() {
  if (process.env.KCA_SKIP_ML_POSTINSTALL === "1") return;

  let sentiment = isSentimentBundleReady();
  let embed = isEmbedBundleReady();

  if (!sentiment || !embed) {
    installModelsPackageIfNeeded();
    sentiment = isSentimentBundleReady();
    embed = isEmbedBundleReady();
  }

  const modelsVer = readPinnedModelsVersion();
  const roots = listMlModelRoots();

  if (sentiment && embed) {
    if (process.env.KCA_ML_POSTINSTALL_VERBOSE === "1") {
      warn(`ML 번들 OK (models@${modelsVer}, roots=${roots.length})`);
    }
    return;
  }

  const missing = [];
  if (!sentiment) missing.push(BUNDLED_SENTIMENT_MODEL_ID);
  if (!embed) missing.push(BUNDLED_EMBED_MODEL_ID);

  warn(
    `ONNX 번들 미완료: ${missing.join(", ")}. ` +
      `리포트 실행 시 자동 재시도하거나 kakaotalk-chat-analyzer-models@${modelsVer} 를 확인하세요. ` +
      `(roots: ${roots.length ? roots.join("; ") : "none"})`,
  );
}

main();
