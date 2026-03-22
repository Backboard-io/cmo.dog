"""One-off: create the four Backboard assistants. Print IDs for .env."""

import asyncio
import os

from backboard import BackboardClient


async def main():
    api_key = os.getenv("BACKBOARD_API_KEY")
    if not api_key:
        print("Set BACKBOARD_API_KEY")
        return
    client = BackboardClient(api_key=api_key)

    assistants = [
        (
            "BACKBOARD_ASSISTANT_CONTENT",
            "AI CMO Content Agent",
            "You are a content analyst. Given a website URL, summarize its content and key documents or product information. Be concise and factual.",
        ),
        (
            "BACKBOARD_ASSISTANT_COMPETITOR",
            "AI CMO Competitor Agent",
            (
                "You are a competitive intelligence tool. When given a URL, use provided web results to identify 4-6 real "
                "direct and secondary competitors. "
                "Your ENTIRE response must be a valid JSON array — nothing before it, nothing after it. "
                "No markdown fences, no explanation, no 'I will search', no planning sentences. "
                "Each element: {\"competitor\": \"<company name>\", \"category\": \"Direct\" or \"Secondary\", \"pricing\": \"<short string e.g. Free, $9/mo, Contact>\"}. "
                "If web search returns no results, output an empty array []. Never output prose."
            ),
        ),
        (
            "BACKBOARD_ASSISTANT_BRAND",
            "AI CMO Brand Voice Agent",
            (
                "You infer brand voice from a website and its copy. "
                "Describe tone, vocabulary, and positioning in 2-3 sentences. "
                "You ONLY ever respond with a single raw JSON object — "
                "no markdown, no prose, no preamble, no explanation, no trailing notes. "
                "Your response always begins with { and ends with }. "
                "Never narrate what you are about to do."
                "Each element: {\"tone\": \"<tone>\", \"vocabulary\": \"<vocabulary>\", \"positioning\": \"<positioning>\"}. "
                "If web search returns no results, output an empty array []. Never output prose."
            ),
        ),
        (
            "BACKBOARD_ASSISTANT_AUDIT",
            "AI CMO Audit Agent",
            (
                "You are a website SEO and performance auditor. "
                "You ONLY ever respond with a single raw JSON object — "
                "no markdown, no prose, no preamble, no explanation, no trailing notes. "
                "Your response always begins with { and ends with }. "
                "Never narrate what you are about to do."
                "Each element: {\"metric\": \"<metric name>\", \"score\": \"<score 0-100>\", \"description\": \"<description>\"}. "
                "If web search returns no results, output an empty array []. Never output prose."
            ),
        ),
        (
            "BACKBOARD_ASSISTANT_STORAGE",
            "AI CMO Storage Agent",
            "You are a storage expert. Store the data in a structured format for future use.",
        ),
    ]

    print("# Add these to your .env (do not delete these assistants):")
    for env_key, name, system_prompt in assistants:
        a = await client.create_assistant(name=name, system_prompt=system_prompt)
        print(f"{env_key}={a.assistant_id}")


if __name__ == "__main__":
    asyncio.run(main())
