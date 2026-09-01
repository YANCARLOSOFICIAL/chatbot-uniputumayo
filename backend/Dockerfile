FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Pre-download the cross-encoder reranker model into the image so the first
# search() in production doesn't pay a ~1min HuggingFace download nor need
# outbound network access at runtime. Best-effort (|| true): a build-time
# network hiccup falls back to a lazy runtime download instead of failing
# the whole image build — see rag_service.py::_get_reranker.
RUN python -c "from app.services.rag_service import _get_reranker; _get_reranker()" || true

# Create uploads directory and make entrypoint executable
RUN mkdir -p /app/uploads && chmod +x /app/entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
