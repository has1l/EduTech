FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "set -e; echo '=== alembic ==='; alembic upgrade head; echo '=== seed ==='; python seed.py; echo '=== uvicorn ==='; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level debug 2>&1"]
