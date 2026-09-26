FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
            ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer cache).
COPY scripts/requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

# Core calendar library + web package (see root .dockerignore).
COPY generate_panchanga_calendar.py generate_monthly_calendar.py festival_rules.py panchanga.py datetime_helper.py ./
COPY data/cities.json data/sanskrit_names.json ./data/
COPY config/festivals.cfg ./config/
COPY fonts ./fonts
COPY webapp ./webapp
COPY webapp/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Swiss Ephemeris .se1 data (~100 MB) — downloaded at build time.
ENV SE_EPHE_PATH=/app/ephe
ENV PYTHONPATH=/app
COPY scripts/ensure_ephe.sh /tmp/ensure_ephe.sh
RUN bash /tmp/ensure_ephe.sh && rm /tmp/ensure_ephe.sh

RUN addgroup --system ghadi && adduser --system --ingroup ghadi ghadi \
        && chown -R ghadi:ghadi /app

ENV PORT=8080 \
        PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/', timeout=5)"

USER ghadi

ENTRYPOINT ["/docker-entrypoint.sh"]
