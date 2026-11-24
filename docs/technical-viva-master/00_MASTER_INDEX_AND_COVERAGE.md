# AdvocaNote Technical Viva and Developer Handbook

**Project** AdvocaNote – AI Smart Legal Diary  
**Source** `D:\AdvocaNote`, local working tree over `44ca5d0`  
**Study language** Conversational Tamil-English, with English examiner questions and technical terms.

## Start here

முதல்ல [architecture](01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md) படிச்சு, ஒரு diary request எங்க ஆரம்பிச்சு எங்க முடிகிறது என்று சொல்லிப் பாருங்க. அதன் பிறகு [web fundamentals](02_COMPUTER_SCIENCE_AND_WEB_THEORY.md) படிங்க. உங்க sister-ன் question எந்த chapter-க்கு map ஆகுது என்று [source question matrix](20_SISTERS_QUESTIONS_COMPLETE_ANSWERS.md)-ல் original wording-உடன் தேடலாம். [Source inventory](24_SOURCE_COVERAGE_AND_UNVERIFIED_ITEMS.md) local code, பழைய study notes மற்றும் hosted evidence-ஐப் பிரிக்கிறது.

## Chapter index and progress

| Chapter | Coverage | Status |
|---|---|---|
| [00_MASTER_INDEX_AND_COVERAGE.md](00_MASTER_INDEX_AND_COVERAGE.md) | Chapter map, scope and progress | Complete for this edition |
| [01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md](01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md) | Architecture, request boundaries, stack and workflow | Complete for this edition |
| [02_COMPUTER_SCIENCE_AND_WEB_THEORY.md](02_COMPUTER_SCIENCE_AND_WEB_THEORY.md) | CS, web, networking, browser internals | Complete for this edition |
| `03_HTML_CSS_JAVASCRIPT_THEORY.md` | HTML, CSS, JavaScript, async and forms | Pending |
| `04_REACT_COMPLETE_THEORY_AND_CODE.md` | React, routing, Hooks and performance | Pending |
| `05_PYTHON_COMPLETE_THEORY_AND_CODE.md` | Python, OOP, imports, context managers and async | Pending |
| `06_FASTAPI_REST_API_AND_PYDANTIC.md` | FastAPI, REST, ASGI, schemas and validation | Pending |
| `07_MYSQL_SQLALCHEMY_AND_ALEMBIC.md` | MySQL, SQL, schema, ERD, transactions and migrations | Pending |
| `08_AUTHENTICATION_JWT_AND_SECURITY.md` | Identity, tokens, sessions, security and privacy | Pending |
| `09_ADVOCANOTE_FEATURE_BY_FEATURE.md` | Full feature Q&A by domain | Pending |
| `10_AI_LLM_QWEN_AND_OLLAMA.md` | AI theory, Qwen, Ollama and validation | Pending |
| `11_FASTER_WHISPER_AND_AUDIO.md` | Faster-Whisper, upload, storage and playback | Pending |
| `12_STRIPE_SUBSCRIPTIONS_AND_PAYMENTS.md` | Stripe payments, trials, quota and lifecycle | Pending |
| `13_FRONTEND_BACKEND_DATABASE_FLOWS.md` | Full user-action traces and Mermaid diagrams | Pending |
| `14_VERCEL_RAILWAY_AND_DEPLOYMENT.md` | Deployment, storage, configuration and incidents | Pending |
| `15_GIT_GITHUB_AND_PACKAGES.md` | Git, packages, reproducibility and security | Pending |
| `16_TESTING_DEBUGGING_AND_SCENARIOS.md` | Testing, debugging and 30 production scenarios | Pending |
| `17_SOFTWARE_ENGINEERING_AND_SYSTEM_DESIGN.md` | Engineering, SDLC, design, observability, reliability | Pending |
| `18_ADVANCED_DEVELOPER_INTERVIEW_QA.md` | Advanced interviews and technology defense | Pending |
| `19_FILE_BY_FILE_TECHNICAL_VIVA.md` | File-by-file examination | Pending |
| [20_SISTERS_QUESTIONS_COMPLETE_ANSWERS.md](20_SISTERS_QUESTIONS_COMPLETE_ANSWERS.md) | Original attachment coverage and answer references | Matrix complete, answers in progress |
| `21_QUESTION_BANK_BEGINNER_TO_ADVANCED.md` | 400+ distinct question target and stable ID index | Pending |
| `22_MOCK_VIVA_WITH_FOLLOWUPS.md` | Mock viva and graded follow-ups | Pending |
| `23_RAPID_REVISION_AND_SHORT_ANSWERS.md` | Rapid revision | Pending |
| [24_SOURCE_COVERAGE_AND_UNVERIFIED_ITEMS.md](24_SOURCE_COVERAGE_AND_UNVERIFIED_ITEMS.md) | Source inventory, evidence, gaps and audit | Source inventory complete, final audit pending |

## Study sequence

1. **Beginner:** 01 → 02 → 03 → 05. ஒரு URL, request, JSON object, function, exception என்னன்னு explain பண்ணுங்க.
2. **Intermediate:** 04 → 06 → 07 → 08 → 09 → 13. Date filter request-ஐ browser-லிருந்து MySQL வரை trace பண்ணுங்க. அதுக்கப்புறம் save flow, token expiry, permission denial compare பண்ணுங்க.
3. **Advanced:** 10 → 11 → 12 → 14. AI draft, saved audio, verified payment மூன்றுக்கும் success evidence என்னன்னு எழுதுங்க.
4. **Developer practice:** 15 → 16 → 17 → 19. ஒரு isolated regression test plan உருவாக்குங்க. Filename மட்டும் வைத்து route active என்று சொல்லாதீங்க.
5. **Defense and revision:** 18 → 20 → 21 → 22 → 23. ஒவ்வொரு answer-க்கும் ஒரு code evidence, ஒரு tradeoff, ஒரு follow-up.

## Evidence and counts

- **VERIFIED FROM CODE** means inspected local source supports the description. **GENERAL THEORY** means reusable knowledge. **UNVERIFIED** means a runtime fact needs separate evidence. **NOT IMPLEMENTED** means the named feature/provider was absent from the inspected active path. **FUTURE IMPROVEMENT** is a design proposal.
- **168** original sister questions retained, with unique `S-<section><number>` IDs. Equivalent rows keep separate IDs and may share one mapped answer.
- **20** distinct detailed answers available in this edition, `ARC-01`–`ARC-08` and `WEB-01`–`WEB-12`. The 400+ master bank, remaining full answers, file-by-file viva, full ERD and workflow diagrams are pending. A chapter reference marked pending is a coverage assignment.
- The project source, old documentation, production services, database, and deployment configuration were inspected only within the authorised read-only scope. No app process, test suite, external integration or migration was run for this edition.
