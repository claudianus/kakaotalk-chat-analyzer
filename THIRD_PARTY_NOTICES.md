# Third-party notices

## kiwi-nlp (Kiwi)

- **Package:** [kiwi-nlp](https://www.npmjs.com/package/kiwi-nlp) (WASM bindings for [Kiwi](https://github.com/bab2min/Kiwi))
- **License:** LGPL-2.1-or-later
- **Use in kca:** Morphological analysis for Korean keyword extraction. Models are downloaded at runtime from the Kiwi project’s GitHub releases (free).
- **Source:** https://github.com/bab2min/Kiwi

This project (`kakaotalk-chat-analyzer`) is distributed under the **MIT License**. Kiwi is invoked as a separate npm dependency; refer to LGPL-2.1 for obligations when redistributing combined works.

## @xenova/transformers (optional, `--semantic-keywords`)

- **Package:** [@xenova/transformers](https://www.npmjs.com/package/@xenova/transformers)
- **License:** Apache-2.0
- **Use in kca:** Korean-primary chats use sentence embeddings for semantic keyword clusters. Default encoders are KoELECTRA-family ONNX bundles; `quality` / `ultra` presets may pull Hub models `nlpai-lab/KURE-v1` or `BAAI/bge-m3` when RAM allows (`KCA_SEMANTIC_MODEL` override). E5/BGE-style models use a `query:` text prefix. Downloaded at runtime (free).
- **Source:** https://github.com/xenova/transformers.js

## Open Props (report CSS, build-time bundle)

- **Package:** [open-props](https://www.npmjs.com/package/open-props) v1.7.x
- **License:** MIT
- **Use in kca:** Design tokens and gradients are bundled into the standalone HTML report at build time (`scripts/bundle-report-css.mjs`). Not a runtime npm dependency for end users.
- **Source:** https://github.com/argyleink/open-props

Other runtime dependencies: `commander` (MIT), `csv-parse` (MIT), `iconv-lite` (MIT).
