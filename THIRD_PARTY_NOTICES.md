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
- **Use in kca:** Korean-primary chats use multilingual sentence embeddings for semantic keyword clusters by default. Default model `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (override with `KCA_SEMANTIC_MODEL`). Downloaded at runtime (free).
- **Source:** https://github.com/xenova/transformers.js

Other runtime dependencies: `commander` (MIT), `csv-parse` (MIT), `iconv-lite` (MIT).
