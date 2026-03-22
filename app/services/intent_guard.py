"""Semantic intent guard — rejects chat messages outside CMO/marketing scope.

Uses sentence-transformers (all-MiniLM-L6-v2, ~80 MB) to embed the incoming
message and compute cosine similarity against a curated corpus of valid Onni
queries. Messages scoring below THRESHOLD are rejected before the LLM is
ever called — zero Backboard cost, <15 ms latency after warm-up.

The model is loaded lazily and only once (process lifetime). The exemplar
embeddings are pre-computed at load time.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exemplar corpus — covers the full space of valid Onni queries.
# Add more examples to widen scope; raising THRESHOLD tightens it.
# ---------------------------------------------------------------------------
_EXEMPLARS: list[str] = [
    # Audit & SEO
    "What are my biggest SEO issues?",
    "How can I improve my SEO score?",
    "Why is my performance score low?",
    "What is missing from my sitemap?",
    "How do I fix my robots.txt?",
    "What pages are blocked from indexing?",
    "How do I improve page load speed?",
    "What meta tags are missing?",
    "How can I improve my accessibility score?",
    "What are the best practices violations on my site?",
    "Can you summarize the audit results?",
    "What are the highest priority fixes?",
    "Which issue should I tackle first?",
    "Walk me through the failed checks",
    "What does this SEO issue mean?",
    "How do I add structured data to my site?",
    "Is my site mobile-friendly?",
    # Competitor analysis
    "Who are my main competitors?",
    "How do I compare to my competitors?",
    "What is my competitive positioning?",
    "What are competitors charging?",
    "How is my pricing compared to the market?",
    "Are there competitors I'm missing?",
    "What differentiates me from my competitors?",
    # Brand voice & content
    "What is my brand voice?",
    "How would you describe my brand tone?",
    "What content strategy do you recommend?",
    "Can you draft a content brief?",
    "What messaging improvements would you suggest?",
    "How can I differentiate my copy?",
    "What keywords should I focus on?",
    "Suggest a blog topic for my audience",
    "How does my brand positioning compare to competitors?",
    "Write a headline for my homepage",
    "Improve this tagline",
    # General CMO / marketing strategy
    "What are my top marketing priorities?",
    "How can I get more organic traffic?",
    "Where should I invest my marketing budget?",
    "How do I improve my conversion rate?",
    "What growth tactics do you recommend?",
    "Give me a marketing action plan",
    "What should I do next to grow my site?",
    "How do I build backlinks?",
    "What is my target audience?",
    "How do I improve my email marketing?",
    "What social media strategy fits my brand?",
    # report questions
    "What is my SEO score?",
    "What is my accessibility score?",
    "What is my best practices score?",
    "What is my SEO score?",
    "What is my accessibility score?",
    "What is my best practices score?",
    "What is my SEO score?",
    "What is my accessibility score?",
    "Show me my report."
    "what is my report?"
    "how does myaudit look?"
]

# Cosine similarity threshold (0–1). Raise to tighten, lower to loosen.
# all-MiniLM-L6-v2: in-scope messages typically score 0.40–1.0,
# off-topic messages (poetry, coding, recipes, etc.) score <0.30.
_THRESHOLD: float = 0.40

# ---------------------------------------------------------------------------
# Module-level cache — loaded once per process
# ---------------------------------------------------------------------------
_model: Optional[object] = None
_exemplar_embeddings: Optional[object] = None
_load_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    global _load_lock
    if _load_lock is None:
        _load_lock = asyncio.Lock()
    return _load_lock


def _load_sync() -> tuple:
    """Blocking model load — runs in thread pool executor."""
    global _model, _exemplar_embeddings
    if _model is not None:
        return _model, _exemplar_embeddings

    from sentence_transformers import SentenceTransformer  # type: ignore

    logger.info("[intent_guard] Loading all-MiniLM-L6-v2…")
    m = SentenceTransformer("all-MiniLM-L6-v2")
    emb = m.encode(_EXEMPLARS, normalize_embeddings=True, convert_to_numpy=True)
    _model = m
    _exemplar_embeddings = emb
    logger.info("[intent_guard] Model ready, %d exemplars embedded", len(_EXEMPLARS))
    return m, emb


async def _ensure_loaded() -> tuple:
    """Lazy async loader — blocks only on the first call."""
    global _model, _exemplar_embeddings
    if _model is not None:
        return _model, _exemplar_embeddings

    async with _get_lock():
        if _model is not None:
            return _model, _exemplar_embeddings
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _load_sync)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def check_intent(message: str) -> tuple[bool, float]:
    """Return ``(is_in_scope, best_similarity_score)``.

    is_in_scope=True  → message is within CMO/marketing domain, allow through.
    is_in_scope=False → caller should return a polite refusal without hitting
                        the LLM at all.
    """
    model, exemplar_emb = await _ensure_loaded()
    loop = asyncio.get_running_loop()

    def _score() -> float:
        msg_emb = model.encode(
            [message], normalize_embeddings=True, convert_to_numpy=True
        )
        # Dot product of L2-normalised vectors == cosine similarity
        sims = (exemplar_emb @ msg_emb.T).flatten()
        return float(sims.max())

    best = await loop.run_in_executor(None, _score)
    in_scope = best >= _THRESHOLD
    logger.debug(
        "[intent_guard] message=%r score=%.3f in_scope=%s", message[:60], best, in_scope
    )
    return in_scope, best


async def warmup() -> None:
    """Pre-load the model at startup so the first chat has no cold-start lag."""
    await _ensure_loaded()
