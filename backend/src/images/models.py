from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Image(Base):
    """Image model for storing item photos and AI classification results."""

    __tablename__ = "images"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    item_id: Mapped[UUID | None] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_type: Mapped[str] = mapped_column(String(20), default="local")  # 'local' or 's3'
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_result: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    item: Mapped["Item | None"] = relationship(back_populates="images")
    user: Mapped["User"] = relationship(back_populates="images")


# Import at bottom to avoid circular imports
from src.items.models import Item  # noqa: E402, F811
from src.users.models import User  # noqa: E402, F811
