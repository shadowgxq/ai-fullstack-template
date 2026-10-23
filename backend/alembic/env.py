from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.core.config import settings
from app.core.base import Base

# 导入所有模型，使其注册到 Base.metadata，alembic autogenerate 才能发现。
# 新增业务模型后，在此追加一行 import。
from app.models.user import User  # noqa: F401
from app.models.user_profile import UserProfile  # noqa: F401
from app.models.wardrobe_preferences import WardrobePreferences  # noqa: F401
from app.models.weather_region import WeatherRegion  # noqa: F401
from app.models.weather_context import WeatherContext  # noqa: F401
from app.models.recommendation import RecommendationRequest, RecommendationOutbox  # noqa: F401
from app.models.wechat_identity import WechatIdentity  # noqa: F401
from app.models.account_revision import AccountRevision  # noqa: F401
from app.models.idempotency_receipt import IdempotencyReceipt  # noqa: F401
from app.models.garment import Garment  # noqa: F401
from app.models.media_asset import MediaAsset  # noqa: F401
from app.models.wear_record import WearRecord, WearRecordItem, WearRecordTombstone  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Override sqlalchemy.url from app settings
# ConfigParser uses percent interpolation; preserve URL-encoded credentials/options.
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
