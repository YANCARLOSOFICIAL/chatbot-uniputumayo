"""Embedding of short user questions for question-vs-question matching.

Shared by the answer cache (chat_service.py) and the curated FAQ
(faq_service.py): both compare a user's question against stored questions,
so they must use the same model and the same vector space — a FAQ entry
embedded with one model can't be matched against a question embedded with
another. Kept in one place so the two can never drift apart.

Why embeddinggemma via Ollama and not the RAG embedding model: see
settings.answer_cache_embedding_model (config.py) — nomic-embed-text is
tuned for document retrieval and barely separates deep paraphrases from
unrelated questions; embeddinggemma separates them cleanly.
"""
import asyncio
import logging

from app.config import settings
from app.providers.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)


async def embed_question(text: str) -> list[float] | None:
    """Embed one question with the answer-cache model.

    Returns None (instead of raising) when Ollama is unreachable or slower
    than `answer_cache_embed_timeout_seconds`: a chat deployment running on
    OpenAI must keep answering even if the local embedding model is down —
    the callers simply skip the FAQ/cache lookup in that case.
    """
    try:
        provider = ProviderFactory.get_provider("ollama")
        result = await asyncio.wait_for(
            provider.embed([text], model=settings.answer_cache_embedding_model),
            timeout=settings.answer_cache_embed_timeout_seconds,
        )
        return result["embeddings"][0]
    except Exception as e:
        logger.warning(
            "Question embedding unavailable, skipping FAQ/cache lookup: %s: %s",
            type(e).__name__, e,
        )
        return None
