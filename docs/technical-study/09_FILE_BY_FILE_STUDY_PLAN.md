# 09 · File-by-file study plan

Use this order and explain one complete request aloud before moving to the next topic. Each source entry below gives the exact path, import links and available declarations with line references. It is a source index, so dynamically assembled URLs, callback props, late imports and app-level dependencies also require reading the feature chapters. An empty importer list means no static match in this inventory, not proof that deleting the file is safe.

| Pass | Open first | What to explain | What can go wrong |
|---|---|---|---|
| 1 · Route a request | [App.jsx](../../advocanote-frontend/src/App.jsx), [main.py](../../advocanote-backend/app/main.py), [database.py](../../advocanote-backend/app/database.py) | URL selection → mounted endpoint → injected dependencies → session. | Reading a file as an active endpoint when startup does not include its router. |
| 2 · Trace identity | [Login.jsx](../../advocanote-frontend/src/pages/Login.jsx), [auth service](../../advocanote-backend/app/services/auth.py), [security guard](../../advocanote-backend/app/auth/security.py) | Password hash versus refresh hash versus access JWT; revoke and expiry. | Treating client role UI or a JWT as sufficient after account/session revocation. |
| 3 · Save one diary entry | [AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx), [diary.py](../../advocanote-backend/app/routers/diary.py#L224), [quota](../../advocanote-backend/app/services/subscription_usage.py#L93) | Follow the submitted DTO and owner IDs. Identify flush, quota, optional children and commit. | Foreign record IDs, repeated submissions, quota limit, a failed upload after the entry was saved. |
| 4 · Read related objects | [cases](../../advocanote-backend/app/routers/cases.py), [hearings](../../advocanote-backend/app/routers/hearings.py), [tasks](../../advocanote-backend/app/routers/tasks.py), [calendar](../../advocanote-backend/app/routers/calendar.py), [notifications](../../advocanote-backend/app/routers/notifications.py) | Explain why the calendar joins domain data and why reminders have separate read state. | Authorization gaps in assumptions, stale dates, orphan children or mismatched statuses. |
| 5 · Analyze and transcribe | [voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [legal_ai.py](../../advocanote-backend/app/services/legal_ai.py), [voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py) | Split model input/output from accepted facts and database persistence. | Model timeout, missing weights, codec, bad JSON, insufficient evidence, attachment failure. |
| 6 · Understand billing | [trial](../../advocanote-backend/app/services/subscription_trial.py), [Checkout](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [upgrade recovery](../../advocanote-backend/app/routers/subscription_experience.py), [webhooks](../../advocanote-backend/app/routers/stripe_webhooks.py) | Compare local subscription ID, Stripe subscription, Price, invoice, session and attempt. | Retrying a charge, stale status, misreading a legacy rate, accepting a redirect as payment. |
| 7 · Admin and schema | [AdminLayout](../../advocanote-frontend/src/admin/AdminLayout.jsx), [admin subscriptions](../../advocanote-backend/app/routers/admin_subscriptions.py), [admin notifications](../../advocanote-backend/admin_notifications_api.py), [migrations](../../advocanote-backend/migrations/versions/) | Distinguish staff roles, provider billing state, model definitions and applied DDL. | Admin-only route leaks, provider object incompatibility, missing migrations or separate SQLite storage. |

## Source and connection indexes

- [Frontend source inventory](02_FRONTEND_COMPLETE_GUIDE.md) includes declarations, hooks and request call sites.
- [Backend route inventory](03_BACKEND_COMPLETE_GUIDE.md) includes decorator paths and mounted/legacy distinctions.
- [Database field and migration inventory](04_DATABASE_AND_RELATIONSHIPS.md) explains schemas, constraints and revision dependencies.
- Questions with spoken examples appear in [chapter 10](10_TECHNICAL_VIVA_QA.md).

## Checkpoint for disconnected and duplicate paths

- `App.jsx` mounts the active top-level page set. Files such as CaseDetails or CaseTasks may be embedded or unused depending on actual importers listed below. A filename saying Premium is not a role guard.
- `subscription_billing.py` overlaps active subscription endpoints and `google_recovery.py` declares a route, but neither was found in `main.py` mounts. Check active callers and model names before drawing conclusions from either.
- Root and backend `stripe_webhooks_backup.py` are separate source snapshots, not the mounted webhook implementation. Files named `test_*.py`, `voice_ai_test.py` or `ai_model_test.py` are study/support utilities. Do not import or execute them blindly: some hit real configured services.
- Storage is split across MySQL, a separate SQLite admin-notification file, and filesystem media.
- [Chapter 06](06_SUBSCRIPTIONS_AND_PAYMENTS.md) records concrete billing edge cases. [Chapter 05](05_AI_AND_VOICE.md) distinguishes available AI output fields from empty follow-up output and human approval.

## Backend file-by-file index

### admin_notifications_api.py

[D:/AdvocaNote/advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py)

Separate SQLite admin-notification store and router factory. **If removed:** Admin notification routes and event producers lose their store.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `json`, `os`, `pathlib`, `pydantic`, `sqlite3`
- **Declarations and study starting lines:** [get_connection()](../../advocanote-backend/admin_notifications_api.py#L30), [init_notifications_db()](../../advocanote-backend/admin_notifications_api.py#L39), [create_admin_notification(type, title, message, details)](../../advocanote-backend/admin_notifications_api.py#L68), [create_admin_notification_once(type, title, message, details, unique_detail_key)](../../advocanote-backend/admin_notifications_api.py#L109), [notify_free_trial_started(user, subscription)](../../advocanote-backend/admin_notifications_api.py#L183), [format_notification(row)](../../advocanote-backend/admin_notifications_api.py#L219), [DeleteSelectedRequest](../../advocanote-backend/admin_notifications_api.py#L235), [create_notifications_router(get_current_user)](../../advocanote-backend/admin_notifications_api.py#L247), [notify_lawyer_status_changed(lawyer, previous_is_active)](../../advocanote-backend/admin_notifications_api.py#L446)

### ai_model_test.py

[D:/AdvocaNote/advocanote-backend/ai_model_test.py](../../advocanote-backend/ai_model_test.py)

Test or environment support for ai model test. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `json`, `ollama`
- **Declarations and study starting lines:** No static match.

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/__init__.py](../../advocanote-backend/app/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/auth/__init__.py](../../advocanote-backend/app/auth/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### admin_guard.py

[D:/AdvocaNote/advocanote-backend/app/auth/admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py)

Backend access check related to admin guard. **If removed:** Routes using the guard lose the corresponding boundary.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py)
- **External or unresolved imports:** `fastapi`
- **Declarations and study starting lines:** [require_admin(current_user)](../../advocanote-backend/app/auth/admin_guard.py#L8)

### onboarding_guard.py

[D:/AdvocaNote/advocanote-backend/app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py)

Backend access check related to onboarding guard. **If removed:** Routes using the guard lose the corresponding boundary.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py)
- **External or unresolved imports:** `fastapi`
- **Declarations and study starting lines:** [require_onboarding_complete(user)](../../advocanote-backend/app/auth/onboarding_guard.py#L7)

### security.py

[D:/AdvocaNote/advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py)

Password hashing, access JWT, and DB-backed session verification. **If removed:** Protected APIs cannot authenticate callers.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/auth/admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py), [advocanote-backend/app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py), [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py), [advocanote-backend/app/routers/subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `fastapi.security`, `jwt`, `pwdlib`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [hash_password(password)](../../advocanote-backend/app/auth/security.py#L20), [verify_password(password, hashed_password)](../../advocanote-backend/app/auth/security.py#L24), [create_access_token(user_id, session_id)](../../advocanote-backend/app/auth/security.py#L31), [get_current_user(credentials, db)](../../advocanote-backend/app/auth/security.py#L54)

### subscription_guard.py

[D:/AdvocaNote/advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py)

Backend access check related to subscription guard. **If removed:** Routes using the guard lose the corresponding boundary.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py), [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [is_subscription_valid(subscription, now)](../../advocanote-backend/app/auth/subscription_guard.py#L21), [plan_has_feature(plan, feature_name)](../../advocanote-backend/app/auth/subscription_guard.py#L51), [require_feature(feature_name)](../../advocanote-backend/app/auth/subscription_guard.py#L69)

### config.py

[D:/AdvocaNote/advocanote-backend/app/config.py](../../advocanote-backend/app/config.py)

Typed backend integration settings. **If removed:** Startup cannot construct configured provider clients.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/email.py](../../advocanote-backend/app/services/email.py), [advocanote-backend/app/services/google.py](../../advocanote-backend/app/services/google.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [advocanote-backend/test_stripe.py](../../advocanote-backend/test_stripe.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `pathlib`, `pydantic_settings`
- **Declarations and study starting lines:** [Settings](../../advocanote-backend/app/config.py#L9)

### database.py

[D:/AdvocaNote/advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)

MySQL engine, declarative metadata and session lifecycle. **If removed:** Queries and mapped models lose their database integration.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py)
- **Static importers:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/models/account_deletion.py](../../advocanote-backend/app/models/account_deletion.py), [advocanote-backend/app/models/account_recovery_token.py](../../advocanote-backend/app/models/account_recovery_token.py), [advocanote-backend/app/models/aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py), [advocanote-backend/app/models/calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py), [advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py), [advocanote-backend/app/models/court.py](../../advocanote-backend/app/models/court.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py), [advocanote-backend/app/models/reset.py](../../advocanote-backend/app/models/reset.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/models/verification.py](../../advocanote-backend/app/models/verification.py), [advocanote-backend/app/models/voice_attachment.py](../../advocanote-backend/app/models/voice_attachment.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py), [advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py), [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py), [advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py), [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [Base](../../advocanote-backend/app/database.py#L31), [get_db()](../../advocanote-backend/app/database.py#L35)

### main.py

[D:/AdvocaNote/advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)

Application entry point and integration composition. **If removed:** The corresponding browser or API process loses its normal starting point.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py), [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/__init__.py](../../advocanote-backend/app/routers/__init__.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py), [advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py), [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py), [advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py), [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py), [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)
- **Static importers:** [advocanote-backend/check_dependencies.py](../../advocanote-backend/check_dependencies.py)
- **External or unresolved imports:** `asyncio`, `contextlib`, `fastapi`, `fastapi.middleware.cors`, `sqlalchemy`
- **Declarations and study starting lines:** [upgrade_reminders_table()](../../advocanote-backend/app/main.py#L37), [lifespan(app)](../../advocanote-backend/app/main.py#L76), [home()](../../advocanote-backend/app/main.py#L199)

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/models/__init__.py](../../advocanote-backend/app/models/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### account_deletion.py

[D:/AdvocaNote/advocanote-backend/app/models/account_deletion.py](../../advocanote-backend/app/models/account_deletion.py)

SQLAlchemy persistence mapping for account deletion. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/models/account_deletion.py#L10), [AccountDeletion](../../advocanote-backend/app/models/account_deletion.py#L14)

### account_recovery_token.py

[D:/AdvocaNote/advocanote-backend/app/models/account_recovery_token.py](../../advocanote-backend/app/models/account_recovery_token.py)

SQLAlchemy persistence mapping for account recovery token. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/models/account_recovery_token.py#L15), [AccountRecoveryToken](../../advocanote-backend/app/models/account_recovery_token.py#L21)

### aisuggestion.py

[D:/AdvocaNote/advocanote-backend/app/models/aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py)

SQLAlchemy persistence mapping for aisuggestion. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [AISuggestion](../../advocanote-backend/app/models/aisuggestion.py#L16)

### calendar_custom_event.py

[D:/AdvocaNote/advocanote-backend/app/models/calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py)

SQLAlchemy persistence mapping for calendar custom event. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)
- **External or unresolved imports:** `sqlalchemy`
- **Declarations and study starting lines:** [CalendarCustomEvent](../../advocanote-backend/app/models/calendar_custom_event.py#L15)

### case.py

[D:/AdvocaNote/advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py)

SQLAlchemy persistence mapping for case. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [Case](../../advocanote-backend/app/models/case.py#L16)

### court.py

[D:/AdvocaNote/advocanote-backend/app/models/court.py](../../advocanote-backend/app/models/court.py)

SQLAlchemy persistence mapping for court. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [Court](../../advocanote-backend/app/models/court.py#L16)

### diary.py

[D:/AdvocaNote/advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py)

SQLAlchemy persistence mapping for diary. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py), [advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py), [advocanote-backend/app/models/court.py](../../advocanote-backend/app/models/court.py), [advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py), [advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py), [advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [DiaryEntry](../../advocanote-backend/app/models/diary.py#L16), [DiaryAIAnalysis](../../advocanote-backend/app/models/diary.py#L59)

### hearing.py

[D:/AdvocaNote/advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py)

SQLAlchemy persistence mapping for hearing. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [Hearing](../../advocanote-backend/app/models/hearing.py#L16)

### payment.py

[D:/AdvocaNote/advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py)

SQLAlchemy persistence mapping for payment. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `datetime`, `decimal`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [Payment](../../advocanote-backend/app/models/payment.py#L21), [SubscriptionUpgrade](../../advocanote-backend/app/models/payment.py#L107)

### reminder.py

[D:/AdvocaNote/advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py)

SQLAlchemy persistence mapping for reminder. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [Reminder](../../advocanote-backend/app/models/reminder.py#L22)

### reset.py

[D:/AdvocaNote/advocanote-backend/app/models/reset.py](../../advocanote-backend/app/models/reset.py)

SQLAlchemy persistence mapping for reset. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [PasswordReset](../../advocanote-backend/app/models/reset.py#L17)

### session.py

[D:/AdvocaNote/advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py)

SQLAlchemy persistence mapping for session. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [LoginSession](../../advocanote-backend/app/models/session.py#L17)

### subscription.py

[D:/AdvocaNote/advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py)

SQLAlchemy persistence mapping for subscription. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [Subscription](../../advocanote-backend/app/models/subscription.py#L20)

### subscription_daily_usage.py

[D:/AdvocaNote/advocanote-backend/app/models/subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py)

SQLAlchemy persistence mapping for subscription daily usage. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [SubscriptionDailyUsage](../../advocanote-backend/app/models/subscription_daily_usage.py#L27)

### subscription_plan.py

[D:/AdvocaNote/advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py)

SQLAlchemy persistence mapping for subscription plan. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `datetime`, `decimal`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [SubscriptionPlan](../../advocanote-backend/app/models/subscription_plan.py#L20)

### task.py

[D:/AdvocaNote/advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py)

SQLAlchemy persistence mapping for task. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [Task](../../advocanote-backend/app/models/task.py#L16)

### user.py

[D:/AdvocaNote/advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)

SQLAlchemy persistence mapping for user. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/auth/admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py), [advocanote-backend/app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py), [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/models/aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py), [advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py), [advocanote-backend/app/models/court.py](../../advocanote-backend/app/models/court.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py), [advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py), [advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py), [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py), [advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py), [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py), [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py), [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py), [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/google.py](../../advocanote-backend/app/services/google.py), [advocanote-backend/app/services/onboarding_service.py](../../advocanote-backend/app/services/onboarding_service.py), [advocanote-backend/app/services/profile_service.py](../../advocanote-backend/app/services/profile_service.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py), [advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py), [advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py), [stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [User](../../advocanote-backend/app/models/user.py#L19)

### user_subscription.py

[D:/AdvocaNote/advocanote-backend/app/models/user_subscription.py](../../advocanote-backend/app/models/user_subscription.py)

SQLAlchemy persistence mapping for user subscription. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### verification.py

[D:/AdvocaNote/advocanote-backend/app/models/verification.py](../../advocanote-backend/app/models/verification.py)

SQLAlchemy persistence mapping for verification. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py), [advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [Verification](../../advocanote-backend/app/models/verification.py#L17)

### voice_attachment.py

[D:/AdvocaNote/advocanote-backend/app/models/voice_attachment.py](../../advocanote-backend/app/models/voice_attachment.py)

SQLAlchemy persistence mapping for voice attachment. **If removed:** Dependent queries and metadata lose the model.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py)
- **Static importers:** [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)
- **External or unresolved imports:** `datetime`, `sqlalchemy`
- **Declarations and study starting lines:** [DiaryVoiceAttachment](../../advocanote-backend/app/models/voice_attachment.py#L16)

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/routers/__init__.py](../../advocanote-backend/app/routers/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/test_all_users.py](../../advocanote-backend/test_all_users.py), [advocanote-backend/test_scheduled_yearly.py](../../advocanote-backend/test_scheduled_yearly.py)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### account.py

[D:/AdvocaNote/advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py)

FastAPI operations for account. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/account_deletion.py](../../advocanote-backend/app/models/account_deletion.py), [advocanote-backend/app/models/account_recovery_token.py](../../advocanote-backend/app/models/account_recovery_token.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/services/email.py](../../advocanote-backend/app/services/email.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `google.auth.exceptions`, `google.auth.transport`, `google.oauth2`, `hashlib`, `logging`, `pydantic`, `re`, `secrets`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`, `stripe`, `typing`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/routers/account.py#L72), [hash_recovery_token(token)](../../advocanote-backend/app/routers/account.py#L78), [normalize_email(email)](../../advocanote-backend/app/routers/account.py#L84), [validate_new_password(password)](../../advocanote-backend/app/routers/account.py#L102), [revoke_all_sessions(db, user_id)](../../advocanote-backend/app/routers/account.py#L119), [invalidate_recovery_tokens(db, user_id)](../../advocanote-backend/app/routers/account.py#L130), [get_closed_account_record(db, user_id, lock)](../../advocanote-backend/app/routers/account.py#L144), [DeleteAccountRequest](../../advocanote-backend/app/routers/account.py#L164), [RecoveryEmailRequest](../../advocanote-backend/app/routers/account.py#L171), [RecoveryCompleteRequest](../../advocanote-backend/app/routers/account.py#L180), [close_my_account(data, db, current_user)](../../advocanote-backend/app/routers/account.py#L216), [get_account_deletions(db, current_user)](../../advocanote-backend/app/routers/account.py#L390), [verify_recovery_identity(user, data)](../../advocanote-backend/app/routers/account.py#L425), [request_account_recovery(data, db)](../../advocanote-backend/app/routers/account.py#L533), [complete_account_recovery(data, db)](../../advocanote-backend/app/routers/account.py#L721)

### admin_lawyers.py

[D:/AdvocaNote/advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py)

FastAPI operations for admin lawyers. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/auth/admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/account_deletion.py](../../advocanote-backend/app/models/account_deletion.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `logging`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [LawyerStatusUpdate](../../advocanote-backend/app/routers/admin_lawyers.py#L43), [update_lawyer_status(lawyer_id, data, db)](../../advocanote-backend/app/routers/admin_lawyers.py#L60)

### admin_settings.py

[D:/AdvocaNote/advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py)

FastAPI operations for admin settings. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `pydantic`, `re`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [require_admin(current_user)](../../advocanote-backend/app/routers/admin_settings.py#L40), [AdminProfileUpdate](../../advocanote-backend/app/routers/admin_settings.py#L56), [AdminProfileUpdate.validate_name](../../advocanote-backend/app/routers/admin_settings.py#L69), [AdminProfileUpdate.validate_email](../../advocanote-backend/app/routers/admin_settings.py#L81), [ChangeAdminPassword](../../advocanote-backend/app/routers/admin_settings.py#L95), [get_admin_profile(current_user)](../../advocanote-backend/app/routers/admin_settings.py#L109), [update_admin_profile(data, db, current_user)](../../advocanote-backend/app/routers/admin_settings.py#L125), [change_admin_password(data, db, current_user)](../../advocanote-backend/app/routers/admin_settings.py#L175)

### admin_subscriptions.py

[D:/AdvocaNote/advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py)

FastAPI operations for admin subscriptions. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/subscription.py](../../advocanote-backend/app/schemas/subscription.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `decimal`, `fastapi`, `pydantic`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`, `stripe`
- **Declarations and study starting lines:** [create_plan(data, db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L60), [get_all_plans(db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L147), [update_plan(plan_id, data, db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L167), [PlanDailyLimitUpdate](../../advocanote-backend/app/routers/admin_subscriptions.py#L266), [update_plan_daily_limit(plan_id, data, db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L283), [LinkStripePriceRequest](../../advocanote-backend/app/routers/admin_subscriptions.py#L341), [LinkStripePriceRequest.clean_price_id](../../advocanote-backend/app/routers/admin_subscriptions.py#L358), [link_existing_stripe_price(plan_id, data, db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L373), [get_admin_subscriptions_overview(db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L569), [delete_subscription_plan(plan_id, db)](../../advocanote-backend/app/routers/admin_subscriptions.py#L752)

### auth.py

[D:/AdvocaNote/advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py)

FastAPI operations for auth. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/auth.py](../../advocanote-backend/app/schemas/auth.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py), [advocanote-backend/app/services/google.py](../../advocanote-backend/app/services/google.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [register(data, db)](../../advocanote-backend/app/routers/auth.py#L54), [verify_email(data, db)](../../advocanote-backend/app/routers/auth.py#L67), [resend_verification(data, db)](../../advocanote-backend/app/routers/auth.py#L76), [login(data, db)](../../advocanote-backend/app/routers/auth.py#L105), [get_me(current_user)](../../advocanote-backend/app/routers/auth.py#L116), [refresh(data, db)](../../advocanote-backend/app/routers/auth.py#L126), [logout(data, db)](../../advocanote-backend/app/routers/auth.py#L137), [forgot_password(data, db)](../../advocanote-backend/app/routers/auth.py#L148), [reset_password(data, db)](../../advocanote-backend/app/routers/auth.py#L160), [login_with_google(data, db)](../../advocanote-backend/app/routers/auth.py#L176)

### calendar.py

[D:/AdvocaNote/advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py)

FastAPI operations for calendar. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py), [advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py), [advocanote-backend/app/models/court.py](../../advocanote-backend/app/models/court.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py), [advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py), [advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [get_calendar_events(start_date, end_date, db, user)](../../advocanote-backend/app/routers/calendar.py#L27), [CustomEventCreate](../../advocanote-backend/app/routers/calendar.py#L204), [CustomEventUpdate](../../advocanote-backend/app/routers/calendar.py#L229), [custom_event_json(event)](../../advocanote-backend/app/routers/calendar.py#L255), [owned_custom_event(event_id, db, user)](../../advocanote-backend/app/routers/calendar.py#L275), [create_custom_event(data, db, user)](../../advocanote-backend/app/routers/calendar.py#L301), [update_custom_event(event_id, data, db, user)](../../advocanote-backend/app/routers/calendar.py#L327), [delete_custom_event(event_id, db, user)](../../advocanote-backend/app/routers/calendar.py#L370)

### cases.py

[D:/AdvocaNote/advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py)

FastAPI operations for cases. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`, `typing`
- **Declarations and study starting lines:** [lawyer_read_only(user)](../../advocanote-backend/app/routers/cases.py#L48), [my_cases(db, user)](../../advocanote-backend/app/routers/cases.py#L68), [CaseStatusUpdate](../../advocanote-backend/app/routers/cases.py#L113), [update_case_status(case_id, data, db, user)](../../advocanote-backend/app/routers/cases.py#L124), [create_case(data, db, user)](../../advocanote-backend/app/routers/cases.py#L196), [delete_empty_case(case_id, db, user)](../../advocanote-backend/app/routers/cases.py#L338)

### diary.py

[D:/AdvocaNote/advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)

FastAPI operations for diary. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py), [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py), [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py), [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `json`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`, `typing`
- **Declarations and study starting lines:** [lawyer_only(user)](../../advocanote-backend/app/routers/diary.py#L41), [DiaryAIAnalysisInput](../../advocanote-backend/app/routers/diary.py#L57), [DiaryEntryWithAI](../../advocanote-backend/app/routers/diary.py#L64), [serialize_entry(db, entry)](../../advocanote-backend/app/routers/diary.py#L72), [overview(entry_date, db, user)](../../advocanote-backend/app/routers/diary.py#L130), [create_entry(data, db, user)](../../advocanote-backend/app/routers/diary.py#L226), [case_history(case_id, db, user)](../../advocanote-backend/app/routers/diary.py#L687), [get_diary_entry_details(entry_id, db, user)](../../advocanote-backend/app/routers/diary.py#L729), [DiaryEntryUpdate](../../advocanote-backend/app/routers/diary.py#L787), [update_diary_entry(entry_id, data, db, user)](../../advocanote-backend/app/routers/diary.py#L799), [delete_diary_entry(entry_id, db, user)](../../advocanote-backend/app/routers/diary.py#L962), [get_ai_suggestions(db, user)](../../advocanote-backend/app/routers/diary.py#L1124), [AISuggestionReview](../../advocanote-backend/app/routers/diary.py#L1184), [review_ai_suggestion(suggestion_id, data, db, user)](../../advocanote-backend/app/routers/diary.py#L1197)

### google_recovery.py

[D:/AdvocaNote/advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py)

Overlapping or alternate router, without a mount in current main.py. **If removed:** No direct live handler loss is established; compare with the active router.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `app.models.auth_token`, `app.rate_limit`, `datetime`, `fastapi`, `google.auth.transport.requests`, `google.oauth2`, `hashlib`, `pydantic`, `pydantic_settings`, `sqlalchemy`, `sqlalchemy.orm`, `time`
- **Declarations and study starting lines:** [utcnow()](../../advocanote-backend/app/routers/google_recovery.py#L37), [GoogleRecoverySettings](../../advocanote-backend/app/routers/google_recovery.py#L44), [GoogleResetIn](../../advocanote-backend/app/routers/google_recovery.py#L58), [google_reset_password(request, body, db)](../../advocanote-backend/app/routers/google_recovery.py#L69)

### hearings.py

[D:/AdvocaNote/advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py)

FastAPI operations for hearings. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [hearings(db, user)](../../advocanote-backend/app/routers/hearings.py#L49), [HearingReschedule](../../advocanote-backend/app/routers/hearings.py#L104), [reschedule_hearing(hearing_id, data, db, user)](../../advocanote-backend/app/routers/hearings.py#L120), [complete_hearing(hearing_id, db, user)](../../advocanote-backend/app/routers/hearings.py#L319)

### lawyer_subscriptions.py

[D:/AdvocaNote/advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py)

Lawyer catalog, hosted Checkout reservations, portal, schedules and cancellation. **If removed:** The active billing API loses these endpoints.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/app/schemas/subscription.py](../../advocanote-backend/app/schemas/subscription.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)
- **External or unresolved imports:** `datetime`, `decimal`, `fastapi`, `os`, `pydantic`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`, `stripe`, `uuid`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L48), [require_lawyer(user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L53), [StartTrialRequest](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L69), [SubscriptionStatusResponse](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L77), [subscription_response(db, subscription)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L106), [get_available_plans(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L266), [start_trial(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L296), [get_my_subscription(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L348), [CheckoutRequest](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L365), [require_official_plan_id(plan_id)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L371), [create_checkout(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L377), [prepare_new_subscription_checkout(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L417), [get_my_payments(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L832), [create_billing_management_session(customer_id, return_url)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L863), [manage_subscription(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L906), [get_checkout_payment_status(session_id, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L949), [cleanup_pending_checkouts(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1077), [check_plan_change(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1196), [synchronize_current_stripe_plan(stripe_sub, subscription, db)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1302), [full_price_upgrade_details(item, plan)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1350), [preview_full_price_upgrade(subscription, item, plan)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1358), [preview_plan_change(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1377), [UpgradePlanRequest](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1485), [upgrade_subscription(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1494), [DowngradePlanRequest](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1530), [schedule_plan_downgrade(data, db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1538), [cancel_my_subscription(db, user)](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1774)

### notifications.py

[D:/AdvocaNote/advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)

FastAPI operations for notifications. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py), [advocanote-backend/app/models/case.py](../../advocanote-backend/app/models/case.py), [advocanote-backend/app/models/hearing.py](../../advocanote-backend/app/models/hearing.py), [advocanote-backend/app/models/reminder.py](../../advocanote-backend/app/models/reminder.py), [advocanote-backend/app/models/task.py](../../advocanote-backend/app/models/task.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `sqlalchemy`, `sqlalchemy.orm`, `typing`
- **Declarations and study starting lines:** [get_today()](../../advocanote-backend/app/routers/notifications.py#L44), [get_utc_now()](../../advocanote-backend/app/routers/notifications.py#L50), [normalize_status(value)](../../advocanote-backend/app/routers/notifications.py#L56), [get_reminder_type(reminder)](../../advocanote-backend/app/routers/notifications.py#L63), [event_reminder_title(event)](../../advocanote-backend/app/routers/notifications.py#L69), [reconcile_custom_event_reminders(db, user)](../../advocanote-backend/app/routers/notifications.py#L81), [is_valid_notification(db, user, reminder, today, notification_type)](../../advocanote-backend/app/routers/notifications.py#L172), [get_visible_reminders(db, user, notification_type)](../../advocanote-backend/app/routers/notifications.py#L300), [serialize_notification(reminder)](../../advocanote-backend/app/routers/notifications.py#L337), [get_my_notifications(notification_type, unread_only, db, user)](../../advocanote-backend/app/routers/notifications.py#L362), [mark_all_notifications_as_read(notification_type, db, user)](../../advocanote-backend/app/routers/notifications.py#L405), [mark_notification_as_read(notification_id, db, user)](../../advocanote-backend/app/routers/notifications.py#L441), [mark_notification_as_unread(notification_id, db, user)](../../advocanote-backend/app/routers/notifications.py#L484)

### onboarding.py

[D:/AdvocaNote/advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py)

FastAPI operations for onboarding. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/onboarding.py](../../advocanote-backend/app/schemas/onboarding.py), [advocanote-backend/app/services/onboarding_service.py](../../advocanote-backend/app/services/onboarding_service.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [current_lawyer(user)](../../advocanote-backend/app/routers/onboarding.py#L38), [get_my_onboarding(user)](../../advocanote-backend/app/routers/onboarding.py#L59), [finish_my_onboarding(data, db, user)](../../advocanote-backend/app/routers/onboarding.py#L73)

### otp_recovery.py

[D:/AdvocaNote/advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py)

FastAPI operations for otp recovery. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/services/__init__.py](../../advocanote-backend/app/services/__init__.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `hashlib`, `hmac`, `logging`, `pydantic`, `pydantic_settings`, `re`, `secrets`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [OTPSettings](../../advocanote-backend/app/routers/otp_recovery.py#L21), [EmailRequest](../../advocanote-backend/app/routers/otp_recovery.py#L38), [VerifyOTPRequest](../../advocanote-backend/app/routers/otp_recovery.py#L42), [ResetOTPRequest](../../advocanote-backend/app/routers/otp_recovery.py#L51), [ResetOTPRequest.validate_password](../../advocanote-backend/app/routers/otp_recovery.py#L60), [require_otp_secret()](../../advocanote-backend/app/routers/otp_recovery.py#L86), [hash_otp(record_id, user_id, otp)](../../advocanote-backend/app/routers/otp_recovery.py#L94), [request_otp(data, db)](../../advocanote-backend/app/routers/otp_recovery.py#L111), [verify_otp(data, db)](../../advocanote-backend/app/routers/otp_recovery.py#L238), [reset_with_otp(data, db)](../../advocanote-backend/app/routers/otp_recovery.py#L323)

### profile.py

[D:/AdvocaNote/advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py)

FastAPI operations for profile. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/profile.py](../../advocanote-backend/app/schemas/profile.py), [advocanote-backend/app/services/profile_photo_service.py](../../advocanote-backend/app/services/profile_photo_service.py), [advocanote-backend/app/services/profile_service.py](../../advocanote-backend/app/services/profile_service.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `fastapi.responses`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [read_my_profile(user)](../../advocanote-backend/app/routers/profile.py#L41), [upload_my_profile_photo(photo, user)](../../advocanote-backend/app/routers/profile.py#L51), [get_my_profile_photo(user)](../../advocanote-backend/app/routers/profile.py#L80), [delete_my_profile_photo(user)](../../advocanote-backend/app/routers/profile.py#L105), [edit_my_profile(data, db, user)](../../advocanote-backend/app/routers/profile.py#L123)

### stripe_webhooks.py

[D:/AdvocaNote/advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py)

Stripe signature and provider-object validation with local billing transitions. **If removed:** Payment fulfillment and subscription reconciliation lose their backend handlers.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py), [advocanote-backend/test_all_users.py](../../advocanote-backend/test_all_users.py), [advocanote-backend/test_scheduled_yearly.py](../../advocanote-backend/test_scheduled_yearly.py)
- **External or unresolved imports:** `datetime`, `decimal`, `fastapi`, `json`, `logging`, `sqlalchemy`, `sqlalchemy.orm`, `stripe`, `types`
- **Declarations and study starting lines:** [utc_datetime(timestamp)](../../advocanote-backend/app/routers/stripe_webhooks.py#L37), [stripe_id(value)](../../advocanote-backend/app/routers/stripe_webhooks.py#L44), [lock_checkout_upgrade(db, upgrade)](../../advocanote-backend/app/routers/stripe_webhooks.py#L55), [retire_checkout_source(upgrade, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L72), [process_checkout_upgrade(upgrade, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L104), [handle_checkout_completed(checkout, db, paid_invoice)](../../advocanote-backend/app/routers/stripe_webhooks.py#L211), [get_invoice_subscription_id(invoice)](../../advocanote-backend/app/routers/stripe_webhooks.py#L539), [invoice_line_matches_subscription_price(line, subscription_id, subscription_item_id, price_id)](../../advocanote-backend/app/routers/stripe_webhooks.py#L553), [is_full_price_upgrade_invoice(invoice, plan)](../../advocanote-backend/app/routers/stripe_webhooks.py#L589), [verify_paid_upgrade_invoice(invoice_id, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L610), [handle_invoice_paid(invoice, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L752), [handle_subscription_deleted(event_sub, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1080), [handle_invoice_payment_failed(event_invoice, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1253), [handle_upgrade_payment_failed(invoice, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1502), [handle_subscription_updated(event_sub, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1644), [handle_initial_checkout_payment_failed(event_invoice, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1772), [handle_initial_checkout_invoice_paid(invoice, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1918), [stripe_webhook(request, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L1999), [get_plan_by_stripe_price(price_id, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L2198), [get_plan_from_stripe_subscription(stripe_sub, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L2225), [handle_paid_plan_upgrade(invoice_id, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L2266), [reconcile_paid_plan_upgrade(stripe_sub, db)](../../advocanote-backend/app/routers/stripe_webhooks.py#L2476)

### subscription_billing.py

[D:/AdvocaNote/advocanote-backend/app/routers/subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py)

Overlapping or alternate router, without a mount in current main.py. **If removed:** No direct live handler loss is established; compare with the active router.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `fastapi`, `os`, `sqlalchemy.orm`, `stripe`
- **Declarations and study starting lines:** [find_subscription(db, user_id)](../../advocanote-backend/app/routers/subscription_billing.py#L19), [to_response(sub)](../../advocanote-backend/app/routers/subscription_billing.py#L28), [get_my_subscription(db, user)](../../advocanote-backend/app/routers/subscription_billing.py#L51), [cancel_my_subscription(db, user)](../../advocanote-backend/app/routers/subscription_billing.py#L60)

### subscription_experience.py

[D:/AdvocaNote/advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)

Access response, first-trial entry and hosted upgrade/scheduler orchestration. **If removed:** The dashboard gate and hosted upgrade path lose their server support.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py), [advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py)
- **External or unresolved imports:** `asyncio`, `datetime`, `fastapi`, `logging`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`, `stripe`, `uuid`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/routers/subscription_experience.py#L71), [require_lawyer(user)](../../advocanote-backend/app/routers/subscription_experience.py#L77), [get_subscription(db, user_id)](../../advocanote-backend/app/routers/subscription_experience.py#L89), [active_access(subscription)](../../advocanote-backend/app/routers/subscription_experience.py#L100), [plan_options(db)](../../advocanote-backend/app/routers/subscription_experience.py#L121), [subscription_options(db, user)](../../advocanote-backend/app/routers/subscription_experience.py#L169), [subscription_access(db, user)](../../advocanote-backend/app/routers/subscription_experience.py#L184), [SelectPlanRequest](../../advocanote-backend/app/routers/subscription_experience.py#L361), [open_upgrade_checkout(db, subscription, stripe_sub, item, target_plan, attempt_id)](../../advocanote-backend/app/routers/subscription_experience.py#L386), [upgrade_paid_subscription(db, user, subscription, target_plan, attempt_id)](../../advocanote-backend/app/routers/subscription_experience.py#L510), [select_subscription_plan(data, db, user)](../../advocanote-backend/app/routers/subscription_experience.py#L673), [sync_paid_upgrade(db, user)](../../advocanote-backend/app/routers/subscription_experience.py#L815), [check_trial_expiry_notifications()](../../advocanote-backend/app/routers/subscription_experience.py#L919), [check_paid_subscription_expiry_notifications()](../../advocanote-backend/app/routers/subscription_experience.py#L1027), [reconcile_checkout_upgrades()](../../advocanote-backend/app/routers/subscription_experience.py#L1142), [checkout_upgrade_scheduler()](../../advocanote-backend/app/routers/subscription_experience.py#L1159), [trial_notification_scheduler()](../../advocanote-backend/app/routers/subscription_experience.py#L1168), [subscription_notification_loop()](../../advocanote-backend/app/routers/subscription_experience.py#L1180)

### tasks.py

[D:/AdvocaNote/advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py)

FastAPI operations for tasks. **If removed:** Any mounted routes and importing modules lose the handlers.

- **Local dependencies:** [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `pydantic`, `sqlalchemy`, `sqlalchemy.orm`, `typing`
- **Declarations and study starting lines:** [CaseTaskCreate](../../advocanote-backend/app/routers/tasks.py#L36), [CaseTaskPatch](../../advocanote-backend/app/routers/tasks.py#L47), [task_json(task)](../../advocanote-backend/app/routers/tasks.py#L62), [owned_case(case_id, db, user)](../../advocanote-backend/app/routers/tasks.py#L76), [owned_task(task_id, db, user)](../../advocanote-backend/app/routers/tasks.py#L97), [sync_task_reminder(db, task, reset_read)](../../advocanote-backend/app/routers/tasks.py#L118), [get_all_tasks(db, user)](../../advocanote-backend/app/routers/tasks.py#L175), [case_tasks(case_id, db, user)](../../advocanote-backend/app/routers/tasks.py#L192), [create_case_task(case_id, data, db, user)](../../advocanote-backend/app/routers/tasks.py#L221), [update_case_task(task_id, data, db, user)](../../advocanote-backend/app/routers/tasks.py#L272), [delete_case_task(task_id, db, user)](../../advocanote-backend/app/routers/tasks.py#L364)

### voice_ai.py

[D:/AdvocaNote/advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py)

Audio upload, transcription and text/voice analysis routes. **If removed:** Speech and AI requests lose their router.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/services/legal_ai.py](../../advocanote-backend/app/services/legal_ai.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `faster_whisper`, `gc`, `logging`, `pathlib`, `pydantic`, `tempfile`, `typing`
- **Declarations and study starting lines:** [lawyer_only(user)](../../advocanote-backend/app/routers/voice_ai.py#L81), [transcribe_audio(audio_path, language)](../../advocanote-backend/app/routers/voice_ai.py#L97), [convert_uploaded_audio(file, language)](../../advocanote-backend/app/routers/voice_ai.py#L135), [analyze_text_service(transcript, language)](../../advocanote-backend/app/routers/voice_ai.py#L247), [TextAnalysisRequest](../../advocanote-backend/app/routers/voice_ai.py#L304), [transcribe_voice(file, language, user)](../../advocanote-backend/app/routers/voice_ai.py#L330), [analyze_text(payload, user)](../../advocanote-backend/app/routers/voice_ai.py#L361), [analyze_voice(file, language, user)](../../advocanote-backend/app/routers/voice_ai.py#L387)

### voice_storage.py

[D:/AdvocaNote/advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)

Owned persistence and retrieval of audio and transcripts. **If removed:** Diaries cannot attach or play recordings.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/auth/subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/models/voice_attachment.py](../../advocanote-backend/app/models/voice_attachment.py)
- **Static importers:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **External or unresolved imports:** `fastapi`, `fastapi.responses`, `json`, `pathlib`, `sqlalchemy.orm`, `uuid`
- **Declarations and study starting lines:** [get_owned_entry(db, entry_id, user_id)](../../advocanote-backend/app/routers/voice_storage.py#L72), [validate_json_list(raw, field_name, objects)](../../advocanote-backend/app/routers/voice_storage.py#L99), [get_owned_recording(db, entry_id, user_id)](../../advocanote-backend/app/routers/voice_storage.py#L159), [save_voice_recording(entry_id, audio, source_transcript, reviewed_transcript, notes_json, highlights_json, approved_notes_json, db, user)](../../advocanote-backend/app/routers/voice_storage.py#L198), [get_voice_recording(entry_id, db, user)](../../advocanote-backend/app/routers/voice_storage.py#L430), [get_voice_audio(entry_id, db, user)](../../advocanote-backend/app/routers/voice_storage.py#L482)

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/schemas/__init__.py](../../advocanote-backend/app/schemas/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### auth.py

[D:/AdvocaNote/advocanote-backend/app/schemas/auth.py](../../advocanote-backend/app/schemas/auth.py)

Pydantic transport contract for auth. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py)
- **External or unresolved imports:** `pydantic`
- **Declarations and study starting lines:** [Register](../../advocanote-backend/app/schemas/auth.py#L10), [Register.validate_name](../../advocanote-backend/app/schemas/auth.py#L26), [Register.normalize_email](../../advocanote-backend/app/schemas/auth.py#L36), [UserResponse](../../advocanote-backend/app/schemas/auth.py#L40), [VerifyEmail](../../advocanote-backend/app/schemas/auth.py#L53), [ResendVerification](../../advocanote-backend/app/schemas/auth.py#L60), [Login](../../advocanote-backend/app/schemas/auth.py#L64), [LoginResponse](../../advocanote-backend/app/schemas/auth.py#L69), [RefreshRequest](../../advocanote-backend/app/schemas/auth.py#L76), [ForgotPasswordRequest](../../advocanote-backend/app/schemas/auth.py#L83), [ResetPasswordRequest](../../advocanote-backend/app/schemas/auth.py#L87), [GoogleLoginRequest](../../advocanote-backend/app/schemas/auth.py#L92)

### case.py

[D:/AdvocaNote/advocanote-backend/app/schemas/case.py](../../advocanote-backend/app/schemas/case.py)

Pydantic transport contract for case. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)
- **External or unresolved imports:** `datetime`, `pydantic`, `typing`
- **Declarations and study starting lines:** [CaseCreate](../../advocanote-backend/app/schemas/case.py#L10)

### diary.py

[D:/AdvocaNote/advocanote-backend/app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)

Pydantic transport contract for diary. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** [advocanote-backend/app/schemas/case.py](../../advocanote-backend/app/schemas/case.py), [advocanote-backend/app/schemas/task.py](../../advocanote-backend/app/schemas/task.py)
- **Static importers:** [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py), [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)
- **External or unresolved imports:** `datetime`, `pydantic`, `typing`
- **Declarations and study starting lines:** [AISuggestionDraft](../../advocanote-backend/app/schemas/diary.py#L10), [DiaryEntryCreate](../../advocanote-backend/app/schemas/diary.py#L31)

### onboarding.py

[D:/AdvocaNote/advocanote-backend/app/schemas/onboarding.py](../../advocanote-backend/app/schemas/onboarding.py)

Pydantic transport contract for onboarding. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py), [advocanote-backend/app/schemas/profile.py](../../advocanote-backend/app/schemas/profile.py), [advocanote-backend/app/services/onboarding_service.py](../../advocanote-backend/app/services/onboarding_service.py), [advocanote-backend/app/services/profile_service.py](../../advocanote-backend/app/services/profile_service.py)
- **External or unresolved imports:** `pydantic`, `typing`
- **Declarations and study starting lines:** [NotificationPreferences](../../advocanote-backend/app/schemas/onboarding.py#L12), [OnboardingProfile](../../advocanote-backend/app/schemas/onboarding.py#L20), [OnboardingProfile.validate_practice_areas](../../advocanote-backend/app/schemas/onboarding.py#L58), [OnboardingResponse](../../advocanote-backend/app/schemas/onboarding.py#L80), [OnboardingCompleteRequest](../../advocanote-backend/app/schemas/onboarding.py#L92)

### profile.py

[D:/AdvocaNote/advocanote-backend/app/schemas/profile.py](../../advocanote-backend/app/schemas/profile.py)

Pydantic transport contract for profile. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** [advocanote-backend/app/schemas/onboarding.py](../../advocanote-backend/app/schemas/onboarding.py)
- **Static importers:** [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py), [advocanote-backend/app/services/profile_service.py](../../advocanote-backend/app/services/profile_service.py)
- **External or unresolved imports:** `pydantic`, `typing`
- **Declarations and study starting lines:** [LawyerProfileFields](../../advocanote-backend/app/schemas/profile.py#L18), [LawyerProfileResponse](../../advocanote-backend/app/schemas/profile.py#L30), [LawyerProfileUpdate](../../advocanote-backend/app/schemas/profile.py#L37), [LawyerProfileUpdate.validate_practice_areas](../../advocanote-backend/app/schemas/profile.py#L93), [LawyerProfileUpdate.validate_required_updates](../../advocanote-backend/app/schemas/profile.py#L111)

### subscription.py

[D:/AdvocaNote/advocanote-backend/app/schemas/subscription.py](../../advocanote-backend/app/schemas/subscription.py)

Pydantic transport contract for subscription. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py), [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py)
- **External or unresolved imports:** `datetime`, `decimal`, `pydantic`, `typing`
- **Declarations and study starting lines:** [PlanCreate](../../advocanote-backend/app/schemas/subscription.py#L13), [PlanUpdate](../../advocanote-backend/app/schemas/subscription.py#L70), [PlanResponse](../../advocanote-backend/app/schemas/subscription.py#L123)

### task.py

[D:/AdvocaNote/advocanote-backend/app/schemas/task.py](../../advocanote-backend/app/schemas/task.py)

Pydantic transport contract for task. **If removed:** Dependent routes lose their request/response contract.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)
- **External or unresolved imports:** `datetime`, `pydantic`, `typing`
- **Declarations and study starting lines:** [ApprovedTask](../../advocanote-backend/app/schemas/task.py#L8)

### __init__.py

[D:/AdvocaNote/advocanote-backend/app/services/__init__.py](../../advocanote-backend/app/services/__init__.py)

Package initializer. **If removed:** Any package-level imports would disappear; an empty marker has no direct business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### auth.py

[D:/AdvocaNote/advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py)

Feature helper or service for auth. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/auth.py](../../advocanote-backend/app/schemas/auth.py)
- **Static importers:** [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/services/google.py](../../advocanote-backend/app/services/google.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `hashlib`, `logging`, `secrets`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [register_user(db, data)](../../advocanote-backend/app/services/auth.py#L23), [login_user(db, data)](../../advocanote-backend/app/services/auth.py#L89), [utc_now()](../../advocanote-backend/app/services/auth.py#L123), [hash_token(token)](../../advocanote-backend/app/services/auth.py#L127), [create_login_session(db, user)](../../advocanote-backend/app/services/auth.py#L133), [refresh_user_session(db, refresh_token)](../../advocanote-backend/app/services/auth.py#L170), [logout_user(db, refresh_token)](../../advocanote-backend/app/services/auth.py#L225)

### email.py

[D:/AdvocaNote/advocanote-backend/app/services/email.py](../../advocanote-backend/app/services/email.py)

Feature helper or service for email. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py)
- **Static importers:** [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py), [advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py), [advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py)
- **External or unresolved imports:** `email.message`, `smtplib`, `ssl`
- **Declarations and study starting lines:** [send_email(to_email, subject, body)](../../advocanote-backend/app/services/email.py#L9)

### google.py

[D:/AdvocaNote/advocanote-backend/app/services/google.py](../../advocanote-backend/app/services/google.py)

Feature helper or service for google. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/services/auth.py](../../advocanote-backend/app/services/auth.py)
- **Static importers:** [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py)
- **External or unresolved imports:** `cachecontrol`, `fastapi`, `functools`, `google.auth.exceptions`, `google.auth.transport`, `google.oauth2`, `requests`, `sqlalchemy`, `sqlalchemy.exc`, `sqlalchemy.orm`, `time`
- **Declarations and study starting lines:** [google_login(db, credential)](../../advocanote-backend/app/services/google.py#L29)

### legal_ai.py

[D:/AdvocaNote/advocanote-backend/app/services/legal_ai.py](../../advocanote-backend/app/services/legal_ai.py)

Ollama Qwen prompts, batching and evidence validation. **If removed:** Typed and transcribed diary text cannot be analyzed through this service.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py), [advocanote-backend/voice_ai_test.py](../../advocanote-backend/voice_ai_test.py)
- **External or unresolved imports:** `json`, `ollama`, `re`
- **Declarations and study starting lines:** [source_language(value)](../../advocanote-backend/app/services/legal_ai.py#L488), [target_language_matches(value, language)](../../advocanote-backend/app/services/legal_ai.py#L492), [verified_months(value)](../../advocanote-backend/app/services/legal_ai.py#L499), [verified_roles(value)](../../advocanote-backend/app/services/legal_ai.py#L507), [normalize(value)](../../advocanote-backend/app/services/legal_ai.py#L584), [split_statements(transcript)](../../advocanote-backend/app/services/legal_ai.py#L593), [chunk_statements(statements, max_chars, max_items)](../../advocanote-backend/app/services/legal_ai.py#L627), [valid_ids(values, count)](../../advocanote-backend/app/services/legal_ai.py#L668), [safe_ai_point(item, batch, kind, language)](../../advocanote-backend/app/services/legal_ai.py#L695), [source_point(sentence)](../../advocanote-backend/app/services/legal_ai.py#L818), [shorten_other_point(sentence)](../../advocanote-backend/app/services/legal_ai.py#L840), [extract_source_tasks(statement)](../../advocanote-backend/app/services/legal_ai.py#L902), [source_category(text, language)](../../advocanote-backend/app/services/legal_ai.py#L1032), [ask_qwen(batch, language)](../../advocanote-backend/app/services/legal_ai.py#L1195), [analyze_legal_transcript(transcript, language)](../../advocanote-backend/app/services/legal_ai.py#L1246)

### onboarding_service.py

[D:/AdvocaNote/advocanote-backend/app/services/onboarding_service.py](../../advocanote-backend/app/services/onboarding_service.py)

Feature helper or service for onboarding service. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/onboarding.py](../../advocanote-backend/app/schemas/onboarding.py)
- **Static importers:** [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py)
- **External or unresolved imports:** `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [get_onboarding_state(user)](../../advocanote-backend/app/services/onboarding_service.py#L14), [complete_onboarding(db, user, data)](../../advocanote-backend/app/services/onboarding_service.py#L40), [skip_onboarding(db, user)](../../advocanote-backend/app/services/onboarding_service.py#L80)

### profile_photo_service.py

[D:/AdvocaNote/advocanote-backend/app/services/profile_photo_service.py](../../advocanote-backend/app/services/profile_photo_service.py)

Feature helper or service for profile photo service. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py)
- **External or unresolved imports:** `PIL`, `fastapi`, `io`, `pathlib`
- **Declarations and study starting lines:** [get_photo_path(user_id)](../../advocanote-backend/app/services/profile_photo_service.py#L18), [save_profile_photo(user_id, content)](../../advocanote-backend/app/services/profile_photo_service.py#L22), [remove_profile_photo(user_id)](../../advocanote-backend/app/services/profile_photo_service.py#L81)

### profile_service.py

[D:/AdvocaNote/advocanote-backend/app/services/profile_service.py](../../advocanote-backend/app/services/profile_service.py)

Feature helper or service for profile service. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/schemas/onboarding.py](../../advocanote-backend/app/schemas/onboarding.py), [advocanote-backend/app/schemas/profile.py](../../advocanote-backend/app/schemas/profile.py)
- **Static importers:** [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py)
- **External or unresolved imports:** `sqlalchemy.orm`
- **Declarations and study starting lines:** [get_lawyer_profile(user)](../../advocanote-backend/app/services/profile_service.py#L15), [update_lawyer_profile(db, user, data)](../../advocanote-backend/app/services/profile_service.py#L42)

### reset.py

[D:/AdvocaNote/advocanote-backend/app/services/reset.py](../../advocanote-backend/app/services/reset.py)

Feature helper or service for reset. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/auth/security.py](../../advocanote-backend/app/auth/security.py), [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/models/reset.py](../../advocanote-backend/app/models/reset.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/services/email.py](../../advocanote-backend/app/services/email.py)
- **Static importers:** [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py), [advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `hashlib`, `logging`, `secrets`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/services/reset.py#L23), [hash_reset_token(token)](../../advocanote-backend/app/services/reset.py#L27), [request_password_reset(db, email)](../../advocanote-backend/app/services/reset.py#L33), [reset_user_password(db, token, new_password)](../../advocanote-backend/app/services/reset.py#L102)

### subscription_trial.py

[D:/AdvocaNote/advocanote-backend/app/services/subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py)

Official plan identity, legacy prices and one-time trial. **If removed:** Trial creation and billing lookups lose their integration.

- **Local dependencies:** [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)
- **External or unresolved imports:** `datetime`, `decimal`, `logging`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [stripe_price_matches_plan(price_id, plan)](../../advocanote-backend/app/services/subscription_trial.py#L67), [get_display_plan_name(plan)](../../advocanote-backend/app/services/subscription_trial.py#L74), [get_official_plan(db, plan_key)](../../advocanote-backend/app/services/subscription_trial.py#L82), [start_free_trial_if_eligible(user_id)](../../advocanote-backend/app/services/subscription_trial.py#L118)

### subscription_usage.py

[D:/AdvocaNote/advocanote-backend/app/services/subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py)

Colombo-day diary cap and counter transaction. **If removed:** Diary writes lose the enforced cap and counter.

- **Local dependencies:** [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py), [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `sqlalchemy`, `sqlalchemy.orm`, `zoneinfo`
- **Declarations and study starting lines:** [get_usage_date()](../../advocanote-backend/app/services/subscription_usage.py#L24), [as_utc(value)](../../advocanote-backend/app/services/subscription_usage.py#L30), [get_valid_subscription(db, user_id)](../../advocanote-backend/app/services/subscription_usage.py#L46), [consume_daily_action(db, user_id)](../../advocanote-backend/app/services/subscription_usage.py#L93)

### verification.py

[D:/AdvocaNote/advocanote-backend/app/services/verification.py](../../advocanote-backend/app/services/verification.py)

Feature helper or service for verification. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/models/verification.py](../../advocanote-backend/app/models/verification.py), [advocanote-backend/app/services/email.py](../../advocanote-backend/app/services/email.py)
- **Static importers:** [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py)
- **External or unresolved imports:** `datetime`, `fastapi`, `hashlib`, `secrets`, `smtplib`, `sqlalchemy`, `sqlalchemy.orm`
- **Declarations and study starting lines:** [utc_now()](../../advocanote-backend/app/services/verification.py#L18), [send_verification_email(db, user)](../../advocanote-backend/app/services/verification.py#L22), [verify_email_token(db, token)](../../advocanote-backend/app/services/verification.py#L93)

### check_dependencies.py

[D:/AdvocaNote/advocanote-backend/check_dependencies.py](../../advocanote-backend/check_dependencies.py)

Test or environment support for check dependencies. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### env.py

[D:/AdvocaNote/advocanote-backend/migrations/env.py](../../advocanote-backend/migrations/env.py)

Configuration or supporting source for env. **If removed:** Its related build, package, or tool boundary loses this input.

- **Local dependencies:** [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/diary.py](../../advocanote-backend/app/models/diary.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/reset.py](../../advocanote-backend/app/models/reset.py), [advocanote-backend/app/models/session.py](../../advocanote-backend/app/models/session.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py), [advocanote-backend/app/models/verification.py](../../advocanote-backend/app/models/verification.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `logging.config`
- **Declarations and study starting lines:** [run_migrations_offline()](../../advocanote-backend/migrations/env.py#L28), [run_migrations_online()](../../advocanote-backend/migrations/env.py#L45)

### 2ce42a642a99_create_users_table.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/2ce42a642a99_create_users_table.py](../../advocanote-backend/migrations/versions/2ce42a642a99_create_users_table.py)

Alembic revision for create users table. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/2ce42a642a99_create_users_table.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/2ce42a642a99_create_users_table.py#L41)

### 3624a224a6d1_add_lawyer_onboarding_profile.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/3624a224a6d1_add_lawyer_onboarding_profile.py](../../advocanote-backend/migrations/versions/3624a224a6d1_add_lawyer_onboarding_profile.py)

Alembic revision for add lawyer onboarding profile. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/3624a224a6d1_add_lawyer_onboarding_profile.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/3624a224a6d1_add_lawyer_onboarding_profile.py#L105)

### 38aee0ee9923_create_payments_table.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/38aee0ee9923_create_payments_table.py](../../advocanote-backend/migrations/versions/38aee0ee9923_create_payments_table.py)

Alembic revision for create payments table. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/38aee0ee9923_create_payments_table.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/38aee0ee9923_create_payments_table.py#L127)

### 3a7ec36244b3_create_password_resets_table.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/3a7ec36244b3_create_password_resets_table.py](../../advocanote-backend/migrations/versions/3a7ec36244b3_create_password_resets_table.py)

Alembic revision for create password resets table. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/3a7ec36244b3_create_password_resets_table.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/3a7ec36244b3_create_password_resets_table.py#L39)

### 4138f2f6e75f_allow_manual_tasks.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/4138f2f6e75f_allow_manual_tasks.py](../../advocanote-backend/migrations/versions/4138f2f6e75f_allow_manual_tasks.py)

Alembic revision for allow manual tasks. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `sqlalchemy.dialects`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/4138f2f6e75f_allow_manual_tasks.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/4138f2f6e75f_allow_manual_tasks.py#L31)

### 44c054ddbe95_create_login_sessions_table.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/44c054ddbe95_create_login_sessions_table.py](../../advocanote-backend/migrations/versions/44c054ddbe95_create_login_sessions_table.py)

Alembic revision for create login sessions table. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/44c054ddbe95_create_login_sessions_table.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/44c054ddbe95_create_login_sessions_table.py#L39)

### 4501bae7bce5_add_hearing_purpose.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/4501bae7bce5_add_hearing_purpose.py](../../advocanote-backend/migrations/versions/4501bae7bce5_add_hearing_purpose.py)

Alembic revision for add hearing purpose. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/4501bae7bce5_add_hearing_purpose.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/4501bae7bce5_add_hearing_purpose.py#L26)

### 60abde51d92e_add_hearing_reschedule_fields.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/60abde51d92e_add_hearing_reschedule_fields.py](../../advocanote-backend/migrations/versions/60abde51d92e_add_hearing_reschedule_fields.py)

Alembic revision for add hearing reschedule fields. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/60abde51d92e_add_hearing_reschedule_fields.py#L27), [downgrade()](../../advocanote-backend/migrations/versions/60abde51d92e_add_hearing_reschedule_fields.py#L110)

### 7024b90b2279_create_lawyer_subscriptions.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/7024b90b2279_create_lawyer_subscriptions.py](../../advocanote-backend/migrations/versions/7024b90b2279_create_lawyer_subscriptions.py)

Alembic revision for create lawyer subscriptions. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/7024b90b2279_create_lawyer_subscriptions.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/7024b90b2279_create_lawyer_subscriptions.py#L108)

### 7d93423a65df_create_verifications_table.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/7d93423a65df_create_verifications_table.py](../../advocanote-backend/migrations/versions/7d93423a65df_create_verifications_table.py)

Alembic revision for create verifications table. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/7d93423a65df_create_verifications_table.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/7d93423a65df_create_verifications_table.py#L38)

### 9d9dd1fe79b9_add_legal_diary_tables.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/9d9dd1fe79b9_add_legal_diary_tables.py](../../advocanote-backend/migrations/versions/9d9dd1fe79b9_add_legal_diary_tables.py)

Alembic revision for add legal diary tables. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/9d9dd1fe79b9_add_legal_diary_tables.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/9d9dd1fe79b9_add_legal_diary_tables.py#L135)

### 9e57dd0418e7_add_lawyer_professional_profile_fields.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/9e57dd0418e7_add_lawyer_professional_profile_fields.py](../../advocanote-backend/migrations/versions/9e57dd0418e7_add_lawyer_professional_profile_fields.py)

Alembic revision for add lawyer professional profile fields. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/9e57dd0418e7_add_lawyer_professional_profile_fields.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/9e57dd0418e7_add_lawyer_professional_profile_fields.py#L42)

### c28bc937b3dd_add_case_type_and_case_stage.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/c28bc937b3dd_add_case_type_and_case_stage.py](../../advocanote-backend/migrations/versions/c28bc937b3dd_add_case_type_and_case_stage.py)

Alembic revision for add case type and case stage. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/c28bc937b3dd_add_case_type_and_case_stage.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/c28bc937b3dd_add_case_type_and_case_stage.py#L33)

### c5ba33c8d092_allow_manual_tasks.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/c5ba33c8d092_allow_manual_tasks.py](../../advocanote-backend/migrations/versions/c5ba33c8d092_allow_manual_tasks.py)

Alembic revision for allow manual tasks. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `sqlalchemy.dialects`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/c5ba33c8d092_allow_manual_tasks.py#L27), [downgrade()](../../advocanote-backend/migrations/versions/c5ba33c8d092_allow_manual_tasks.py#L41)

### e3e8e3a14c3a_create_hearing_purpose_column.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/e3e8e3a14c3a_create_hearing_purpose_column.py](../../advocanote-backend/migrations/versions/e3e8e3a14c3a_create_hearing_purpose_column.py)

Alembic revision for create hearing purpose column. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/e3e8e3a14c3a_create_hearing_purpose_column.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/e3e8e3a14c3a_create_hearing_purpose_column.py#L42)

### e4188767de73_create_subscription_plans.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/e4188767de73_create_subscription_plans.py](../../advocanote-backend/migrations/versions/e4188767de73_create_subscription_plans.py)

Alembic revision for create subscription plans. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/e4188767de73_create_subscription_plans.py#L22), [downgrade()](../../advocanote-backend/migrations/versions/e4188767de73_create_subscription_plans.py#L85)

### ead393f05b53_add_lawyer_profile_professional_fields.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/ead393f05b53_add_lawyer_profile_professional_fields.py](../../advocanote-backend/migrations/versions/ead393f05b53_add_lawyer_profile_professional_fields.py)

Alembic revision for add lawyer profile professional fields. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`, `typing`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/ead393f05b53_add_lawyer_profile_professional_fields.py#L21), [downgrade()](../../advocanote-backend/migrations/versions/ead393f05b53_add_lawyer_profile_professional_fields.py#L26)

### f6f9c4214d30_add_subscription_upgrade_attempts.py

[D:/AdvocaNote/advocanote-backend/migrations/versions/f6f9c4214d30_add_subscription_upgrade_attempts.py](../../advocanote-backend/migrations/versions/f6f9c4214d30_add_subscription_upgrade_attempts.py)

Alembic revision for add subscription upgrade attempts. **If removed:** The revision chain can lose its declared schema transition.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `alembic`, `sqlalchemy`
- **Declarations and study starting lines:** [upgrade()](../../advocanote-backend/migrations/versions/f6f9c4214d30_add_subscription_upgrade_attempts.py#L15), [downgrade()](../../advocanote-backend/migrations/versions/f6f9c4214d30_add_subscription_upgrade_attempts.py#L33)

### stripe_webhooks_backup.py

[D:/AdvocaNote/advocanote-backend/stripe_webhooks_backup.py](../../advocanote-backend/stripe_webhooks_backup.py)

Historical source copy. **If removed:** No live route is known to depend on this copy.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `datetime`, `decimal`, `fastapi`, `logging`, `sqlalchemy`, `sqlalchemy.orm`, `stripe`
- **Declarations and study starting lines:** [utc_datetime(timestamp)](../../advocanote-backend/stripe_webhooks_backup.py#L32), [stripe_id(value)](../../advocanote-backend/stripe_webhooks_backup.py#L39), [handle_checkout_completed(checkout, db)](../../advocanote-backend/stripe_webhooks_backup.py#L50), [get_invoice_subscription_id(invoice)](../../advocanote-backend/stripe_webhooks_backup.py#L281), [verify_paid_upgrade_invoice(invoice_id, db)](../../advocanote-backend/stripe_webhooks_backup.py#L299), [handle_invoice_paid(invoice, db)](../../advocanote-backend/stripe_webhooks_backup.py#L443), [handle_subscription_deleted(event_sub, db)](../../advocanote-backend/stripe_webhooks_backup.py#L689), [handle_invoice_payment_failed(event_invoice, db)](../../advocanote-backend/stripe_webhooks_backup.py#L749), [handle_subscription_updated(event_sub, db)](../../advocanote-backend/stripe_webhooks_backup.py#L924), [stripe_webhook(request, db)](../../advocanote-backend/stripe_webhooks_backup.py#L1043), [get_plan_from_stripe_subscription(stripe_sub, db)](../../advocanote-backend/stripe_webhooks_backup.py#L1232), [handle_paid_plan_upgrade(invoice_id, db)](../../advocanote-backend/stripe_webhooks_backup.py#L1277)

### test_all_users.py

[D:/AdvocaNote/advocanote-backend/test_all_users.py](../../advocanote-backend/test_all_users.py)

Test or environment support for test all users. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** [advocanote-backend/app/routers/__init__.py](../../advocanote-backend/app/routers/__init__.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `asyncio`, `datetime`, `decimal`, `pytest`, `types`, `unittest.mock`
- **Declarations and study starting lines:** [test_auto_yearly_sync_for_all_users(monkeypatch, user_id)](../../advocanote-backend/test_all_users.py#L13)

### test_scheduled_yearly.py

[D:/AdvocaNote/advocanote-backend/test_scheduled_yearly.py](../../advocanote-backend/test_scheduled_yearly.py)

Test or environment support for test scheduled yearly. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** [advocanote-backend/app/routers/__init__.py](../../advocanote-backend/app/routers/__init__.py), [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `datetime`, `pytest`, `types`, `unittest.mock`
- **Declarations and study starting lines:** [test_scheduled_yearly_sync(monkeypatch, user_id, invoice_price)](../../advocanote-backend/test_scheduled_yearly.py#L11)

### test_stripe.py

[D:/AdvocaNote/advocanote-backend/test_stripe.py](../../advocanote-backend/test_stripe.py)

Test or environment support for test stripe. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `stripe`
- **Declarations and study starting lines:** No static match.

### test_whisper.py

[D:/AdvocaNote/advocanote-backend/test_whisper.py](../../advocanote-backend/test_whisper.py)

Test or environment support for test whisper. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `faster_whisper`, `pathlib`, `sys`, `time`
- **Declarations and study starting lines:** No static match.

### voice_ai_test.py

[D:/AdvocaNote/advocanote-backend/voice_ai_test.py](../../advocanote-backend/voice_ai_test.py)

Test or environment support for voice ai test. **If removed:** The corresponding verification is lost; inspect external side effects before running it.

- **Local dependencies:** [advocanote-backend/app/services/legal_ai.py](../../advocanote-backend/app/services/legal_ai.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `faster_whisper`, `gc`, `json`, `pathlib`, `sys`, `time`
- **Declarations and study starting lines:** [transcribe_audio(audio_path)](../../advocanote-backend/voice_ai_test.py#L26), [main()](../../advocanote-backend/voice_ai_test.py#L61)

### stripe_webhooks_backup.py

[D:/AdvocaNote/stripe_webhooks_backup.py](../../stripe_webhooks_backup.py)

Historical source copy. **If removed:** No live route is known to depend on this copy.

- **Local dependencies:** [advocanote-backend/app/config.py](../../advocanote-backend/app/config.py), [advocanote-backend/app/database.py](../../advocanote-backend/app/database.py), [advocanote-backend/app/models/payment.py](../../advocanote-backend/app/models/payment.py), [advocanote-backend/app/models/subscription.py](../../advocanote-backend/app/models/subscription.py), [advocanote-backend/app/models/subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py), [advocanote-backend/app/models/user.py](../../advocanote-backend/app/models/user.py)
- **Static importers:** No static match.
- **External or unresolved imports:** `datetime`, `decimal`, `fastapi`, `logging`, `sqlalchemy`, `sqlalchemy.orm`, `stripe`
- **Declarations and study starting lines:** [utc_datetime(timestamp)](../../stripe_webhooks_backup.py#L32), [stripe_id(value)](../../stripe_webhooks_backup.py#L39), [handle_checkout_completed(checkout, db)](../../stripe_webhooks_backup.py#L50), [get_invoice_subscription_id(invoice)](../../stripe_webhooks_backup.py#L281), [verify_paid_upgrade_invoice(invoice_id, db)](../../stripe_webhooks_backup.py#L299), [handle_invoice_paid(invoice, db)](../../stripe_webhooks_backup.py#L439), [handle_subscription_deleted(event_sub, db)](../../stripe_webhooks_backup.py#L700), [handle_invoice_payment_failed(event_invoice, db)](../../stripe_webhooks_backup.py#L760), [handle_subscription_updated(event_sub, db)](../../stripe_webhooks_backup.py#L947), [stripe_webhook(request, db)](../../stripe_webhooks_backup.py#L1069), [get_plan_from_stripe_subscription(stripe_sub, db)](../../stripe_webhooks_backup.py#L1258), [handle_paid_plan_upgrade(invoice_id, db)](../../stripe_webhooks_backup.py#L1303)

### requirements.txt

[D:/AdvocaNote/advocanote-backend/requirements.txt](../../advocanote-backend/requirements.txt)

Backend runtime dependency declarations. **If removed:** Dependency provisioning loses its manifest.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### alembic.ini

[D:/AdvocaNote/advocanote-backend/alembic.ini](../../advocanote-backend/alembic.ini)

Alembic configuration and migration runner settings. **If removed:** Schema history tooling loses its configuration.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

## Frontend file-by-file index

See the [frontend source inventory](02_FRONTEND_COMPLETE_GUIDE.md#complete-frontend-source-inventory) for paths, imports, hook locations and component declarations.
