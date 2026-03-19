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
            "You are a competitive analyst. Given a website, find direct and secondary competitors. For each: name, category (Direct/Secondary), pricing. Use web search for current data. Output a short executive summary then a clear list or table.",
        ),
        (
            "BACKBOARD_ASSISTANT_BRAND",
            "AI CMO Brand Voice Agent",
            "You infer brand voice from a website and its copy. Describe tone, vocabulary, and positioning in 2-3 sentences.",
        ),
        (
            "BACKBOARD_ASSISTANT_AUDIT",
            "AI CMO Audit Agent",
            "You audit websites: structure, metadata, and when possible Core Web Vitals or performance. Be concise.",
        ),
    ]

    print("# Add these to your .env (do not delete these assistants):")
    for env_key, name, system_prompt in assistants:
        a = await client.create_assistant(name=name, system_prompt=system_prompt)
        print(f"{env_key}={a.assistant_id}")


if __name__ == "__main__":
    asyncio.run(main())
