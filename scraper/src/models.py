"""Modèles SQLAlchemy miroir du schema Prisma (table evenements, agent_jobs).

Les noms de colonnes utilisent les @map() définis dans schema.prisma.
Le schéma PostgreSQL est "foires" (configuré via search_path dans database.py).
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, Numeric, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Evenement(Base):
    """Table evenements — miroir du modèle Prisma Evenement."""

    __tablename__ = "evenements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False, default="AUTRE")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ville: Mapped[str] = mapped_column(String, nullable=False)
    departement: Mapped[str] = mapped_column(String(3), nullable=False)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    adresse_complete: Mapped[str | None] = mapped_column(
        String, name="adresse_complete", nullable=True
    )
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    date_debut: Mapped[datetime] = mapped_column(DateTime, name="date_debut", nullable=False)
    date_fin: Mapped[datetime] = mapped_column(DateTime, name="date_fin", nullable=False)
    recurrence: Mapped[str] = mapped_column(String, nullable=False, default="UNIQUE")
    site_web: Mapped[str | None] = mapped_column(String, name="site_web", nullable=True)
    email_contact: Mapped[str | None] = mapped_column(String, name="email_contact", nullable=True)
    telephone: Mapped[str | None] = mapped_column(String, nullable=True)
    prix_emplacement: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), name="prix_emplacement", nullable=True
    )
    taille_emplacement: Mapped[str | None] = mapped_column(
        String, name="taille_emplacement", nullable=True
    )
    nombre_visiteurs_estime: Mapped[int | None] = mapped_column(
        Integer, name="nombre_visiteurs_estime", nullable=True
    )
    source_url: Mapped[str | None] = mapped_column(String, name="source_url", nullable=True)
    source_nom: Mapped[str | None] = mapped_column(String, name="source_nom", nullable=True)
    hash_dedup: Mapped[str | None] = mapped_column(
        String, name="hash_dedup", unique=True, nullable=True
    )
    scrape_date: Mapped[datetime | None] = mapped_column(
        DateTime, name="scrape_date", nullable=True
    )
    statut_pipeline: Mapped[str] = mapped_column(
        String, name="statut_pipeline", nullable=False, default="DECOUVERT"
    )
    score_pertinence: Mapped[int | None] = mapped_column(
        Integer, name="score_pertinence", nullable=True
    )
    tags_ia: Mapped[dict | None] = mapped_column(JSON, name="tags_ia", nullable=True)
    resume_ia: Mapped[str | None] = mapped_column(String, name="resume_ia", nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, name="created_at", server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, name="updated_at", server_default=func.now(), onupdate=func.now()
    )


class AgentJob(Base):
    """Table agent_jobs — miroir du modèle Prisma AgentJob."""

    __tablename__ = "agent_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_name: Mapped[str] = mapped_column(String, name="agent_name", nullable=False)
    statut: Mapped[str] = mapped_column(String, nullable=False, default="PENDING")
    input_data: Mapped[dict | None] = mapped_column(JSON, name="input_data", nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSON, name="output_data", nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime, name="started_at", nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime, name="completed_at", nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(
        String, name="error_message", nullable=True
    )
    triggered_by: Mapped[str] = mapped_column(
        String, name="triggered_by", nullable=False, default="USER"
    )
    parent_job_id: Mapped[int | None] = mapped_column(
        Integer, name="parent_job_id", nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, name="created_at", server_default=func.now()
    )
