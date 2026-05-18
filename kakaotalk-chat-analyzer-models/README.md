# kakaotalk-chat-analyzer-models

Optional npm package with bundled Korean encoder ONNX weights for [kakaotalk-chat-analyzer](https://github.com/claudianus/kakaotalk-chat-analyzer).

## Models

| Directory | Source | Task |
|-----------|--------|------|
| `kca-koelectra-small-v3-nsmc` | `daekeun-ml/koelectra-small-v3-nsmc` | Sentiment (NSMC) |
| `kca-koelectra-small-v3-embed` | `monologg/koelectra-small-v3-discriminator` | Feature extraction |

독성(`kca-kcelectra-base-toxicity`) ONNX는 npm tarball에 포함하지 않습니다. GitHub Release `ml-models-v*` zip으로 lazy 설치합니다.

Generate ONNX locally or in CI:

```bash
# 저장소 루트에서
npm run sync:ml-models
```

Requires Python `optimum-cli` (`pip install "optimum[onnxruntime]" transformers`).
