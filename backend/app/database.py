from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _sqlite_add_user_moto_columns() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        cols = {row[1] for row in rows}
        if "moto_marca" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_marca VARCHAR(100)"))
        if "moto_modelo" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_modelo VARCHAR(120)"))
        if "moto_anio" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_anio INTEGER"))


def init_db():
    Base.metadata.create_all(bind=engine)
    _sqlite_add_user_moto_columns()
