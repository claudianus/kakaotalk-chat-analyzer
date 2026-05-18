# kca-koelectra-korean-sentiment (로컬 ONNX)

NSMC 계열 한국어 이진 감정 모델을 @xenova/transformers 용 ONNX로 변환합니다.

## 변환

```bash
python3 -m venv .venv-sentiment
source .venv-sentiment/bin/activate
pip install "optimum[onnxruntime]" onnx transformers
optimum-cli export onnx \
  --model cringepnh/koelectra-korean-sentiment \
  --task text-classification \
  data/ml-models/kca-koelectra-korean-sentiment
```

또는: `npm run convert:sentiment-onnx` (optimum-cli 가 PATH 에 있으면 자동 실행)

## 사용

변환 후 quality preset 이 `kca-koelectra-korean-sentiment` 로컬 모델을 우선 사용합니다.
이진 출력은 `KCA_SENTIMENT_BINARY_HIGH`(기본 0.72) 미만 confidence 를 neutral 로 매핑합니다.

원본: cringepnh/koelectra-korean-sentiment (MIT)
