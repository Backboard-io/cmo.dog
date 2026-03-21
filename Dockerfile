FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app/

# Install Python dependencies first for better layer caching.
COPY pyproject.toml README.md ./
RUN pip install --upgrade pip && pip install -e .

# Copy API source.
COPY app/ ./app
COPY web /app/web

EXPOSE 8000
EXPOSE 9000

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app/web
RUN npm install --legacy-peer-deps && npm run build && \
mkdir -p /app/web/.next/standalone/.next && \
cp -r /app/web/.next/static /app/web/.next/standalone/.next/static && \
cp -r /app/web/public /app/web/.next/standalone/public
WORKDIR /app

CMD ["sh", "-c", "uvicorn app.main:app --host 127.0.0.1 --port 9000 & sleep 5 && cd /app/web && PORT=8000 NODE_ENV=production HOSTNAME=0.0.0.0 exec node .next/standalone/server.js"]
