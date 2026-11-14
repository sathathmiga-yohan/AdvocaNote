
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers.auth import router as auth_router
from app.routers.diary import router as diary_router
from app.routers.otp_recovery import (
    router as otp_recovery_router,
)
from app.routers import cases, hearings, tasks, calendar
from app.routers.onboarding import router as onboarding_router
from app.auth.onboarding_guard import (
    require_onboarding_complete,
)
from app.routers.profile import router as profile_router
from app.routers.admin_subscriptions import (
    router as admin_subscriptions_router,
)
from app.routers.lawyer_subscriptions import (
    router as lawyer_subscriptions_router,
)
from app.routers.stripe_webhooks import router as stripe_webhooks_router

from app.auth.subscription_guard import require_feature
from app.routers.subscription_billing import router as subscription_billing_router

from app.routers.notifications import (
    router as notifications_router,
)

app = FastAPI(
    title="AdvocaNote API",
    description="AI Smart Legal Diary Backend",
    version="1.0.0"
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(auth_router)

app.include_router(otp_recovery_router)

# Onboarding must be accessible before profile completion
app.include_router(onboarding_router)

# Lawyer features require completed onboarding


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

# ADMIN SUBSCRIPTION MANAGEMENT
app.include_router(admin_subscriptions_router)

# LAWYER SUBSCRIPTION MANAGEMENT
app.include_router(lawyer_subscriptions_router)

app.include_router(stripe_webhooks_router)

app.include_router(subscription_billing_router)

app.include_router(
    notifications_router,
    dependencies=[
        Depends(require_onboarding_complete),
    ],
)

@app.get("/")
def home():
    return {
        "message": "AdvocaNote Backend Running"
    }
