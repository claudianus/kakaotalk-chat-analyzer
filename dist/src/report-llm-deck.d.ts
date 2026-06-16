import type { ReportData } from "./types.js";
export declare function hasLlmStoryDeck(data: ReportData): boolean;
export declare function renderLlmArchetypeBanner(data: ReportData): string;
export declare function renderLlmEpisodeStrip(data: ReportData): string;
export declare function renderLlmMomentsBlock(data: ReportData): string;
export declare function renderLlmRelationshipBeats(data: ReportData): string;
export declare function renderLlmCharacterCards(data: ReportData): string;
export declare function renderLlmInsideJokes(data: ReportData): string;
export declare function renderLlmEraLabels(data: ReportData): string;
export declare function renderLlmDayMicroStories(data: ReportData): string;
export declare function renderDailyHotTopics(data: ReportData): string;
export declare function renderLlmShareFooter(data: ReportData): string;
export declare function renderParticipantRoles(data: ReportData): string;
export declare function renderMemorableMomentsList(data: ReportData): string;
export declare function renderMemorableMoments(data: ReportData): string;
export declare function renderRecentSnapshot(data: ReportData): string;
/** 최근 7일 감정 흐름을 날씨 아이콘으로 렌더링 */
export declare function renderSentimentWeatherStrip(data: ReportData): string;
/** 반복 문구 + 방 밈을 하나의 타임라인 스트립으로 렌더링 */
export declare function renderRoomCultureStrip(data: ReportData): string;
