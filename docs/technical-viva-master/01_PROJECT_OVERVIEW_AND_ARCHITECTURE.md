# Project overview and architecture

## Architecture at a glance

AdvocaNote ஒரு legal practice workspace. Lawyer diary entry, case, hearing, tasks மற்றும் calendar data manage பண்ணுகிறார். Voice மற்றும் AI features transcript, notes, highlights, suggested tasks தயார் செய்ய உதவுகின்றன. Admin-க்கு தனி console இருக்கு. Stripe paid subscription state-க்கு provider. Application permission decision-ஐ FastAPI check செய்கிறது.

~~~mermaid
flowchart LR
  U["Lawyer or admin"] --> R["React in browser"]
  R -->|"HTTP: JSON or multipart"| F["FastAPI application"]
  F -->|"SQLAlchemy and PyMySQL"| M[("MySQL")]
  F -->|"Admin notifications"| N[("SQLite")]
  F -->|"Owned media"| D["Backend file storage"]
  F -->|"Local chat API"| Q["Ollama and Qwen"]
  F --- W["Faster-Whisper library"]
  F --> E["SMTP"]
  F -->|"Stripe API"| S["Stripe"]
  R -->|"Hosted Checkout or Portal"| S
  S -->|"Signed webhook"| F
~~~

Cross-boundary evidence · [frontend entry](../../advocanote-frontend/src/main.jsx#L11), [router mounts](../../advocanote-backend/app/main.py#L144), [DB setup](../../advocanote-backend/app/database.py#L7), [admin SQLite](../../advocanote-backend/admin_notifications_api.py#L30), [Qwen client](../../advocanote-backend/app/services/legal_ai.py#L11), [Stripe webhook](../../advocanote-backend/app/routers/stripe_webhooks.py#L1999).

## Stack and responsibilities

| Technology | Why it belongs here |
|---|---|
| React, React DOM, React Router | Components, browser mounting, navigation and nested layouts. |
| JavaScript, JSX, CSS, Tailwind/Vite plugin | Browser behavior, UI markup, existing styles and utility-CSS build support. |
| Vite, npm, ESLint | Dev server and bundle, repeatable JS dependency installation with the lockfile, static lint checks. |
| Python, FastAPI, Uvicorn, Pydantic | Handler language, ASGI app/routers, HTTP server, and transport/config data validation. |
| MySQL, PyMySQL, SQLAlchemy, Alembic | Relational storage, driver, query/unit of work, schema change history. |
| pwdlib, PyJWT, Google OAuth, SMTP | Password hash verification, JWT signing/verification, Google identity flow, email transport. |
| Ollama Python client, Qwen | API connection to model runner, language generation. Runner/model weights are separate runtime dependencies. |
| Faster-Whisper | Audio segmentation/transcription. Application config uses CPU and int8. |
| Stripe Python SDK | API operations and signature verification. Stripe-hosted page collects payment details. |
| SQLite and filesystem | Staff notifications and media binaries need separate persistence and backup reasoning. |
| Vercel and Railway | Reported frontend and backend hosting; source shows SPA rewrite and API URL plumbing. Live deployment version is **UNVERIFIED** here. |

Sources · [package.json](../../advocanote-frontend/package.json), [requirements.txt](../../advocanote-backend/requirements.txt), [Vite config](../../advocanote-frontend/vite.config.js), [security.py](../../advocanote-backend/app/auth/security.py), [voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py#L97).

<a id="arc-01"></a>

## ARC-01 — Explain your architecture. How does the frontend communicate with the backend?

**Simple Tamil-English.** React screen ஒரு form submit அல்லது date selection-ஐப் பிடிக்கும். FastAPI-க்கு HTTP request அனுப்பும். Backend data மற்றும் rules check செய்து response அனுப்பும். React அந்த response-ஐ வைத்து screen update பண்ணும்.

**Theory and execution.** Browser என்பது client. API contract method, path, headers, body, response/status ஆகியவற்றை define பண்ணும். Diary page → service helper → FastAPI router → request dependencies → SQLAlchemy query → MySQL → JSON → state update. Stripe webhook வேறு entry point. அது browser action இல்லாமலும் backend-க்கு வரலாம்.

**Actual code.** [MyLegalDiary effect](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193), [getDiaryOverview](../../advocanote-frontend/src/services/diary.js#L53), [overview](../../advocanote-backend/app/routers/diary.py#L129).

**Why and alternatives.** UI மற்றும் API தனியா evolve ஆகலாம். Server-rendered Django போல ஒரே service HTML render செய்தாலும் product உருவாக்க முடியும். Separate frontend/API-ல் CORS மற்றும் version compatibility கவனிக்கணும்.

**Problems and debug.** Blank page-க்கு Console, Network request URL, status, response shape பார்க்கவும். Request server வரை போனதா என்பதை backend log மூலம் verify செய்யவும். Sample legal text அல்லது tokens-ஐ share செய்யத் தேவையில்லை.

**Viva.** “AdvocaNote uses React for the lawyer and admin UI, FastAPI for application rules, and MySQL for durable records. Browser API helpers send HTTP requests with JSON or multipart data. FastAPI authenticates and authorizes, uses SQLAlchemy for data operations, and returns a response that updates React.”

**Follow-up.** Can an API be used without React? ஆம். Authorized client அதே documented contract follow பண்ணலாம்.

<a id="arc-02"></a>

## ARC-02 — Trace a diary overview request from date selection to MySQL and back.

**Simple Tamil-English.** எந்த date select பண்ணுறீங்களோ, அந்த date-க்கு உங்களுடைய notes மட்டும் backend தேடுகிறது.

**Theory and execution.** Date state → effect → GET request with query parameter and Bearer header → mounted diary router with onboarding dependency → handler role/database dependencies → owned rows and counts → response → page state. Diary overview filters by lawyer ID and date. The hearing count separately joins Case and Hearing.

**Actual code.**

~~~python
@router.get("/overview")
def overview(
    entry_date: date,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
~~~

- Decorator maps GET requests under the router's /diary prefix.
- def names the synchronous handler.
- entry_date is a typed query value FastAPI can parse.
- db comes from the get_db dependency. It is a SQLAlchemy Session.
- user comes from lawyer_only. It is the server-resolved user, rather than a lawyer ID trusted from the browser.
- The handler body reads rows and returns dashboard data.

Evidence · [mount and onboarding dependency](../../advocanote-backend/app/main.py#L154), [handler](../../advocanote-backend/app/routers/diary.py#L129), [session generator](../../advocanote-backend/app/database.py#L36).

**Why and alternatives.** A GET fits a filtered read. A separate request per widget could reduce coupling, while increasing round trips. Here one overview endpoint can return entries and counts together.

**Problems and debug.** Missing or malformed date may return 422. Auth or onboarding can reject a valid date. Empty rows can be legitimate. Compare date, status, safe response fields, and test-user ownership.

**Viva.** “Date selection triggers a GET to /diary/overview. FastAPI parses the date and resolves the lawyer and DB session from dependencies. The query scopes diary rows by lawyer ID and date. The JSON result updates the diary list and counts.”

**Follow-up.** Why not accept a browser-supplied lawyer ID? The server must derive the authenticated identity and enforce ownership independently.

<a id="arc-03"></a>

## ARC-03 — What is FastAPI's role, and how does it compare with Flask and Django?

**Simple Tamil-English.** FastAPI browser-லிருந்து வந்த request-ஐ சரியான Python function-க்கு அனுப்பும். அந்த function ஓடுவதற்கு தேவையான database session, user details எல்லாம் dependency வழியா தர முடியும்.

**Theory and execution.** Uvicorn serves the ASGI application. FastAPI mounts routers, resolves dependencies, validates input, calls handlers and serializes output. Pydantic schemas describe request/response shapes. SQLAlchemy handles data access. Flask offers a small core with a different extension model. Django provides a larger integrated stack, including its own ORM and admin capabilities. These are general comparisons.

**Actual code.** [FastAPI app](../../advocanote-backend/app/main.py#L109), [mounted routes](../../advocanote-backend/app/main.py#L144), [auth schemas](../../advocanote-backend/app/schemas/auth.py).

**Why and alternatives.** For a separate React client, typed JSON endpoints, generated OpenAPI, and reusable dependencies fit the project's needs. This is a rationale supported by the design. A claim about the original developer's private decision needs personal evidence.

**Problems and debug.** A router existing in a file doesn't prove it's mounted. If a URL returns 404, verify HTTP method, prefix, mount, and running revision. Startup error and request validation failure happen at different stages.

**Viva.** “FastAPI is my HTTP application framework. It maps routes and injects common checks such as database sessions and authenticated users, while schema types validate the inputs. Flask or Django could also implement it. FastAPI fits the separate React client and typed API design.”

**Follow-up.** Is Uvicorn a replacement for FastAPI? இல்லை. Uvicorn serves the ASGI app that FastAPI defines.

<a id="arc-04"></a>

## ARC-04 — Why use React for this frontend?

**Simple Tamil-English.** Diary date, selected case, loading status, form fields எல்லாம் மாறிக்கொண்டே இருக்கும். React state மாறும்போது UI எப்படி இருக்கணும் என்று component-ல் எழுத உதவுகிறது.

**Theory and execution.** JSX describes component output. Event handlers update state or call API helpers. React reconciles the next tree with the existing UI. Router selects pages. Reusable components handle layouts, navigation and notifications.

**Actual code.** [React root](../../advocanote-frontend/src/main.jsx#L11), [App routes](../../advocanote-frontend/src/App.jsx#L93), [diary fetch effect](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193).

**Why and alternatives.** Plain JavaScript can do the same work with manual DOM/state management. Vue and Angular are alternatives with different conventions and ecosystem tradeoffs. One static page may not justify a full React client.

**Problems and debug.** Repeated effects, unstable dependencies and stale responses can overwrite a more recent selection. Inspect request sequence and React state, and verify a change corresponds to one intended fetch.

**Viva.** “React lets me model a stateful lawyer dashboard as components. When date selection or fetched data changes, React updates the relevant UI. That is useful for many connected screens, forms and loading states. Plain JavaScript is possible but would require more manual coordination.”

**Follow-up.** Does switching frameworks fix an ownership bug? இல்லை. The ownership rule belongs on the backend.

<a id="arc-05"></a>

## ARC-05 — Why validate on the frontend and backend?

**Simple Tamil-English.** Frontend உடனே “password match ஆகலை”ன்னு சொல்லும். Backend தன் rules-ஐத் தனியா check பண்ணும். Browser form வழியா வந்தால்தான் request அனுப்ப முடியும் என்ற கட்டுப்பாடு கிடையாது.

**Theory and execution.** Client validation improves UX. Server checks schema, authenticated role, ownership, and business constraints. Database constraints cover invariants even when requests overlap. Authentication and authorization are separate from type validation.

**Actual code.** [Register form](../../advocanote-frontend/src/pages/Register.jsx#L343), [auth schemas](../../advocanote-backend/app/schemas/auth.py), [register service](../../advocanote-backend/app/services/auth.py#L33), [diary owner rules](../../advocanote-backend/app/routers/diary.py#L226).

**Why and alternatives.** Sharing OpenAPI-derived types can reduce mismatches. Server-side constraints still need enforcement. A password-confirmation field improves UI but the stored hash is based on the accepted password.

**Problems and debug.** A frontend accepts a value that server rejects. Isolated test: use a synthetic invalid payload, capture status and safe field details, compare schema and form normalization.

**Viva.** “Frontend validation gives fast feedback. Backend validation decides whether the request is accepted, because any authorized client can send a request directly. Database constraints protect persisted invariants. Each layer addresses a different failure.”

**Follow-up.** Does an integer case ID prove the user owns it? இல்லை. Type check valid, ownership query still needed.

<a id="arc-06"></a>

## ARC-06 — What happens between backend startup and shutdown?

**Simple Tamil-English.** Server requests வாங்க ஆரம்பிக்கிறதுக்கு முன்னாடி setup பண்ணுது. Server stop ஆகும்போது ஆரம்பிச்ச background tasks-ஐ நிறுத்துகிறது.

**Theory and execution.** FastAPI consumes the async lifespan context manager. In this project the startup code checks reminders columns, checks whether the parent diary table exists and if so ensures the AI analysis table is created, then schedules trial notification work. The scheduler wraps notification checks and the separate hosted-upgrade recovery loop. At shutdown cancellation and await coordinate the task's exit. Cancellation of an await doesn't guarantee that a synchronous operation already running in a worker thread immediately stops.

**Actual code.** [lifespan](../../advocanote-backend/app/main.py#L78), [trial_notification_scheduler](../../advocanote-backend/app/routers/subscription_experience.py#L1168), [diary models](../../advocanote-backend/app/models/diary.py#L60).

**Why and alternatives.** Lifespan centralizes resources tied to server lifetime. Migrations can own all schema DDL. A durable or separately deployed worker can own scheduled work when multiple API instances or restart recovery matter.

**Problems and debug.** Startup can fail on database connectivity or schema permissions. Parent absence can generate a warning and skip AI analysis table initialization. Because startup can perform DDL, don't boot the app against a shared DB just to study it.

**Viva.** “Before serving requests, lifespan runs the database setup checks and starts the notification scheduler. That scheduler also starts upgrade reconciliation. At shutdown the lifespan cancels and awaits the task. Because these tasks run in the API process, restarts and multiple workers matter.”

**Follow-up.** Why check the parent diary table first? The child analysis table has a foreign key to diary_entries.

<a id="arc-07"></a>

## ARC-07 — Which data must be backed up to recover the whole application?

**Simple Tamil-English.** MySQL copy எடுத்தாலே எல்லா photos, voice files, staff notifications கிடைக்கும் என்று assume பண்ணக்கூடாது. அவை different storage-ல் இருக்கின்றன.

**Theory and execution.** Relational records include account identity and legal data. Voice/profile files are filesystem binaries with related metadata. Staff notification rows have a separate SQLite store. Stripe is an external system. A backup copies local state and identifiers, but restore doesn't rewind external payment activity.

**Actual code.** [SQLAlchemy configuration](../../advocanote-backend/app/database.py#L7), [voice path](../../advocanote-backend/app/routers/voice_storage.py#L52), [profile photo storage](../../advocanote-backend/app/services/profile_photo_service.py), [admin notifications](../../advocanote-backend/admin_notifications_api.py#L19).

**Why and alternatives.** Filesystem storage keeps binary data separate. Object storage is a future option with its own access checks, lifecycle and backup policies. MySQL-only storage simplifies one backup boundary but changes database size and serving tradeoffs.

**Problems and debug.** Diaried row restored but file absent; SQLite not copied; active provider ID still linked to old account. Verify isolated restore counts, ownership, file references and checksums, and Stripe consistency by read-only inspection. Production volume/mount state is **UNVERIFIED**.

**Viva.** “A full restore needs MySQL, the admin notification SQLite data, and private voice and profile-media files. I'd verify rows and references in isolation and reconcile Stripe separately, because provider state can progress after the backup.”

**Follow-up.** Why compare file checksums as well as filenames? Same filename can point to missing, truncated or different content.

<a id="arc-08"></a>

## ARC-08 — How would you classify this architecture and decide what to scale separately?

**Simple Tamil-English.** Backend files பல இருக்கும். அவை ஒரே FastAPI app-க்குள் run ஆகின்றன. அதிக resource தேவைப்படுகிற பகுதியைத் தனியா scale பண்ணுவது ஒரு later design decision.

**Theory and execution.** A modular monolith organizes one backend deployment into domains. Independently deployed services communicate over network boundaries. React hosting, MySQL, Stripe, and Ollama are distinct runtime dependencies of the system. Source doesn't show a separate service deployment per domain router.

**Actual code.** [main app mounts](../../advocanote-backend/app/main.py#L144), [Qwen client](../../advocanote-backend/app/services/legal_ai.py#L11), [Whisper execution](../../advocanote-backend/app/routers/voice_ai.py#L97).

**Why and alternatives.** Keeping legal domain operations together simplifies local transactions and shared permission rules. Isolating voice/AI compute may help if it dominates CPU, memory or queue wait. Extra network hops and job ownership increase complexity.

**Problems and debug.** One slow model call may exhaust workers under load. Measure per-route latency, concurrency, resource use and upstream time before choosing to split. No throughput or user-capacity figure was verified.

**Viva.** “The API is a modular FastAPI app with separate frontend hosting and external dependencies. I'd profile normal requests, AI and audio independently. If compute traffic harms diary or auth latency, I'd consider isolated inference capacity with timeouts and clear ownership.”

**Follow-up.** What would make a queue worthwhile? Long, retryable jobs with controllable concurrency, when the UX and data policy support asynchronous processing.
