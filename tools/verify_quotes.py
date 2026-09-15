#!/usr/bin/env python3
"""Re-check public/quotes.json against the Ted Lasso fan wiki and rewrite the verified flags.

The wiki is mostly plot summary, so it only quotes dialogue here and there. That makes this
check one-directional: a match is good evidence the line is real, a miss is weak evidence of
nothing much. Hence verified:false means "not confirmed", never "wrong".

Usage:  python3 tools/verify_quotes.py [--dry-run]
"""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

API = "https://tedlasso.fandom.com/api.php"
UA = "Lassoisms-quote-verifier/1.0 (https://github.com/cobiadigital/lasoisms)"
QUOTES = "public/quotes.json"
THRESHOLD = 0.5  # fraction of a quote's 5-word windows that must appear in the wiki text


def api(**params):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.load(resp)


def fetch_corpus():
    titles = [p["title"] for p in api(
        action="query", list="allpages", aplimit=500, apfilterredir="nonredirects"
    )["query"]["allpages"]]
    pages = []
    for i in range(0, len(titles), 50):
        data = api(action="query", prop="revisions", rvprop="content", rvslots="main",
                   titles="|".join(titles[i:i + 50]))
        for page in data.get("query", {}).get("pages", []):
            if "revisions" in page:
                pages.append(page["revisions"][0]["slots"]["main"]["content"])
        print(f"  fetched {min(i + 50, len(titles))}/{len(titles)} pages", file=sys.stderr)
    return pages


def normalize(text):
    text = text.lower().replace("’", "'").replace("—", " ")
    text = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", text)  # wiki links -> label
    text = re.sub(r"'{2,}", "", text)                            # wiki italic/bold markers
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def score_quote(words, blob, grams):
    """Fraction of the quote's word-windows that appear verbatim in the wiki text."""
    for n in (5, 4):
        if len(words) >= n:
            windows = [" ".join(words[i:i + n]) for i in range(len(words) - n + 1)]
            return sum(1 for w in windows if w in grams[n]) / len(windows)
    return 1.0 if " ".join(words) in blob else 0.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="report without writing the file")
    args = parser.parse_args()

    print("Fetching wiki corpus...", file=sys.stderr)
    blob = normalize(" \n ".join(fetch_corpus()))
    words = blob.split()
    grams = {n: {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)} for n in (4, 5)}

    data = json.load(open(QUOTES))
    changed = 0
    for quote in data["quotes"]:
        verified = score_quote(normalize(quote["quote"]).split(), blob, grams) >= THRESHOLD
        if quote.get("verified") != verified:
            changed += 1
            print(f"  {'+' if verified else '-'} [{quote['character']}] {quote['quote'][:70]}")
        quote["verified"] = verified

    total = sum(1 for q in data["quotes"] if q["verified"])
    print(f"\n{total}/{len(data['quotes'])} verified ({changed} changed)")

    if args.dry_run:
        print("dry run: file not written")
        return
    data.setdefault("verification", {})["checked"] = __import__("datetime").date.today().isoformat()
    with open(QUOTES, "w") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


if __name__ == "__main__":
    main()
