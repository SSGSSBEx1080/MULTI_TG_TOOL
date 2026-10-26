from __future__ import annotations

import re
import unicodedata
from typing import Any

from backend.tools import TOOL_CATEGORIES

_WORD_RE = re.compile(r"[\w-]+", re.UNICODE)


def _normalise(value: str) -> str:
    """Normalise user queries so ё/е and casing do not affect tool discovery."""
    folded = unicodedata.normalize("NFKC", value).casefold().replace("ё", "е")
    return " ".join(_WORD_RE.findall(folded))


def list_tool_entries() -> list[dict[str, Any]]:
    """Flatten the authoritative category catalogue without losing category context."""
    entries: list[dict[str, Any]] = []
    for category_index, category in enumerate(TOOL_CATEGORIES):
        for tool_index, tool in enumerate(category.get("tools", [])):
            entries.append(
                {
                    **tool,
                    "category_id": category["id"],
                    "category_title": category["title"],
                    "category_emoji": category["emoji"],
                    "_order": (category_index, tool_index),
                }
            )
    return entries


def search_tools(query: str = "") -> list[dict[str, Any]]:
    """Rank every bot tool by exact title, category, identifier and description matches.

    A multi-word search is intentionally conjunctive: every query word must match at
    least one useful field, preventing broad, surprising result sets for long queries.
    """
    entries = list_tool_entries()
    normalised_query = _normalise(query)
    tokens = normalised_query.split() if normalised_query else []
    if not tokens:
        return entries

    ranked: list[tuple[int, tuple[int, int], dict[str, Any]]] = []
    for entry in entries:
        title = _normalise(str(entry.get("title", "")))
        description = _normalise(str(entry.get("desc", "")))
        category = _normalise(str(entry.get("category_title", "")))
        identifier = _normalise(str(entry.get("id", "")))
        searchable = f"{title} {description} {category} {identifier}"
        if not all(token in searchable for token in tokens):
            continue

        score = 0
        for token in tokens:
            title_words = title.split()
            if token == title:
                score += 30
            elif token in title:
                score += 20 if title.startswith(token) else 14
            elif any(word.startswith(token) for word in title_words):
                score += 12
            elif token in identifier:
                score += 10
            elif token in category:
                score += 8
            elif token in description:
                score += 3
        ranked.append((score, entry["_order"], entry))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [entry for _, _, entry in ranked]


def count_tool_entries() -> int:
    return sum(len(category.get("tools", [])) for category in TOOL_CATEGORIES)
