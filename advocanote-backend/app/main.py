
import logging
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import engine
from app.auth.security import get_current_user

from app.routers.auth import router as auth_router
from app.routers.diary import router as diary_router
from app.routers.otp_recovery import router as otp_recovery_router
from app.routers import cases, hearings, tasks, calendar
from app.routers.onboarding import router as onboarding_router
from app.auth.onboarding_guard import require_onboarding_complete
from app.routers.profile import router as profile_router
from app.routers.admin_subscriptions import router as admin_subscriptions_router
from app.routers.lawyer_subscriptions import router as lawyer_subscriptions_router
from app.routers.stripe_webhooks import router as stripe_webhooks_router
from app.auth.subscription_guard import require_feature
from app.routers.notifications import router as notifications_router
from app.routers.admin_lawyers import router as admin_lawyers_router
from admin_notifications_api import create_notifications_router
from app.routers import voice_ai
from app.routers.voice_storage import router as voice_storage_router
from app.routers import account
from app.routers.subscription_experience import (
    router as subscription_experience_router,
    trial_notification_scheduler,
)

from app.routers.admin_settings import router as admin_settings_router
from app.models.diary import DiaryAIAnalysis, DiaryEntry
import asyncio

def upgrade_reminders_table():
    with engine.begin() as connection:
        inspector = inspect(connection)

        if not inspector.has_table("reminders"):
            return

        columns = {
            column["name"]
            for column in inspector.get_columns("reminders")
        }

        if "is_read" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE reminders "
                    "ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        if "read_at" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE reminders "
                    "ADD COLUMN read_at DATETIME NULL"
                )
            )
        if "custom_event_id" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE reminders "
                    "ADD COLUMN custom_event_id INTEGER NULL"
                )
            )




@asynccontextmanager
async def lifespan(app: FastAPI):

    upgrade_reminders_table()

    # The parent table is created by the Alembic diary migration.
    with engine.begin() as connection:
        if inspect(connection).has_table(DiaryEntry.__tablename__):
            DiaryAIAnalysis.__table__.create(bind=connection, checkfirst=True)
        else:
            logging.getLogger(__name__).warning(
                "Skipping diary_ai_analyses initialization: diary_entries is missing. "
                "Apply the existing Alembic migrations before using diary features."
            )

    # Start automatic trial notification checks
    trial_task = asyncio.create_task(
        trial_notification_scheduler()
    )

    try:
        yield

    finally:
        trial_task.cancel()

        try:
            await trial_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="AdvocaNote API",
    description="AI Smart Legal Diary Backend",
    version="1.0.0",
    lifespan=lifespan,
)


frontend_url = urlsplit(settings.FRONTEND_URL.strip())
if (
    frontend_url.scheme not in ("http", "https")
    or not frontend_url.hostname
    or frontend_url.username is not None
    or "*" in frontend_url.netloc
):
    raise ValueError("FRONTEND_URL must be an absolute HTTP(S) URL with a specific host")

frontend_host = frontend_url.netloc.lower()
if frontend_url.port == (443 if frontend_url.scheme == "https" else 80):
    frontend_host = frontend_host.rsplit(":", 1)[0]
frontend_origin = f"{frontend_url.scheme}://{frontend_host}"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        frontend_origin,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)

app.include_router(otp_recovery_router)

app.include_router(onboarding_router)

app.include_router(
    create_notifications_router(get_current_user)
)

app.include_router(
    diary_router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

app.include_router(
    cases.router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

app.include_router(
    hearings.router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

app.include_router(
    tasks.router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

app.include_router(
    calendar.router,
    dependencies=[
        Depends(require_onboarding_complete),
        Depends(require_feature("calendar")),
    ],
)

app.include_router(profile_router)

app.include_router(admin_subscriptions_router)

app.include_router(admin_lawyers_router)

app.include_router(lawyer_subscriptions_router)

app.include_router(stripe_webhooks_router)

app.include_router(admin_settings_router)



app.include_router(
    notifications_router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

app.include_router(voice_ai.router)

app.include_router(voice_storage_router)

app.include_router(account.router)

app.include_router(subscription_experience_router)


@app.get("/")
def home():
    return {
        "message": "AdvocaNote Backend Running"
    }
