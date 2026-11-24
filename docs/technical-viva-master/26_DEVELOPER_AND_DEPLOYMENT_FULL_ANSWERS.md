# Engineering decisions, development and deployment — Full Answers

இந்த chapter-ல் ‘நான் இதைச் செய்தேன்’ என்று சொல்ல வேண்டிய personal evidence-ஐ code trace, பழைய test result மற்றும் future proposal-லிருந்து பிரித்திருக்கிறேன். Viva-ல் evidence இருக்கிற example-ஐ மட்டும் உங்க அனுபவமாகப் பயன்படுத்துங்க.

<a id="question-031"></a>

### QUESTION 031 — What is the most technically challenging feature you implemented, and how did you solve it?

**Sister’s original ID S-D01.**

**COMPLETE ANSWER (English):**

A strong viva answer identifies a difficult invariant, names failure modes, and points to evidence. A grounded candidate is subscription upgrade reconciliation: database and payment provider are different systems, so successful payment, application activation and prior subscription retirement can occur at different times. The student's own hardest-feature choice remains personal evidence.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

எனக்கு hardest இது தான் என்று code மட்டும் வைத்து சொல்ல முடியாது. ஆனா Checkout recovery-ல் ஏன் complexity இருக்கு என்பதை concrete flow-ஆ explain பண்ணலாம்.

**HOW IT WORKS IN ADVOCANOTE:**

The hosted upgrade path stores attempt state, links Stripe Checkout, verifies the paid object before applying the new period, and can reconcile attempts in checkout or retiring status on a later pass. Cancellation of the previous contract is a separate action.

**ACTUAL CODE CONNECTION:**

- [app/routers/subscription_experience.py, line 386](../../advocanote-backend/app/routers/subscription_experience.py#L386)
- [app/routers/subscription_experience.py, line 1142](../../advocanote-backend/app/routers/subscription_experience.py#L1142)
- [app/models/payment.py, line 107](../../advocanote-backend/app/models/payment.py#L107)
- [app/routers/stripe_webhooks.py, line 610](../../advocanote-backend/app/routers/stripe_webhooks.py#L610)

**WHY IS IT USED?**

Updating Stripe and MySQL inside one SQL transaction cannot make the provider operation roll back. Durable attempt tracking and recovery make partial success visible. A separate job worker could own retries if stronger isolation is needed.

**POSSIBLE ERRORS AND DEBUGGING:**

In an isolated mock, fake a verified replacement and a transient failure retiring the previous subscription. Observe attempt state and assert retries do not create another replacement or charge. Do not claim a production race was tested without evidence.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“A technically challenging part I can explain is moving from one paid subscription to a replacement. If payment succeeds but retiring the old subscription fails, the app needs to remember what already happened and retry the remaining state transition safely.”

**FOLLOW-UP QUESTION 1:**

Why not retire the old subscription before payment?

**FOLLOW-UP ANSWER 1:**

A decline or abandoned Checkout would remove the previously paid arrangement before a replacement is verified.

**FOLLOW-UP QUESTION 2:**

What signal proves recovery is finished?

**FOLLOW-UP ANSWER 2:**

Verified replacement, reconciled local payment/access dates, and verified retirement of the original subscription.

---

<a id="question-032"></a>

### QUESTION 032 — If 10,000 users access your application simultaneously, what problems might occur, and how would you handle them?

**Sister’s original ID S-D02.**

**COMPLETE ANSWER (English):**

Concurrency is the number of simultaneous operations, not total registrations. Estimate route mix and throughput, then measure request latency, database connection utilization, CPU/RAM, and sustained queue wait. 10,000 connections may be mostly idle or produce a burst of work, with very different resource implications.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

10,000 பேர் register பண்ணிருக்காங்க என்பதும் 10,000 பேர் ஒரே நிமிஷம் audio upload பண்ணுறாங்க என்பதும் வேற. எந்த request அதிகமா வருது என்று முதலில் measure பண்ணணும்.

**HOW IT WORKS IN ADVOCANOTE:**

MySQL and API workers handle ordinary routes. Qwen/Ollama and Faster-Whisper have separate compute profiles. The application starts periodic tasks in lifespan and stores media on a filesystem, which affects multi-instance design.

**ACTUAL CODE CONNECTION:**

- [app/database.py, line 19](../../advocanote-backend/app/database.py#L19)
- [app/main.py, line 93](../../advocanote-backend/app/main.py#L93)
- [app/services/legal_ai.py, line 1195](../../advocanote-backend/app/services/legal_ai.py#L1195)
- [app/routers/voice_ai.py, line 97](../../advocanote-backend/app/routers/voice_ai.py#L97)

**WHY IS IT USED?**

Load-test representative requests before scaling. Add API capacity and tune indexes/pools for measured bottlenecks. Bound and isolate expensive inference with queues if user experience permits. Multi-instance deployment also needs shared or reachable media.

**POSSIBLE ERRORS AND DEBUGGING:**

In isolated staging generate synthetic mixed workload at increasing rates. Plot p95/p99, errors, pool wait, memory and CPU. Stop well before shared resource saturation. No measured capacity is claimed by source inspection alone.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I'd clarify what 10,000 users actually do, then load-test a realistic mix. I would protect ordinary diary and auth traffic from AI and voice spikes, keep DB connections within capacity, and address shared storage and duplicate scheduled work before scaling horizontally.”

**FOLLOW-UP QUESTION 1:**

Why can more API replicas make a database bottleneck worse?

**FOLLOW-UP ANSWER 1:**

Each may open more connections and issue more concurrent queries, creating contention at the shared database.

**FOLLOW-UP QUESTION 2:**

What would you cap first in an AI traffic spike?

**FOLLOW-UP ANSWER 2:**

Measure first, then bound the number of concurrent expensive tasks and queue or reject extra work predictably.

---

<a id="question-033"></a>

### QUESTION 033 — How did you test your application? Explain the difference between unit testing and integration testing.

**Sister’s original ID S-D03.**

**COMPLETE ANSWER (English):**

Unit tests check one unit with dependencies controlled. Integration tests exercise real boundaries between selected modules. Browser end-to-end tests drive a user flow against an intended environment. A mock can prove application behavior under specified responses but cannot prove network delivery or provider behavior.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒரு function தனியா correct-ஆ என்பது unit test. Frontend helper, API, DB சேர்ந்து வேலை செய்கிறதா என்பது integration test. Browser-ல user மாதிரி செய்றது E2E.

**HOW IT WORKS IN ADVOCANOTE:**

Prior isolated OTP-disabled registration work demonstrated a browser reaching the diary route with one session and a 30-day trial. The isolated harness omitted the diary router, so diary data loading was outside that result. The repository has billing scripts, but their presence is not proof of execution during this handbook pass.

**ACTUAL CODE CONNECTION:**

- [test_stripe.py](../../advocanote-backend/test_stripe.py)
- [test_scheduled_yearly.py](../../advocanote-backend/test_scheduled_yearly.py)
- [app/routers/auth.py, line 59](../../advocanote-backend/app/routers/auth.py#L59)
- [app/services/subscription_trial.py, line 118](../../advocanote-backend/app/services/subscription_trial.py#L118)

**WHY IS IT USED?**

Pair fast mocks for rare Stripe and AI failures with isolated integration tests for SQL transaction behavior and targeted E2E for real workflow boundaries.

**POSSIBLE ERRORS AND DEBUGGING:**

Write expected inputs, dependencies and outputs before running. For duplicate invoice events assert counts and identity. For current registration verify user/role and trial period, without reusing production records.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I use unit or mocked tests for deterministic errors, integration tests for database or service interactions, and browser tests for user flows. For example, the isolated auto-login test observed a redirect and trial row. It did not cover diary data or production delivery.”

**FOLLOW-UP QUESTION 1:**

What can a signed-webhook mock prove?

**FOLLOW-UP ANSWER 1:**

It can prove local handling under controlled events and signatures. Real Stripe delivery requires separate evidence.

**FOLLOW-UP QUESTION 2:**

Does SQLite fully reproduce MySQL concurrency?

**FOLLOW-UP ANSWER 2:**

No. Locking, isolation and some schema behavior differ. Use disposable MySQL for MySQL-specific concurrency claims.

---

<a id="question-034"></a>

### QUESTION 034 — If your application suddenly stops working after deployment, how would you identify and troubleshoot the problem?

**Sister’s original ID S-D04.**

**COMPLETE ANSWER (English):**

Start from user impact and the most recent verified change. Distinguish build, deploy, startup, routing, application, and dependency failures. Compare deployed revisions with the expected branch before blaming worktree code. Collect enough evidence to choose a targeted rollback or fix.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

‘Deploy ஆனதும் வேலை செய்யலை’ன்னா முதலில் எந்த screen அல்லது endpoint fail என்று isolate பண்ணுவேன். Browser request, deployed commit, backend logs மூன்றையும் compare பண்ணுவேன்.

**HOW IT WORKS IN ADVOCANOTE:**

Vercel SPA routing, Vite API URL, FastAPI CORS/lifespan and hosted DB are separate layers. Trial access can depend on an eligible lawyer and the official plan row. Plan catalog can be empty because the table has no matching active rows even when registration works.

**ACTUAL CODE CONNECTION:**

- [vercel.json](../../advocanote-frontend/vercel.json)
- [src/services/diary.js, line 2](../../advocanote-frontend/src/services/diary.js#L2)
- [app/main.py, line 78](../../advocanote-backend/app/main.py#L78)
- [app/routers/subscription_experience.py, line 183](../../advocanote-backend/app/routers/subscription_experience.py#L183)
- [app/services/subscription_trial.py, line 82](../../advocanote-backend/app/services/subscription_trial.py#L82)

**WHY IS IT USED?**

A controlled rollback is valuable if an application deploy is proven responsible and the DB remains schema-compatible. Data provisioning and environment changes need their own recovery plan.

**POSSIBLE ERRORS AND DEBUGGING:**

Collect URL/status and safe timestamps, check deployment logs and revision, then inspect data/schema read-only. Simulate fixes in isolated environments. Avoid broad restarts or migrations before identifying the failing boundary.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I start with the failing request and status, compare the running revision and environment names, and inspect logs at the failing layer. If authentication works but plans are empty, I'd verify the catalog API and the actual production database before changing React.”

**FOLLOW-UP QUESTION 1:**

What does an empty array versus 502 suggest?

**FOLLOW-UP ANSWER 1:**

An empty array is an application response. A 502 suggests upstream communication or process availability. Confirm with logs.

**FOLLOW-UP QUESTION 2:**

Could a code rollback fix absent catalog rows?

**FOLLOW-UP ANSWER 2:**

Usually no. A data issue requires evidence and an independently safe data remedy.

---

<a id="question-035"></a>

### QUESTION 035 — If you had another month to improve your project, what technical improvements would you make and why?

**Sister’s original ID S-D05.**

**COMPLETE ANSWER (English):**

Improvements should relate to observed risk, impact, cost, and verification. One month is enough for a few prioritized projects, not unlimited replacements. Good proposals state how success will be measured and distinguish present implementation from future design.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒரு மாதம் கிடைச்சா first confidential data access மற்றும் payment edge cases stable ஆக்குவேன். அதுக்கு என்ன test, என்ன evidence வேணும் என்று முன்பே define பண்ணுவேன்.

**HOW IT WORKS IN ADVOCANOTE:**

The local source has ownership guards, a payment attempt history, and an in-process retry/scheduler path. Architecture evidence supports proposed work on tests, monitoring and storage. Hosted readiness still requires its own verification.

**ACTUAL CODE CONNECTION:**

- [app/auth/security.py, line 54](../../advocanote-backend/app/auth/security.py#L54)
- [app/routers/subscription_experience.py, line 1142](../../advocanote-backend/app/routers/subscription_experience.py#L1142)
- [app/routers/voice_storage.py, line 52](../../advocanote-backend/app/routers/voice_storage.py#L52)

**WHY IS IT USED?**

Prioritize owner-isolation tests and Stripe renewal/recovery coverage, then verify backups/media restores and add safe metrics. Dedicated compute or queue work is conditional on measured contention.

**POSSIBLE ERRORS AND DEBUGGING:**

Track outcome evidence: cross-owner denials, verified provider/database reconciliation, restore checksums, and p95 for AI vs diary requests. Prefer isolated staging and sanitized fixtures.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I'd focus on proof before adding features: integration tests for access isolation, verified payment reconciliation and trial logic, then a full backup-and-restore exercise and better monitoring. I'd separate AI compute only if profiling shows contention.”

**FOLLOW-UP QUESTION 1:**

Why prioritize restore drills over more backup jobs?

**FOLLOW-UP ANSWER 1:**

A backup is useful only if data, files and references can be restored in time and verified.

**FOLLOW-UP QUESTION 2:**

What would you use as a billing success metric?

**FOLLOW-UP ANSWER 2:**

Rate of verified payment-to-entitlement reconciliation, including age of unresolved attempts, without logging sensitive data.

---

<a id="question-036"></a>

### QUESTION 036 — How do you handle large files or image uploads?

**Sister’s original ID S-E01.**

**COMPLETE ANSWER (English):**

Large uploads should be bounded, validated and stored without holding unnecessary bytes in memory. A declared extension or Content-Type can be misleading. An image decoder can validate content and apply dimensions/format limits; a media pipeline needs separate controls for byte size and decoding cost.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Audio file-ஐ கொஞ்சம் கொஞ்சமா read பண்ணலாம். Limit மீறினா நிறுத்தணும். Image என்ற பெயர் மட்டும் பார்த்து அது safe image என்று முடிவு செய்யக்கூடாது.

**HOW IT WORKS IN ADVOCANOTE:**

Voice storage reads chunks and checks a 20 MiB limit before saving the attachment. The profile route reads up to its configured max plus one byte and uses the image service. Transcription has its own temp-file path and validation.

**ACTUAL CODE CONNECTION:**

- [app/routers/voice_storage.py, line 55](../../advocanote-backend/app/routers/voice_storage.py#L55)
- [app/routers/voice_storage.py, line 302](../../advocanote-backend/app/routers/voice_storage.py#L302)
- [app/routers/profile.py, line 50](../../advocanote-backend/app/routers/profile.py#L50)
- [app/services/profile_photo_service.py, line 22](../../advocanote-backend/app/services/profile_photo_service.py#L22)

**WHY IS IT USED?**

Direct-to-object-storage uploads can reduce API bandwidth but require signed upload policy and ownership checks. Current private filesystem storage is simpler and needs persistent storage for deployment.

**POSSIBLE ERRORS AND DEBUGGING:**

Use disposable audio/image fixtures at the size limit and one byte above it, plus a malformed file. Verify no orphan file/row remains on expected failure. Do not use private legal recordings.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I use bounded uploads. Voice data is read in chunks and limited, while the profile route bounds its read and validates the image. Large upload handling also includes permissions and consistency between saved files and metadata.”

**FOLLOW-UP QUESTION 1:**

Does setting a file-size limit alone stop decompression or decoder pressure?

**FOLLOW-UP ANSWER 1:**

No. A small compressed object can decode into a much larger representation. Bound dimensions, processing time and concurrency.

**FOLLOW-UP QUESTION 2:**

Why check ownership before private playback?

**FOLLOW-UP ANSWER 2:**

Storage location alone cannot tell whether the current caller is entitled to the file.

---

<a id="question-037"></a>

### QUESTION 037 — How would you scale your application to support one million users?

**Sister’s original ID S-E02.**

**COMPLETE ANSWER (English):**

One million accounts tells little about active throughput. Capacity planning starts with active-user estimates, daily and peak requests, service-level goals, and route costs. Vertical scaling increases resources per node; horizontal scaling increases service instances and requires coordination of shared state.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒரு million account இருந்தாலும் எல்லாரும் ஒரே நேரத்தில் app open பண்ண மாட்டாங்க. எத்தனை active users, எந்த routes அதிகம், audio/AI rate என்ன என்று estimate பண்ணணும்.

**HOW IT WORKS IN ADVOCANOTE:**

Diary queries are SQL reads; AI and voice use potentially expensive separate compute. Media files and admin SQLite create storage constraints. A process-bound scheduler can run in every backend process.

**ACTUAL CODE CONNECTION:**

- [app/database.py, line 19](../../advocanote-backend/app/database.py#L19)
- [app/main.py, line 93](../../advocanote-backend/app/main.py#L93)
- [app/routers/voice_storage.py, line 52](../../advocanote-backend/app/routers/voice_storage.py#L52)
- [admin_notifications_api.py, line 30](../../advocanote-backend/admin_notifications_api.py#L30)

**WHY IS IT USED?**

A future design could separate inference, use object storage for binaries, add read/query optimization, then scale stateless API work. Adopt distributed techniques after identifying a measured bottleneck.

**POSSIBLE ERRORS AND DEBUGGING:**

Use staged synthetic load, query timings, percentile latency, memory, pool and error metrics. Test recovery and cross-instance file serving before a real rollout.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I would size by active traffic and route mix, not by total accounts. I would keep diary and auth responsive, isolate expensive media/AI work, and make media, scheduler and data access safe across replicas.”

**FOLLOW-UP QUESTION 1:**

How would you rate-limit workloads fairly?

**FOLLOW-UP ANSWER 1:**

Design quotas by actor and operation cost, enforce them at a shared or authoritative boundary, and return predictable errors.

**FOLLOW-UP QUESTION 2:**

Would you shard MySQL first?

**FOLLOW-UP ANSWER 2:**

No. Measure indexing, query cost, connection capacity and operational complexity before adding sharding.

---

<a id="question-038"></a>

### QUESTION 038 — What happens if the user refreshes the page while a form is being submitted?

**Sister’s original ID S-E03.**

**COMPLETE ANSWER (English):**

Refreshing destroys the current page and in-memory form state. An in-flight browser request may be interrupted, but the server may already be processing or have committed it. Browser disappearance is not proof of rollback. Durable operation identifiers help clients determine the outcome.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Refresh அடிச்சா form state போயிடலாம். ஆனா request backend-க்கு ஏற்கெனவே போயிருந்தா record save ஆகியிருக்கலாம்.

**HOW IT WORKS IN ADVOCANOTE:**

Register.jsx tracks form/loading in React state. Ordinary Checkout has a pending reservation and a separate status route. Registration responses and database outcomes need separate observation.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 219](../../advocanote-frontend/src/pages/Register.jsx#L219)
- [app/routers/lawyer_subscriptions.py, line 377](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L377)
- [app/routers/lawyer_subscriptions.py, line 948](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L948)

**WHY IS IT USED?**

Persist non-sensitive drafts where appropriate. Don't persist passwords in draft storage. For critical writes provide idempotency or an owned status lookup and clear recovery UX.

**POSSIBLE ERRORS AND DEBUGGING:**

In an isolated test refresh during a deliberately delayed submit, then inspect server rows and status. Verify that a retry does not accidentally duplicate a durable operation.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“The page can lose its inputs and pending UI state on refresh, while the backend may still finish. I'd check the durable outcome before retrying. Checkout uses a tracked attempt to support this kind of recovery.”

**FOLLOW-UP QUESTION 1:**

Does AbortController undo a MySQL commit?

**FOLLOW-UP ANSWER 1:**

No. It can stop waiting or cancel a browser request, but it doesn't reverse a server commit.

**FOLLOW-UP QUESTION 2:**

What data would you avoid placing in browser draft storage?

**FOLLOW-UP ANSWER 2:**

Passwords, credentials, and private legal data unless a deliberate storage policy permits it.

---

<a id="question-039"></a>

### QUESTION 039 — How do you prevent a user from submitting the same form multiple times?

**Sister’s original ID S-E04.**

**COMPLETE ANSWER (English):**

Duplicate submits can originate from repeated clicks, browser retries, multiple tabs, multiple processes, or an ambiguous response. Disable repeated UI actions for clarity; enforce operation identity and state transitions server-side for correctness.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Button disable பண்ணினா accidental double click குறையும். ஆனா இரண்டு tabs ஒரே time request அனுப்பினா server-லும் protection வேணும்.

**HOW IT WORKS IN ADVOCANOTE:**

Registration tracks loading and disables the button. Checkout instead also uses a database lock, persisted reservation and provider-side idempotency. Registration's email identity has its own duplicate checking and constraints.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 360](../../advocanote-frontend/src/pages/Register.jsx#L360)
- [src/pages/Register.jsx, line 699](../../advocanote-frontend/src/pages/Register.jsx#L699)
- [app/services/auth.py, line 33](../../advocanote-backend/app/services/auth.py#L33)
- [app/routers/lawyer_subscriptions.py, line 391](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L391)
- [app/routers/lawyer_subscriptions.py, line 779](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L779)

**WHY IS IT USED?**

Use a unique account identity for registration and a scoped operation key for payments. Make failure/retry behavior explicit. A general global request hash is too broad.

**POSSIBLE ERRORS AND DEBUGGING:**

Test double-click, two tabs and a simulated lost response. Assert public result, database row count and mocked provider call count rather than trusting the spinner.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I disable the button while submitting, but use server-side invariants for real protection. For Stripe Checkout I reserve the operation under a database lock and use a stable idempotency key, so repeat requests can reuse the intended attempt.”

**FOLLOW-UP QUESTION 1:**

Can debouncing replace a unique constraint?

**FOLLOW-UP ANSWER 1:**

No. Debouncing helps one browser instance; concurrent clients still need server enforcement.

**FOLLOW-UP QUESTION 2:**

Why should retry return useful state?

**FOLLOW-UP ANSWER 2:**

The first request may have succeeded even if the client never saw the response.

---

<a id="question-040"></a>

### QUESTION 040 — Show one bug you fixed and explain how you identified and resolved it.

**Sister’s original ID S-E05.**

**COMPLETE ANSWER (English):**

A credible bug report identifies an observed symptom, root cause, targeted change and regression evidence. AdvocaNote provides a source-trace example in delayed first-payment recovery: a Stripe subscription's newest invoice can be a renewal, while the initial payment must be reconciled with the Checkout Session's own invoice.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

First payment-ஐ verify பண்ணும்போது latest invoice எடுத்தா அது renewal-ஆ இருக்கலாம். First Checkout invoice-வே correct evidence.

**HOW IT WORKS IN ADVOCANOTE:**

The webhook recovery path checks the Checkout Session's invoice ID against the paid invoice event before passing the verified invoice into initial Checkout processing. The code is evidence of the fix shape. This handbook pass did not rerun Stripe or claim a personal debugging history.

**ACTUAL CODE CONNECTION:**

- [app/routers/stripe_webhooks.py, line 1918](../../advocanote-backend/app/routers/stripe_webhooks.py#L1918)
- [app/routers/stripe_webhooks.py, line 1972](../../advocanote-backend/app/routers/stripe_webhooks.py#L1972)
- [app/routers/stripe_webhooks.py, line 1989](../../advocanote-backend/app/routers/stripe_webhooks.py#L1989)
- [app/routers/stripe_webhooks.py, line 752](../../advocanote-backend/app/routers/stripe_webhooks.py#L752)

**WHY IS IT USED?**

Use the invoice tied to the owned Checkout Session. An explicitly stored verified original invoice ID can also support reconciliation. Looking up a mutable latest_invoice pointer cannot establish historical identity.

**POSSIBLE ERRORS AND DEBUGGING:**

Build a mocked fixture where original invoice is in_initial and the subscription's latest invoice is in_renewal. Assert first payment keeps in_initial, and a replay creates no duplicate rows. Include ordinary renewal handling as a separate case.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“One bug involved delayed initial Checkout recovery. The subscription could have renewed, so latest invoice was the wrong identity. The handler now verifies the event against the original Checkout invoice. I would demonstrate it with two distinct invoice IDs and check the recorded first payment.”

**FOLLOW-UP QUESTION 1:**

Why is matching the amount insufficient?

**FOLLOW-UP ANSWER 1:**

Two valid monthly invoices can have the same amount. Invoice identity and ownership still matter.

**FOLLOW-UP QUESTION 2:**

Should a paid renewal activate an unrelated pending initial attempt?

**FOLLOW-UP ANSWER 2:**

No. Each handler must validate the correct purpose, subscription identifiers and invoice linkage.

---

<a id="question-041"></a>

### QUESTION 041 — How do you manage code versions when multiple developers work on the same project?

**Sister’s original ID S-E06.**

**COMPLETE ANSWER (English):**

A team Git workflow keeps changes reviewable and traceable. Typical steps are synchronize refs, create a focused branch, stage intentional files, commit coherent changes, push the branch if authorized, open review, and merge per repository policy. This describes a workflow without inventing team history.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒவ்வொருத்தரும் main-ல direct edit பண்றதுக்குப் பதிலா feature branch-ல வேலை பண்ணலாம். Diff review பண்ணி test results பார்த்த பிறகு merge.

**HOW IT WORKS IN ADVOCANOTE:**

A prior isolated AdvocaNote registration patch used a temporary branch at a verified main commit while preserving local OTP edits. No production push or deployment was part of that preparation. This is a concrete example of scope isolation.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 237](../../advocanote-frontend/src/pages/Register.jsx#L237)

**WHY IS IT USED?**

Small changes and review help prevent unrelated migrations or secrets from being included. Merge, rebase, and squash are options depending on project policy and branch ownership.

**POSSIBLE ERRORS AND DEBUGGING:**

Before staging inspect status and the full diff, then check the staged diff and file list again. If automatic deployment exists, confirm branch triggers before GitHub writes.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I use focused branches and review the actual diff. For the registration auto-login patch I isolated Register.jsx from uncommitted OTP work. Before merging I would verify test results, staged files and deployment impact.”

**FOLLOW-UP QUESTION 1:**

Why inspect both unstaged and staged diffs?

**FOLLOW-UP ANSWER 1:**

They cover different snapshots. A file may have a staged version and additional unstaged changes.

**FOLLOW-UP QUESTION 2:**

Why avoid rebasing shared branches without coordination?

**FOLLOW-UP ANSWER 2:**

Rebase rewrites commit IDs, which can disrupt others' references and branches.

---

<a id="question-042"></a>

### QUESTION 042 — Did you experience merge conflicts? Explain how you resolved them

**Sister’s original ID S-E07.**

**COMPLETE ANSWER (English):**

A merge conflict occurs when Git cannot automatically reconcile divergent changes. Resolve by understanding both intended behaviors, editing the conflict into a correct combined result, running targeted tests, staging the resolution and completing the merge or rebase. No personal conflict experience is established by source inspection.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

இரண்டு branches ஒரே code பகுதியை வெவ்வேற மாதிரி மாற்றினா Git தானா combine பண்ண முடியாம இருக்கலாம். இரண்டு changes-ன் நோக்கமும் புரிஞ்சுட்டு final code எழுதணும்.

**HOW IT WORKS IN ADVOCANOTE:**

Register.jsx is a plausible example: isolated auto-login and local OTP logic can touch the same submit handler. A safe combined design must preserve the OTP-pending branch and authenticate only with a valid session in the appropriate path.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 237](../../advocanote-frontend/src/pages/Register.jsx#L237)
- [src/pages/Register.jsx, line 365](../../advocanote-frontend/src/pages/Register.jsx#L365)

**WHY IS IT USED?**

Prefer smaller changes and explicit integration tests. Choosing ours or theirs can be correct only after understanding what it discards. Resolve on a safe branch, with existing work preserved.

**POSSIBLE ERRORS AND DEBUGGING:**

Use git status and inspect base/ours/theirs versions. Verify no conflict markers remain. Run both OTP-disabled and OTP-enabled paths in an isolated environment before any integration.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“A merge conflict means Git needs a human to combine edits. I'd inspect both changes and preserve their requirements, then test both branches of the registration flow. I'd discuss a specific conflict only if I personally have evidence for it.”

**FOLLOW-UP QUESTION 1:**

Can a conflict-free merge still be wrong?

**FOLLOW-UP ANSWER 1:**

Yes. Edits in separate lines can still conflict semantically, so behavior tests matter.

**FOLLOW-UP QUESTION 2:**

What is a three-way merge?

**FOLLOW-UP ANSWER 2:**

It compares both branch versions with their common base to identify independent changes and conflicts.

---

<a id="question-043"></a>

### QUESTION 043 — What would happen if one of your main features stopped working?

**Sister’s original ID S-E09.**

**COMPLETE ANSWER (English):**

Failure impact depends on the failed dependency and whether the path supports degraded operation. Fail closed for authorization or payment verification decisions. Preserve available workflows where safe, communicate what failed, and recover without inventing state.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Ollama down ஆனா AI analysis fail ஆகலாம். ஆனா manual diary save AI success-ஐ கட்டாயமாகக் கேட்கிறதா என்று code பார்த்து முடிவு பண்ணணும்.

**HOW IT WORKS IN ADVOCANOTE:**

Diary analysis fields are optional in the diary schema. AI analysis has its own service path, so manual data entry can remain a meaningful fallback. Stripe payment verification must be completed before paid access can be granted.

**ACTUAL CODE CONNECTION:**

- [app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)
- [app/routers/voice_ai.py, line 247](../../advocanote-backend/app/routers/voice_ai.py#L247)
- [app/services/legal_ai.py, line 1246](../../advocanote-backend/app/services/legal_ai.py#L1246)
- [app/routers/stripe_webhooks.py, line 610](../../advocanote-backend/app/routers/stripe_webhooks.py#L610)

**WHY IS IT USED?**

Isolate external dependency timeouts and avoid unnecessary coupling between optional work and core operations. A durable job queue can help for asynchronous, retryable steps.

**POSSIBLE ERRORS AND DEBUGGING:**

Find failing endpoints and affected user groups. Compare read-only logs and request times. Test degraded mode with mocked provider errors and assert access rules remain enforced.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I'd identify which dependency failed and what user actions depend on it. Manual diary can be a fallback when AI fails. Payment verification is different: I keep paid access unchanged until verified state is available.”

**FOLLOW-UP QUESTION 1:**

Why fail closed for billing while allowing a manual diary fallback?

**FOLLOW-UP ANSWER 1:**

The consequences differ. Optional analysis can degrade; entitlement requires reliable proof.

**FOLLOW-UP QUESTION 2:**

What should the UI preserve during an optional analysis error?

**FOLLOW-UP ANSWER 2:**

Preserve editable original user input and clearly indicate which derived output is unavailable.

---

<a id="question-044"></a>

### QUESTION 044 — What improvements would you make if you had another month?

**Sister’s original ID S-E10.**

**COMPLETE ANSWER (English):**

A one-month improvement plan should rank operational risk, user effect and effort. The strongest answer gives deliverables and acceptance checks rather than generic goals. The proposals are future improvements, not claims already implemented.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒரு மாதம் கிடைச்சா இரண்டு அல்லது மூன்று measurable improvements choose பண்ணுவேன். Example: payment replay test, cross-lawyer access test, backup restore verification.

**HOW IT WORKS IN ADVOCANOTE:**

AdvocaNote combines a paid-access boundary, private owned media and several data stores. That makes verified subscription replay behavior, permission tests and restore coverage high-value decisions to discuss in a viva.

**ACTUAL CODE CONNECTION:**

- [app/routers/voice_storage.py, line 159](../../advocanote-backend/app/routers/voice_storage.py#L159)
- [app/routers/stripe_webhooks.py, line 1918](../../advocanote-backend/app/routers/stripe_webhooks.py#L1918)
- [admin_notifications_api.py, line 30](../../advocanote-backend/admin_notifications_api.py#L30)

**WHY IS IT USED?**

Start with security and consistency tests. Add sanitized operational metrics next. A rewrite has higher risk and less immediate evidence unless current boundaries are proven unworkable.

**POSSIBLE ERRORS AND DEBUGGING:**

Write acceptance criteria such as no duplicated invoice row, no unauthorized audio body, successfully reopened restored file with a verified checksum, and elapsed restore time within a chosen target.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I'd use the month to make existing features easier to trust. I'd add focused tests for access and billing races, then run a full MySQL/media/SQLite restore drill and set up safe diagnostics. I'd defer architectural changes until metrics justify them.”

**FOLLOW-UP QUESTION 1:**

How would you prove progress after one week?

**FOLLOW-UP ANSWER 1:**

Show a tested failure case with a reproducible outcome and clear evidence from the relevant boundary.

**FOLLOW-UP QUESTION 2:**

Why select a small number of improvements?

**FOLLOW-UP ANSWER 2:**

Each one needs implementation, tests and measurement. Fewer focused changes reduce risk.

---

<a id="question-045"></a>

### QUESTION 045 — Where did you deploy your project?

**Sister’s original ID S-E11.**

**COMPLETE ANSWER (English):**

Deployment serves a built artifact and a running application. A JavaScript host serves the React bundle to browsers, while an API host runs FastAPI. A database and other integrations can be hosted or separately networked. Repository configuration and active deployment evidence answer different questions.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Frontend Vercel-ல browser-க்கு கிடைக்கும். Backend Railway-ல API requests handle பண்ணும். Backend தான் MySQL-கிட்ட பேசும்.

**HOW IT WORKS IN ADVOCANOTE:**

Reported deployment is Vercel frontend and Railway backend with MySQL. vercel.json has SPA rewrite. The diary helper uses configurable API URL with a production HTTPS fallback. main.py defines CORS and app routes.

**ACTUAL CODE CONNECTION:**

- [vercel.json](../../advocanote-frontend/vercel.json)
- [src/services/diary.js, line 2](../../advocanote-frontend/src/services/diary.js#L2)
- [app/main.py, line 129](../../advocanote-backend/app/main.py#L129)
- [app/database.py, line 7](../../advocanote-backend/app/database.py#L7)

**WHY IS IT USED?**

This separation supports static hosting and independent API deployment. Same-origin proxying or a unified service is another possible arrangement with different build and CORS tradeoffs.

**POSSIBLE ERRORS AND DEBUGGING:**

Verify live service metadata, an expected deployed commit, frontend Request URL, response status and CORS header. Source alone cannot prove active versions or availability.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“My reported setup is React/Vite on Vercel and FastAPI on Railway, with MySQL accessed by the backend. I can point to the SPA rewrite and API base configuration. I would verify the running revisions and connectivity separately before a demo.”

**FOLLOW-UP QUESTION 1:**

Where should DB credentials live?

**FOLLOW-UP ANSWER 1:**

In the backend's protected environment or secret store, not Vite public variables.

**FOLLOW-UP QUESTION 2:**

Why can a front-end redeploy be needed after updating a Vite variable?

**FOLLOW-UP ANSWER 2:**

Vite exposes those variables while building the static browser bundle.

---

<a id="question-046"></a>

### QUESTION 046 — What is the difference between a development build and a production build?

**Sister’s original ID S-E12.**

**COMPLETE ANSWER (English):**

A development server favors fast iteration with source transforms and hot module replacement. A production build produces optimized static assets and embeds build-time environment branches. Production behavior depends on the host's rewrites, API endpoint and shipped bundle, as well as source code.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Development-ல் save பண்ண உடனே change பார்க்கலாம். Production-ல் build பண்ணிய files deploy ஆகும். Browser அந்த compiled files தான் load பண்ணும்.

**HOW IT WORKS IN ADVOCANOTE:**

package.json has vite dev, build and preview scripts. Frontend request code selects a production or development fallback based on import.meta.env.PROD. vercel.json handles client-route refreshes.

**ACTUAL CODE CONNECTION:**

- [package.json](../../advocanote-frontend/package.json)
- [src/services/diary.js, line 2](../../advocanote-frontend/src/services/diary.js#L2)
- [vercel.json](../../advocanote-frontend/vercel.json)

**WHY IS IT USED?**

Build locally for early detection and preview a production artifact in an isolated environment. Public frontend variables must be treated as visible in the bundle.

**POSSIBLE ERRORS AND DEBUGGING:**

Compare dev and production request URLs, check asset 404 or Console logs, and test direct SPA route navigation. Don't assume changing a backend variable rebuilds the frontend.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“Vite dev is for fast local feedback. vite build produces optimized assets for production. In AdvocaNote the built environment can select a different API host, so I check production navigation and network calls separately.”

**FOLLOW-UP QUESTION 1:**

Does vite preview replace a real production smoke test?

**FOLLOW-UP ANSWER 1:**

No. It helps test a local production build but may not reproduce hosted routing, CORS or configuration.

**FOLLOW-UP QUESTION 2:**

Can VITE_ variables safely hold privileged secrets?

**FOLLOW-UP ANSWER 2:**

No. Browser bundles expose public build-time values.

---

<a id="question-047"></a>

### QUESTION 047 — What is middleware?

**Sister’s original ID S-E13.**

**COMPLETE ANSWER (English):**

Middleware wraps HTTP processing across requests. It can inspect or modify request and response behavior, add headers, log timing, or handle a preflight before a normal handler. A FastAPI dependency provides values or policies at a route/router boundary.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Request route function-க்கு போறதுக்கு முன்னும், response வெளிய போறதுக்கு முன்னும் common work செய்யும் layer middleware.

**HOW IT WORKS IN ADVOCANOTE:**

FastAPI CORSMiddleware handles cross-origin behavior. Diary's onboarding dependency is attached to the router mount and serves a different purpose. Identity comes through dependencies and guards.

**ACTUAL CODE CONNECTION:**

- [app/main.py, line 132](../../advocanote-backend/app/main.py#L132)
- [app/main.py, line 154](../../advocanote-backend/app/main.py#L154)
- [app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py)

**WHY IS IT USED?**

Use middleware for cross-cutting HTTP behavior. Use Depends for business rules, the current user, or a DB session that varies with the selected endpoint.

**POSSIBLE ERRORS AND DEBUGGING:**

For CORS inspect request Origin, preflight and response headers. For an onboarding rejection inspect the route dependency result and protected state. Middleware order can affect error responses.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“Middleware sits around request processing. AdvocaNote uses it for CORS. Authentication, onboarding and database session rules are route dependencies so they can apply precisely where needed.”

**FOLLOW-UP QUESTION 1:**

Does every request reach the route handler?

**FOLLOW-UP ANSWER 1:**

No. Middleware can finish a request, and dependency or input validation can reject before the handler.

**FOLLOW-UP QUESTION 2:**

Can CORS middleware verify a lawyer owns a case?

**FOLLOW-UP ANSWER 2:**

No. Ownership is a backend business rule, normally checked using the current user and resource.
