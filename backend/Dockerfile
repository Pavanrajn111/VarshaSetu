# Varsha Setu — Hyperlocal Monsoon AI Serving Layer (SIH 26086)
# Containerized Deployment for FastAPI + XGBoost/Scikit-Learn ML Inference
FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ARTIFACTS_DIR=/app/artifacts
ENV HOST=0.0.0.0
ENV PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code & pre-trained ML artifacts
COPY app /app/app
COPY artifacts /app/artifacts
COPY main.py /app/main.py

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker -w 2 main:app --bind 0.0.0.0:${PORT:-8000}"]
