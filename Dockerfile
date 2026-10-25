# Stage 1: Build React + Tailwind Telegram Mini App & Simulator UI
FROM node:22-alpine AS ui-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Python 3.11 Runtime (FastAPI + aiogram 3.x + Media/PDF/Crypto Engines)
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=ui-builder /app/backend/static_ui ./backend/static_ui/
COPY run.py pyproject.toml ./

RUN mkdir -p data/uploads data/generated

EXPOSE 8000
CMD ["python", "run.py"]
