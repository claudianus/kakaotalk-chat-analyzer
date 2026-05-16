import type { UserWord } from "kiwi-nlp";
/** CSV 옆 `.kca-glossary.txt` 또는 `{채팅방}.kca-glossary.txt` */
export declare function loadGlossaryForExport(exportPath: string): Promise<UserWord[]>;
