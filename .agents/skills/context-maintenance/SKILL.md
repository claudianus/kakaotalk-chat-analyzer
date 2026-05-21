---
name: context-maintenance
description: 스택·대규모 리팩터 후 에이전트 규칙·스킬 재검토 제안
---

# 컨텍스트 유지보수

기술 스택이 바뀌거나(테스트 러너·UI 프레임워크 등) 대규모 리팩터가 끝나면, **에이전트 규칙·스킬이 여전히 맞는지** 사용자에게 짧게 제안한다.

동의 시 아래 프로토콜을 다시 따른다:

https://raw.githubusercontent.com/claudianus/agent-rules-auto-setup/master/setup.prompt.md

이 저장소 우선순위: `AGENTS.md` > `.cursor/rules/cubic-pr-workflow.mdc` > glob 규칙 > `.cursor/skills/` · `.agents/skills/`.
