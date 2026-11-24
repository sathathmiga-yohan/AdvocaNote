# Source coverage and unverified items

## Snapshot

Local `D:\AdvocaNote`, Git `main` at `44ca5d0` with existing uncommitted changes. Source paths below are the current working tree. This chapter is a navigation and evidence inventory. Line references correspond to the inspected source, while deployed code and data can differ.

## Feature inventory and detailed coverage destination

| Feature | Verified code surface | Primary router | Planned full Q&A |
|---|---|---|---|
| Accounts | Register, password/Google login, logout, refresh, email verification, password recovery, account recovery/closure | [auth.py](../../advocanote-backend/app/routers/auth.py) | 08, 09, 13 |
| Profiles and onboarding | Lawyer profile and photo, onboarding data, onboarding completion guards | [onboarding.py](../../advocanote-backend/app/routers/onboarding.py) | 08, 09, 13 |
| Diary | Create, overview/date filter, case history, details, update, delete, statistics, next hearing data, quota | [diary.py](../../advocanote-backend/app/routers/diary.py) | 07, 09, 13 |
| Cases and courts | Case CRUD, type/stage/status, court association and ownership; court wiring is part of legal workflows | [cases.py](../../advocanote-backend/app/routers/cases.py) | 07, 09, 13 |
| Hearings | Upcoming/list, reschedule and status; diary may create a hearing from submitted data | [hearings.py](../../advocanote-backend/app/routers/hearings.py) | 07, 09, 13 |
| Tasks | Manual tasks, case task list, status/deadlines and reminder connections | [tasks.py](../../advocanote-backend/app/routers/tasks.py) | 07, 09, 13 |
| Calendar | Owned legal-event aggregation, custom event CRUD, date/navigation UI | [calendar.py](../../advocanote-backend/app/routers/calendar.py) | 07, 09, 13 |
| Lawyer notifications | Reminders and notification list/read/unread | [notifications.py](../../advocanote-backend/app/routers/notifications.py) | 07, 09, 13 |
| AI | Text analysis, optional combined voice analysis, JSON/evidence validation, notes/highlights, human review of suggestions | [voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py) | 10, 13 |
| Voice files | Transcription separate from storage; saved owned metadata and playback | [voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py) | 11, 13 |
| Access, trials and quotas | Official-plan eligibility, first trial, expiry, feature guard, diary usage by Colombo date | [subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py) | 12, 13 |
| Billing | Catalog, Checkout, payment history, upgrade/downgrade, Manage Billing, renewal/cancellation and reconciliation | [lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py) | 12, 13 |
| Staff tools | Admin plan/subscription controls; separate routers for lawyer status and staff settings; SQLite staff notifications | [admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py) | 08, 09, 12, 13 |

- **IMPLEMENTED IN LOCAL CODE:** Admin reads and plan management, lawyer active-status controls, admin settings, admin notifications. Use [admin guard](../../advocanote-backend/app/auth/admin_guard.py), [lawyer router](../../advocanote-backend/app/routers/admin_lawyers.py), [admin settings](../../advocanote-backend/app/routers/admin_settings.py), [staff SQLite router factory](../../advocanote-backend/admin_notifications_api.py).
- **IMPLEMENTED, RUNTIME UNVERIFIED:** Local configurable registration OTP. Code default is false. Older study guides reference verification file names that no longer match this working tree. Pending verification can block normal login. The renamed [OTP service](../../advocanote-backend/app/services/otp_verification.py), [OTP model](../../advocanote-backend/app/models/otp_verification.py), and [registration handler](../../advocanote-backend/app/routers/auth.py#L59) are the current entry points.
- **PARTIALLY IMPLEMENTED:** AI response supports notes, highlights and task suggestions. The inspected analysis path returns an empty AI followups list. Follow-up fields alone don't prove generation of additional followups. [AI service](../../advocanote-backend/app/services/legal_ai.py#L1246)
- **NOT IMPLEMENTED IN ACTIVE PATH:** No Grok, Gemini, OpenRouter, Pollinations, RAG/vector retrieval or fine-tuning pipeline was found in the inspected diary inference path. No dedicated staff support/feedback or court-admin workflow was identified in the inspected routes. [Mounted app](../../advocanote-backend/app/main.py#L144)
- **UNMOUNTED:** `subscription_billing.py` and `google_recovery.py` are present but not directly mounted by current `main.py`. Use the active route and caller inventory. A filename or backup copy does not prove production behavior.
- **FUTURE IMPROVEMENT:** A durable scheduler, separately hosted inference endpoint, and store-independent media backup could be discussed as design proposals.

## Data model inventory

21 distinct table mappings visible in current ORM source. The Alembic metadata table `alembic_version` and separate admin SQLite store are additional storage concerns. The list is a source inventory, not a read of hosted MySQL.

| MySQL mapped table | Source declaration |
|---|---|
| `account_deletions` | [account_deletion.py](../../advocanote-backend/app/models/account_deletion.py#L15) |
| `cases` | [case.py](../../advocanote-backend/app/models/case.py#L17) |
| `calendar_custom_events` | [calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py#L16) |
| `ai_suggestions` | [aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py#L17) |
| `account_recovery_tokens` | [account_recovery_token.py](../../advocanote-backend/app/models/account_recovery_token.py#L22) |
| `diary_entries` | [diary.py](../../advocanote-backend/app/models/diary.py#L17) |
| `diary_ai_analyses` | [diary.py](../../advocanote-backend/app/models/diary.py#L60) |
| `reminders` | [reminder.py](../../advocanote-backend/app/models/reminder.py#L23) |
| `password_resets` | [reset.py](../../advocanote-backend/app/models/reset.py#L19) |
| `hearings` | [hearing.py](../../advocanote-backend/app/models/hearing.py#L17) |
| `login_sessions` | [session.py](../../advocanote-backend/app/models/session.py#L19) |
| `courts` | [court.py](../../advocanote-backend/app/models/court.py#L17) |
| `subscriptions` | [subscription.py](../../advocanote-backend/app/models/subscription.py#L22) |
| `subscription_daily_usage` | [subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py#L29) |
| `verifications` | [otp_verification.py](../../advocanote-backend/app/models/otp_verification.py#L19) |
| `payments` | [payment.py](../../advocanote-backend/app/models/payment.py#L23) |
| `subscription_upgrades` | [payment.py](../../advocanote-backend/app/models/payment.py#L108) |
| `subscription_plans` | [subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py#L21) |
| `tasks` | [task.py](../../advocanote-backend/app/models/task.py#L17) |
| `users` | [user.py](../../advocanote-backend/app/models/user.py#L21) |
| `diary_voice_attachments` | [voice_attachment.py](../../advocanote-backend/app/models/voice_attachment.py#L17) |

Voice and profile binaries have filesystem storage. The migration `0d7bb486f2a1` follows `f6f9c4214d30` in source and was untracked at inspection. Actual deployment schema, applied revision, data counts, FK and index drift are **UNVERIFIED**. [Latest local revision](../../advocanote-backend/migrations/versions/0d7bb486f2a1_complete_application_schema.py#L11) · [Storage router](../../advocanote-backend/app/routers/voice_storage.py#L52) · [Profile photo service](../../advocanote-backend/app/services/profile_photo_service.py) · [Admin SQLite](../../advocanote-backend/admin_notifications_api.py#L30).

## Source navigation

### Frontend pages (20)

- [AISuggestions.jsx](../../advocanote-frontend/src/pages/AISuggestions.jsx)
- [AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx)
- [Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx)
- [CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx)
- [CaseTasks.jsx](../../advocanote-frontend/src/pages/CaseTasks.jsx)
- [DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx)
- [ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx)
- [Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx)
- [Home.jsx](../../advocanote-frontend/src/pages/Home.jsx)
- [Login.jsx](../../advocanote-frontend/src/pages/Login.jsx)
- [MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx)
- [MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx)
- [Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)
- [Register.jsx](../../advocanote-frontend/src/pages/Register.jsx)
- [RejoinAccount.jsx](../../advocanote-frontend/src/pages/RejoinAccount.jsx)
- [ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx)
- [SriLankaCourtFields.jsx](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx)
- [Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx)
- [TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)
- [VerifyEmail.jsx](../../advocanote-frontend/src/pages/VerifyEmail.jsx)

### Frontend shared components (14)

- [DiarySavedAIAndVoice.jsx](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx)
- [DiaryVoiceDetails.jsx](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx)
- [FirstLoginOnboarding.jsx](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx)
- [LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- [LawyerSidebar.jsx](../../advocanote-frontend/src/components/LawyerSidebar.jsx)
- [Navbar.jsx](../../advocanote-frontend/src/components/Navbar.jsx)
- [NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx)
- [NotificationDropdown.jsx](../../advocanote-frontend/src/components/NotificationDropdown.jsx)
- [ProfileAvatar.jsx](../../advocanote-frontend/src/components/ProfileAvatar.jsx)
- [ProtectedRoute.jsx](../../advocanote-frontend/src/components/ProtectedRoute.jsx)
- [StructuredLegalNotes.jsx](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx)
- [SubscriptionBilling.jsx](../../advocanote-frontend/src/components/SubscriptionBilling.jsx)
- [SubscriptionGate.jsx](../../advocanote-frontend/src/components/SubscriptionGate.jsx)
- [Toast.jsx](../../advocanote-frontend/src/components/Toast.jsx)

### Frontend admin (9)

- [AdminDashboard.jsx](../../advocanote-frontend/src/admin/AdminDashboard.jsx)
- [AdminLawyers.jsx](../../advocanote-frontend/src/admin/AdminLawyers.jsx)
- [AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx)
- [AdminNotifications.jsx](../../advocanote-frontend/src/admin/AdminNotifications.jsx)
- [AdminPlanManager.jsx](../../advocanote-frontend/src/admin/AdminPlanManager.jsx)
- [AdminRoute.jsx](../../advocanote-frontend/src/admin/AdminRoute.jsx)
- [AdminSettings.jsx](../../advocanote-frontend/src/admin/AdminSettings.jsx)
- [AdminSidebar.jsx](../../advocanote-frontend/src/admin/AdminSidebar.jsx)
- [AdminSubscriptions.jsx](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx)

### Frontend API helpers (6)

- [auth.js](../../advocanote-frontend/src/services/auth.js)
- [diary.js](../../advocanote-frontend/src/services/diary.js)
- [onboardingApi.js](../../advocanote-frontend/src/services/onboardingApi.js)
- [otpRecovery.js](../../advocanote-frontend/src/services/otpRecovery.js)
- [profileApi.js](../../advocanote-frontend/src/services/profileApi.js)
- [voiceAi.js](../../advocanote-frontend/src/services/voiceAi.js)

### Backend routers (22)

- [__init__.py](../../advocanote-backend/app/routers/__init__.py)
- [account.py](../../advocanote-backend/app/routers/account.py)
- [admin_lawyers.py](../../advocanote-backend/app/routers/admin_lawyers.py)
- [admin_settings.py](../../advocanote-backend/app/routers/admin_settings.py)
- [admin_subscriptions.py](../../advocanote-backend/app/routers/admin_subscriptions.py)
- [auth.py](../../advocanote-backend/app/routers/auth.py)
- [calendar.py](../../advocanote-backend/app/routers/calendar.py)
- [cases.py](../../advocanote-backend/app/routers/cases.py)
- [diary.py](../../advocanote-backend/app/routers/diary.py)
- [google_recovery.py](../../advocanote-backend/app/routers/google_recovery.py) — unmounted in inspected app
- [hearings.py](../../advocanote-backend/app/routers/hearings.py)
- [lawyer_subscriptions.py](../../advocanote-backend/app/routers/lawyer_subscriptions.py)
- [notifications.py](../../advocanote-backend/app/routers/notifications.py)
- [onboarding.py](../../advocanote-backend/app/routers/onboarding.py)
- [otp_recovery.py](../../advocanote-backend/app/routers/otp_recovery.py)
- [profile.py](../../advocanote-backend/app/routers/profile.py)
- [stripe_webhooks.py](../../advocanote-backend/app/routers/stripe_webhooks.py)
- [subscription_billing.py](../../advocanote-backend/app/routers/subscription_billing.py) — unmounted in inspected app
- [subscription_experience.py](../../advocanote-backend/app/routers/subscription_experience.py)
- [tasks.py](../../advocanote-backend/app/routers/tasks.py)
- [voice_ai.py](../../advocanote-backend/app/routers/voice_ai.py)
- [voice_storage.py](../../advocanote-backend/app/routers/voice_storage.py)

### Backend services and auth dependencies (17)

- [__init__.py](../../advocanote-backend/app/auth/__init__.py)
- [admin_guard.py](../../advocanote-backend/app/auth/admin_guard.py)
- [onboarding_guard.py](../../advocanote-backend/app/auth/onboarding_guard.py)
- [security.py](../../advocanote-backend/app/auth/security.py)
- [subscription_guard.py](../../advocanote-backend/app/auth/subscription_guard.py)
- [__init__.py](../../advocanote-backend/app/services/__init__.py)
- [auth.py](../../advocanote-backend/app/services/auth.py)
- [email.py](../../advocanote-backend/app/services/email.py)
- [google.py](../../advocanote-backend/app/services/google.py)
- [legal_ai.py](../../advocanote-backend/app/services/legal_ai.py)
- [onboarding_service.py](../../advocanote-backend/app/services/onboarding_service.py)
- [otp_verification.py](../../advocanote-backend/app/services/otp_verification.py)
- [profile_photo_service.py](../../advocanote-backend/app/services/profile_photo_service.py)
- [profile_service.py](../../advocanote-backend/app/services/profile_service.py)
- [reset.py](../../advocanote-backend/app/services/reset.py)
- [subscription_trial.py](../../advocanote-backend/app/services/subscription_trial.py)
- [subscription_usage.py](../../advocanote-backend/app/services/subscription_usage.py)

### Schemas and models (28)

- [__init__.py](../../advocanote-backend/app/models/__init__.py)
- [account_deletion.py](../../advocanote-backend/app/models/account_deletion.py)
- [account_recovery_token.py](../../advocanote-backend/app/models/account_recovery_token.py)
- [aisuggestion.py](../../advocanote-backend/app/models/aisuggestion.py)
- [calendar_custom_event.py](../../advocanote-backend/app/models/calendar_custom_event.py)
- [case.py](../../advocanote-backend/app/models/case.py)
- [court.py](../../advocanote-backend/app/models/court.py)
- [diary.py](../../advocanote-backend/app/models/diary.py)
- [hearing.py](../../advocanote-backend/app/models/hearing.py)
- [otp_verification.py](../../advocanote-backend/app/models/otp_verification.py)
- [payment.py](../../advocanote-backend/app/models/payment.py)
- [reminder.py](../../advocanote-backend/app/models/reminder.py)
- [reset.py](../../advocanote-backend/app/models/reset.py)
- [session.py](../../advocanote-backend/app/models/session.py)
- [subscription.py](../../advocanote-backend/app/models/subscription.py)
- [subscription_daily_usage.py](../../advocanote-backend/app/models/subscription_daily_usage.py)
- [subscription_plan.py](../../advocanote-backend/app/models/subscription_plan.py)
- [task.py](../../advocanote-backend/app/models/task.py)
- [user.py](../../advocanote-backend/app/models/user.py)
- [voice_attachment.py](../../advocanote-backend/app/models/voice_attachment.py)
- [__init__.py](../../advocanote-backend/app/schemas/__init__.py)
- [auth.py](../../advocanote-backend/app/schemas/auth.py)
- [case.py](../../advocanote-backend/app/schemas/case.py)
- [diary.py](../../advocanote-backend/app/schemas/diary.py)
- [onboarding.py](../../advocanote-backend/app/schemas/onboarding.py)
- [profile.py](../../advocanote-backend/app/schemas/profile.py)
- [subscription.py](../../advocanote-backend/app/schemas/subscription.py)
- [task.py](../../advocanote-backend/app/schemas/task.py)

### Alembic (20)

- [env.py](../../advocanote-backend/migrations/env.py)
- [0d7bb486f2a1_complete_application_schema.py](../../advocanote-backend/migrations/versions/0d7bb486f2a1_complete_application_schema.py)
- [2ce42a642a99_create_users_table.py](../../advocanote-backend/migrations/versions/2ce42a642a99_create_users_table.py)
- [3624a224a6d1_add_lawyer_onboarding_profile.py](../../advocanote-backend/migrations/versions/3624a224a6d1_add_lawyer_onboarding_profile.py)
- [38aee0ee9923_create_payments_table.py](../../advocanote-backend/migrations/versions/38aee0ee9923_create_payments_table.py)
- [3a7ec36244b3_create_password_resets_table.py](../../advocanote-backend/migrations/versions/3a7ec36244b3_create_password_resets_table.py)
- [4138f2f6e75f_allow_manual_tasks.py](../../advocanote-backend/migrations/versions/4138f2f6e75f_allow_manual_tasks.py)
- [44c054ddbe95_create_login_sessions_table.py](../../advocanote-backend/migrations/versions/44c054ddbe95_create_login_sessions_table.py)
- [4501bae7bce5_add_hearing_purpose.py](../../advocanote-backend/migrations/versions/4501bae7bce5_add_hearing_purpose.py)
- [60abde51d92e_add_hearing_reschedule_fields.py](../../advocanote-backend/migrations/versions/60abde51d92e_add_hearing_reschedule_fields.py)
- [7024b90b2279_create_lawyer_subscriptions.py](../../advocanote-backend/migrations/versions/7024b90b2279_create_lawyer_subscriptions.py)
- [7d93423a65df_create_verifications_table.py](../../advocanote-backend/migrations/versions/7d93423a65df_create_verifications_table.py)
- [9d9dd1fe79b9_add_legal_diary_tables.py](../../advocanote-backend/migrations/versions/9d9dd1fe79b9_add_legal_diary_tables.py)
- [9e57dd0418e7_add_lawyer_professional_profile_fields.py](../../advocanote-backend/migrations/versions/9e57dd0418e7_add_lawyer_professional_profile_fields.py)
- [c28bc937b3dd_add_case_type_and_case_stage.py](../../advocanote-backend/migrations/versions/c28bc937b3dd_add_case_type_and_case_stage.py)
- [c5ba33c8d092_allow_manual_tasks.py](../../advocanote-backend/migrations/versions/c5ba33c8d092_allow_manual_tasks.py)
- [e3e8e3a14c3a_create_hearing_purpose_column.py](../../advocanote-backend/migrations/versions/e3e8e3a14c3a_create_hearing_purpose_column.py)
- [e4188767de73_create_subscription_plans.py](../../advocanote-backend/migrations/versions/e4188767de73_create_subscription_plans.py)
- [ead393f05b53_add_lawyer_profile_professional_fields.py](../../advocanote-backend/migrations/versions/ead393f05b53_add_lawyer_profile_professional_fields.py)
- [f6f9c4214d30_add_subscription_upgrade_attempts.py](../../advocanote-backend/migrations/versions/f6f9c4214d30_add_subscription_upgrade_attempts.py)

## Prior study documentation

- [01_PROJECT_ARCHITECTURE.md](../technical-study/01_PROJECT_ARCHITECTURE.md)
- [02_FRONTEND_COMPLETE_GUIDE.md](../technical-study/02_FRONTEND_COMPLETE_GUIDE.md)
- [03_BACKEND_COMPLETE_GUIDE.md](../technical-study/03_BACKEND_COMPLETE_GUIDE.md)
- [04_DATABASE_AND_RELATIONSHIPS.md](../technical-study/04_DATABASE_AND_RELATIONSHIPS.md)
- [05_AI_AND_VOICE.md](../technical-study/05_AI_AND_VOICE.md)
- [06_SUBSCRIPTIONS_AND_PAYMENTS.md](../technical-study/06_SUBSCRIPTIONS_AND_PAYMENTS.md)
- [07_SECURITY_AND_AUTHENTICATION.md](../technical-study/07_SECURITY_AND_AUTHENTICATION.md)
- [08_FEATURE_WORKFLOWS.md](../technical-study/08_FEATURE_WORKFLOWS.md)
- [09_FILE_BY_FILE_STUDY_PLAN.md](../technical-study/09_FILE_BY_FILE_STUDY_PLAN.md)
- [10_TECHNICAL_VIVA_QA.md](../technical-study/10_TECHNICAL_VIVA_QA.md)

Source overrides chapter guidance when they differ. Treat descriptive summaries, inventory listings, and previously reported Test Mode findings as different evidence types. Script files such as `test_stripe.py` and `test_scheduled_yearly.py` were not executed. A script filename does not certify a test or make the script safe to run against configured services.

## Deployment and verification boundaries

| Area | What evidence is still needed |
|---|---|
| Hosted registration and trial | Active deployed commit, registration flags, eligible user history, official plan records and `/subscriptions/access` behavior. |
| Missing plan cards | Actual HTTP response for `/subscriptions/plans`, authentication, deployed API URL, CORS, database target, official IDs and active flags. An empty schema is different from an existing table with zero rows. |
| Billing | Live/Test mode per deployment, portal settings, signed event delivery, invoice match, duplicate handling, upgrade retirement and renewal timeline. |
| AI and voice | Ollama reachability from the running API, model weights, CPU/RAM, supported audio, Tamil/mixed accuracy and measured latency. |
| Media and SQLite | Active volume/mount, file references and recovery drill. |
| Auth and email | Actual SMTP delivery, feature settings, hosted JWT/session setup and role/ownership tests against disposable users only. |

## Coverage audit status

This pass mapped every original question and indexed local feature and source evidence. Full feature Q&A, detailed table column/reference audits, complete package-by-package treatment, final ERD, end-to-end diagrams and remaining per-question answers require later chapters. The final handbook-level quality audit stays open until those chapters are written.
