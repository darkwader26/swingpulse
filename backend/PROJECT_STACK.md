name: swingpulse
version: 0.1.0
description: Agent-pipeline swing trading company backend
python: "3.11"
stack:
  api: FastAPI
  orm: SQLAlchemy 2.0 (async)
  db: PostgreSQL + TimescaleDB
  migration: Alembic
  queue: Redis (agent event bus)
  docker: Compose
