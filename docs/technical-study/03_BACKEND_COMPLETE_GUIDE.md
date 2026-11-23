# 03 · Backend complete guide

The backend root is `D:/AdvocaNote/advocanote-backend`. The route inventory in this chapter comes from source decorators; the runtime mount decision comes from [main.py](../../advocanote-backend/app/main.py#L122).

## Request lifecycle

1. [Startup](../../advocanote-backend/app/main.py#L37) inspects the reminders table and can add missing columns. The lifespan also creates the mapped diary-AI analysis table if missing, starts trial/subscription notification work and cancels the task on shutdown. Starting the real application can perform DDL. It was deliberately not started as part of this review.
2. FastAPI matches method and path to the decorator. `Depends(get_db)` opens a session; `Depends(get_current_user)` authenticates the caller. Admin, subscription, onboarding, and owner checks are separate concerns. Mounted dependencies can apply to every handler on a router, and handler-level guards may differ.
3. Pydantic deserializes a request schema and validates fields. Transport schemas live in [schemas](../../advocanote-backend/app/schemas/) and some are local to routers. A validation error is not a failed SQL transaction because it precedes handler execution.
4. Handlers call service functions or construct SQLAlchemy statements directly. They use `select`, `db.get`, `db.scalar`, or `db.execute`, then update model instances. `flush` sends SQL and obtains generated keys without finalizing the transaction; `commit` makes changes durable; `rollback` discards the incomplete work.
5. The handler returns a mapping/model, list, or explicit response. FastAPI serializes JSON unless a handler returns something else such as owned audio. An exception communicates status/detail and early exit. The database dependency closes the session at request end.

## Router groups and business services

| Group | Core files and responsibility |
|---|---|
| Identity | `routers/auth.py` delegates registration, login, refresh and logout to `services/auth.py`. `services/verification.py`, `reset.py`, `email.py`, and `google.py` handle identity integrations; `routers/otp_recovery.py` owns the OTP API; `routers/account.py` owns account closure/recovery. |
| Legal workspace | `diary.py` is a multi-table transaction. `cases.py`, `hearings.py`, `tasks.py`, and `calendar.py` manage domain-specific queries and mutations with owner and dependency checks. `notifications.py` reconciles and serializes lawyer reminders. |
| Profile | `onboarding.py` and `profile.py` wrap profile/onboarding services. A shared User row carries professional fields, with filesystem support for profile photos. |
| AI and voice | `voice_ai.py` handles upload/transcription/analyze requests; `legal_ai.py` drives Qwen and checks outputs; `voice_storage.py` attaches recordings to existing owned entries. |
| Billing | `lawyer_subscriptions.py` exposes catalog, Checkout, portal, cancellation and schedules. `subscription_experience.py` handles access/trial state and hosted upgrade attempts. `stripe_webhooks.py` verifies provider events and writes payment/access transitions. `subscription_trial.py` and `subscription_usage.py` implement trial and diary caps. |
| Admin | `admin_lawyers.py` changes account status; `admin_subscriptions.py` manages catalog and reads aggregate history; `admin_settings.py` handles staff account settings. The root `admin_notifications_api.py` builds the separate SQLite-backed admin notifications router. |

## Important functions to step through

| Function | Inputs → result | Why its placement matters |
|---|---|---|
| [get_db](../../advocanote-backend/app/database.py#L35) | No request payload → yields SQLAlchemy session, closes it in cleanup. | Dependency lifetime is distinct from commit time. Reusing a session can retain an earlier transaction snapshot. |
| [create_entry](../../advocanote-backend/app/routers/diary.py#L224) | Validated diary payload plus lawyer/session → stored diary response. | It checks quota, links owned records, creates related rows, then commits together. Separate uploaded media is attached after the entry exists. |
| [consume_daily_action](../../advocanote-backend/app/services/subscription_usage.py#L93) | Session and lawyer ID → quota info or HTTP error. | It locks rows, computes Colombo date, then flushes within the diary transaction. |
| [get_calendar_events](../../advocanote-backend/app/routers/calendar.py#L27) | Viewer plus request filters → events built from application records. | The calendar is a view over several tables; manually added events have their own table. |
| [reconcile_custom_event_reminders](../../advocanote-backend/app/routers/notifications.py#L81) | Lawyer/session context → reconciles reminder data. | Reading notifications can perform writes. This matters for safe diagnostics. |
| [process_checkout_upgrade](../../advocanote-backend/app/routers/stripe_webhooks.py#L104) | Persisted upgrade attempt and session → checkout/expired/retiring/complete outcome. | Verification uses Stripe data. Persisting the replacement before retiring the source allows recovery after an interrupted cancellation. |

## Configuration, background work, and limits

[Settings](../../advocanote-backend/app/config.py) declare database, SMTP, frontend origin, JWT, Google and Stripe configuration. OTP has its own settings in its router. [CORS](../../advocanote-backend/app/main.py#L109) allows configured local frontend origins with credentials, all methods and headers. CORS is a browser rule, not a substitute for authorization. Public production hosting and middleware behavior across reverse proxies were not exercised.

[Schedulers](../../advocanote-backend/app/routers/subscription_experience.py#L1142) periodically reconcile linked upgrade attempts and check expiry notifications. This is an in-process lifecycle task, not an independently observed queue. Notifications and post-commit work may deliberately tolerate failures. The mount scan did not show `subscription_billing.py` or `google_recovery.py` included by current startup. Backup webhook files and standalone test scripts do not prove active behavior.

## Exact route inventory

Methods and paths are extracted from decorators. Parameters show source names. Unmounted declarations are labeled.

### [advocanote-backend/admin_notifications_api.py](../../advocanote-backend/admin_notifications_api.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/admin/notifications` | [get_notifications](../../advocanote-backend/admin_notifications_api.py#L292) | `admin` |
| `PATCH` | `/admin/notifications/read-all` | [mark_all_read](../../advocanote-backend/admin_notifications_api.py#L320) | `admin` |
| `PATCH` | `/admin/notifications/{notification_id}/read` | [mark_one_read](../../advocanote-backend/admin_notifications_api.py#L344) | `notification_id, admin` |
| `POST` | `/admin/notifications/delete-selected` | [delete_selected](../../advocanote-backend/admin_notifications_api.py#L377) | `payload, admin` |
| `DELETE` | `/admin/notifications/{notification_id}` | [delete_one](../../advocanote-backend/admin_notifications_api.py#L413) | `notification_id, admin` |

### [advocanote-backend/app/main.py](../../advocanote-backend/app/main.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/` | [home](../../advocanote-backend/app/main.py#L199) | `` |

### [advocanote-backend/app/routers/account.py](../../advocanote-backend/app/routers/account.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `DELETE` | `/account/me` | [close_my_account](../../advocanote-backend/app/routers/account.py#L216) | `data, db, current_user` |
| `GET` | `/account/admin/deletions` | [get_account_deletions](../../advocanote-backend/app/routers/account.py#L390) | `db, current_user` |
| `POST` | `/account/recovery/request` | [request_account_recovery](../../advocanote-backend/app/routers/account.py#L533) | `data, db` |
| `POST` | `/account/recovery/complete` | [complete_account_recovery](../../advocanote-backend/app/routers/account.py#L721) | `data, db` |

### [advocanote-backend/app/routers/admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `PATCH` | `/admin/lawyers/{lawyer_id}/status` | [update_lawyer_status](../../advocanote-backend/app/routers/admin_lawyers.py#L60) | `lawyer_id, data, db` |

### [advocanote-backend/app/routers/admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/admin/settings/profile` | [get_admin_profile](../../advocanote-backend/app/routers/admin_settings.py#L109) | `current_user` |
| `PATCH` | `/admin/settings/profile` | [update_admin_profile](../../advocanote-backend/app/routers/admin_settings.py#L125) | `data, db, current_user` |
| `POST` | `/admin/settings/password` | [change_admin_password](../../advocanote-backend/app/routers/admin_settings.py#L175) | `data, db, current_user` |

### [advocanote-backend/app/routers/admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/admin/subscriptions/plans` | [create_plan](../../advocanote-backend/app/routers/admin_subscriptions.py#L60) | `data, db` |
| `GET` | `/admin/subscriptions/plans` | [get_all_plans](../../advocanote-backend/app/routers/admin_subscriptions.py#L147) | `db` |
| `PATCH` | `/admin/subscriptions/plans/{plan_id}` | [update_plan](../../advocanote-backend/app/routers/admin_subscriptions.py#L167) | `plan_id, data, db` |
| `PATCH` | `/admin/subscriptions/plans/{plan_id}/daily-limit` | [update_plan_daily_limit](../../advocanote-backend/app/routers/admin_subscriptions.py#L283) | `plan_id, data, db` |
| `POST` | `/admin/subscriptions/plans/{plan_id}/link-stripe` | [link_existing_stripe_price](../../advocanote-backend/app/routers/admin_subscriptions.py#L373) | `plan_id, data, db` |
| `GET` | `/admin/subscriptions/overview` | [get_admin_subscriptions_overview](../../advocanote-backend/app/routers/admin_subscriptions.py#L569) | `db` |
| `DELETE` | `/admin/subscriptions/plans/{plan_id}` | [delete_subscription_plan](../../advocanote-backend/app/routers/admin_subscriptions.py#L752) | `plan_id, db` |

### [advocanote-backend/app/routers/auth.py](../../advocanote-backend/app/routers/auth.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/auth/register` | [register](../../advocanote-backend/app/routers/auth.py#L54) | `data, db` |
| `POST` | `/auth/verify-email` | [verify_email](../../advocanote-backend/app/routers/auth.py#L67) | `data, db` |
| `POST` | `/auth/resend-verification` | [resend_verification](../../advocanote-backend/app/routers/auth.py#L76) | `data, db` |
| `POST` | `/auth/login` | [login](../../advocanote-backend/app/routers/auth.py#L105) | `data, db` |
| `GET` | `/auth/me` | [get_me](../../advocanote-backend/app/routers/auth.py#L116) | `current_user` |
| `POST` | `/auth/refresh` | [refresh](../../advocanote-backend/app/routers/auth.py#L126) | `data, db` |
| `POST` | `/auth/logout` | [logout](../../advocanote-backend/app/routers/auth.py#L137) | `data, db` |
| `POST` | `/auth/forgot-password` | [forgot_password](../../advocanote-backend/app/routers/auth.py#L148) | `data, db` |
| `POST` | `/auth/reset-password` | [reset_password](../../advocanote-backend/app/routers/auth.py#L160) | `data, db` |
| `POST` | `/auth/google` | [login_with_google](../../advocanote-backend/app/routers/auth.py#L176) | `data, db` |

### [advocanote-backend/app/routers/calendar.py](../../advocanote-backend/app/routers/calendar.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/calendar/events` | [get_calendar_events](../../advocanote-backend/app/routers/calendar.py#L27) | `start_date, end_date, db, user` |
| `POST` | `/calendar/events` | [create_custom_event](../../advocanote-backend/app/routers/calendar.py#L301) | `data, db, user` |
| `PATCH` | `/calendar/events/{event_id}` | [update_custom_event](../../advocanote-backend/app/routers/calendar.py#L327) | `event_id, data, db, user` |
| `DELETE` | `/calendar/events/{event_id}` | [delete_custom_event](../../advocanote-backend/app/routers/calendar.py#L370) | `event_id, db, user` |

### [advocanote-backend/app/routers/cases.py](../../advocanote-backend/app/routers/cases.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/cases` | [my_cases](../../advocanote-backend/app/routers/cases.py#L68) | `db, user` |
| `PATCH` | `/cases/{case_id}/status` | [update_case_status](../../advocanote-backend/app/routers/cases.py#L124) | `case_id, data, db, user` |
| `POST` | `/cases` | [create_case](../../advocanote-backend/app/routers/cases.py#L196) | `data, db, user` |
| `DELETE` | `/cases/{case_id}` | [delete_empty_case](../../advocanote-backend/app/routers/cases.py#L338) | `case_id, db, user` |

### [advocanote-backend/app/routers/diary.py](../../advocanote-backend/app/routers/diary.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/diary/overview` | [overview](../../advocanote-backend/app/routers/diary.py#L130) | `entry_date, db, user` |
| `POST` | `/diary/entries` | [create_entry](../../advocanote-backend/app/routers/diary.py#L226) | `data, db, user` |
| `GET` | `/diary/case/{case_id}/history` | [case_history](../../advocanote-backend/app/routers/diary.py#L687) | `case_id, db, user` |
| `GET` | `/diary/entries/{entry_id}` | [get_diary_entry_details](../../advocanote-backend/app/routers/diary.py#L729) | `entry_id, db, user` |
| `PUT` | `/diary/entries/{entry_id}` | [update_diary_entry](../../advocanote-backend/app/routers/diary.py#L799) | `entry_id, data, db, user` |
| `DELETE` | `/diary/entries/{entry_id}` | [delete_diary_entry](../../advocanote-backend/app/routers/diary.py#L962) | `entry_id, db, user` |
| `GET` | `/diary/ai-suggestions` | [get_ai_suggestions](../../advocanote-backend/app/routers/diary.py#L1124) | `db, user` |
| `PATCH` | `/diary/ai-suggestions/{suggestion_id}` | [review_ai_suggestion](../../advocanote-backend/app/routers/diary.py#L1197) | `suggestion_id, data, db, user` |

### [advocanote-backend/app/routers/google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py) · unmounted

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/auth/google-reset-password` | [google_reset_password](../../advocanote-backend/app/routers/google_recovery.py#L69) | `request, body, db` |

### [advocanote-backend/app/routers/hearings.py](../../advocanote-backend/app/routers/hearings.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/hearings` | [hearings](../../advocanote-backend/app/routers/hearings.py#L49) | `db, user` |
| `PATCH` | `/hearings/{hearing_id}/reschedule` | [reschedule_hearing](../../advocanote-backend/app/routers/hearings.py#L120) | `hearing_id, data, db, user` |
| `PATCH` | `/hearings/{hearing_id}/complete` | [complete_hearing](../../advocanote-backend/app/routers/hearings.py#L319) | `hearing_id, db, user` |

### [advocanote-backend/app/routers/lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | [get_available_plans](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L266) | `db, user` |
| `POST` | `/subscriptions/trial` | [start_trial](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L296) | `data, db, user` |
| `GET` | `/subscriptions/me` | [get_my_subscription](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L348) | `db, user` |
| `POST` | `/subscriptions/checkout` | [create_checkout](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L377) | `data, db, user` |
| `GET` | `/subscriptions/payments` | [get_my_payments](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L832) | `db, user` |
| `POST` | `/subscriptions/manage` | [manage_subscription](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L906) | `db, user` |
| `GET` | `/subscriptions/checkout/status` | [get_checkout_payment_status](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L949) | `session_id, db, user` |
| `POST` | `/subscriptions/payments/cleanup` | [cleanup_pending_checkouts](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1077) | `db, user` |
| `POST` | `/subscriptions/change-plan/check` | [check_plan_change](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1196) | `data, db, user` |
| `POST` | `/subscriptions/change-plan/preview` | [preview_plan_change](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1377) | `data, db, user` |
| `POST` | `/subscriptions/change-plan/upgrade` | [upgrade_subscription](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1494) | `data, db, user` |
| `POST` | `/subscriptions/change-plan/downgrade` | [schedule_plan_downgrade](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1538) | `data, db, user` |
| `POST` | `/subscriptions/cancel` | [cancel_my_subscription](../../advocanote-backend/app/routers/lawyer_subscriptions.py#L1774) | `db, user` |

### [advocanote-backend/app/routers/notifications.py](../../advocanote-backend/app/routers/notifications.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/notifications` | [get_my_notifications](../../advocanote-backend/app/routers/notifications.py#L362) | `notification_type, unread_only, db, user` |
| `PATCH` | `/notifications/read-all` | [mark_all_notifications_as_read](../../advocanote-backend/app/routers/notifications.py#L405) | `notification_type, db, user` |
| `PATCH` | `/notifications/{notification_id}/read` | [mark_notification_as_read](../../advocanote-backend/app/routers/notifications.py#L441) | `notification_id, db, user` |
| `PATCH` | `/notifications/{notification_id}/unread` | [mark_notification_as_unread](../../advocanote-backend/app/routers/notifications.py#L484) | `notification_id, db, user` |

### [advocanote-backend/app/routers/onboarding.py](../../advocanote-backend/app/routers/onboarding.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/onboarding/me` | [get_my_onboarding](../../advocanote-backend/app/routers/onboarding.py#L59) | `user` |
| `PUT` | `/onboarding/complete` | [finish_my_onboarding](../../advocanote-backend/app/routers/onboarding.py#L73) | `data, db, user` |

### [advocanote-backend/app/routers/otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/auth/forgot-password/request-otp` | [request_otp](../../advocanote-backend/app/routers/otp_recovery.py#L111) | `data, db` |
| `POST` | `/auth/forgot-password/verify-otp` | [verify_otp](../../advocanote-backend/app/routers/otp_recovery.py#L238) | `data, db` |
| `POST` | `/auth/forgot-password/reset-otp` | [reset_with_otp](../../advocanote-backend/app/routers/otp_recovery.py#L323) | `data, db` |

### [advocanote-backend/app/routers/profile.py](../../advocanote-backend/app/routers/profile.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/profile/me` | [read_my_profile](../../advocanote-backend/app/routers/profile.py#L41) | `user` |
| `POST` | `/profile/photo` | [upload_my_profile_photo](../../advocanote-backend/app/routers/profile.py#L51) | `photo, user` |
| `GET` | `/profile/photo` | [get_my_profile_photo](../../advocanote-backend/app/routers/profile.py#L80) | `user` |
| `DELETE` | `/profile/photo` | [delete_my_profile_photo](../../advocanote-backend/app/routers/profile.py#L105) | `user` |
| `PUT` | `/profile/me` | [edit_my_profile](../../advocanote-backend/app/routers/profile.py#L123) | `data, db, user` |
| `PATCH` | `/profile/me` | [edit_my_profile](../../advocanote-backend/app/routers/profile.py#L123) | `data, db, user` |

### [advocanote-backend/app/routers/stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/webhooks/stripe` | [stripe_webhook](../../advocanote-backend/app/routers/stripe_webhooks.py#L1999) | `request, db` |

### [advocanote-backend/app/routers/subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py) · unmounted

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/subscriptions/me` | [get_my_subscription](../../advocanote-backend/app/routers/subscription_billing.py#L51) | `db, user` |
| `POST` | `/subscriptions/cancel` | [cancel_my_subscription](../../advocanote-backend/app/routers/subscription_billing.py#L60) | `db, user` |

### [advocanote-backend/app/routers/subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/subscriptions/options` | [subscription_options](../../advocanote-backend/app/routers/subscription_experience.py#L169) | `db, user` |
| `GET` | `/subscriptions/access` | [subscription_access](../../advocanote-backend/app/routers/subscription_experience.py#L184) | `db, user` |
| `POST` | `/subscriptions/select` | [select_subscription_plan](../../advocanote-backend/app/routers/subscription_experience.py#L673) | `data, db, user` |
| `POST` | `/subscriptions/sync-paid-upgrade` | [sync_paid_upgrade](../../advocanote-backend/app/routers/subscription_experience.py#L815) | `db, user` |

### [advocanote-backend/app/routers/tasks.py](../../advocanote-backend/app/routers/tasks.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `GET` | `/tasks` | [get_all_tasks](../../advocanote-backend/app/routers/tasks.py#L175) | `db, user` |
| `GET` | `/tasks/case/{case_id}` | [case_tasks](../../advocanote-backend/app/routers/tasks.py#L192) | `case_id, db, user` |
| `POST` | `/tasks/case/{case_id}` | [create_case_task](../../advocanote-backend/app/routers/tasks.py#L221) | `case_id, data, db, user` |
| `PATCH` | `/tasks/{task_id}` | [update_case_task](../../advocanote-backend/app/routers/tasks.py#L272) | `task_id, data, db, user` |
| `DELETE` | `/tasks/{task_id}` | [delete_case_task](../../advocanote-backend/app/routers/tasks.py#L364) | `task_id, db, user` |

### [advocanote-backend/app/routers/voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/voice-ai/transcribe` | [transcribe_voice](../../advocanote-backend/app/routers/voice_ai.py#L330) | `file, language, user` |
| `POST` | `/voice-ai/analyze-text` | [analyze_text](../../advocanote-backend/app/routers/voice_ai.py#L361) | `payload, user` |
| `POST` | `/voice-ai/analyze` | [analyze_voice](../../advocanote-backend/app/routers/voice_ai.py#L387) | `file, language, user` |

### [advocanote-backend/app/routers/voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)

| Method | Path | Handler | Source parameters |
|---|---|---|---|
| `POST` | `/voice-ai/recordings/{entry_id}` | [save_voice_recording](../../advocanote-backend/app/routers/voice_storage.py#L198) | `entry_id, audio, source_transcript, reviewed_transcript, notes_json, highlights_json, approved_notes_json, db, user` |
| `GET` | `/voice-ai/recordings/{entry_id}` | [get_voice_recording](../../advocanote-backend/app/routers/voice_storage.py#L430) | `entry_id, db, user` |
| `GET` | `/voice-ai/recordings/{entry_id}/audio` | [get_voice_audio](../../advocanote-backend/app/routers/voice_storage.py#L482) | `entry_id, db, user` |
