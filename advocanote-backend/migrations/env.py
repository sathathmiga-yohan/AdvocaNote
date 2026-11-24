
from logging.config import fileConfig

from alembic import context

from app.database import Base, engine
from app.models import (
    account_deletion,
    account_recovery_token,
    calendar_custom_event,
    subscription_daily_usage,
    voice_attachment,
)
from app.models.user import User
from app.models.verification import Verification
from app.models.session import LoginSession
from app.models.reset import PasswordReset
from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription import Subscription
from app.models.payment import Payment


import app.models.diary


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


target_metadata = Base.metadata


def run_migrations_offline():

    url = engine.url.render_as_string(
        hide_password=False
    )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"}
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():

    with engine.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
