# kakaotalk-chat-analyzer-models

Optional npm package with bundled Korean encoder ONNX weights for [kakaotalk-chat-analyzer](https://github.com/claudianus/kakaotalk-chat-analyzer).

## Models

| Directory | Source | Task |
|-----------|--------|------|
| `kca-koelectra-small-v3-nsmc` | `daekeun-ml/koelectra-small-v3-nsmc` | Sentiment (NSMC) |
| `kca-koelectra-small-v3-embed` | `monologg/koelectra-small-v3-discriminator` | Feature extraction |
| `kca-kcelectra-base-toxicity` | `monologg/koelectra-base-v3-discriminator` | Toxicity (binary) |

Generate ONNX locally or in CI:

```bash
# 저장소 루트에서
npm run sync:ml-models
```

Requires Python `optimum-cli` (`pip install "optimum[onnxruntime]" transformers`).
