#!/usr/bin/env python3
"""Read-only backup of the Firestore `bookings` collection.

Writes two files into backups/ (git-ignored; contains client personal data):
  bookings-<timestamp>.raw.json     exact Firestore REST response documents
  bookings-<timestamp>.json         simplified plain JSON ({id, ...fields})
Cross-checks the document count against a Firestore count aggregation.
Only issues GET/runAggregationQuery (read) requests. Never writes.
"""
import hashlib, json, sys, urllib.request
from datetime import datetime
from pathlib import Path

PROJECT = "pitchbookingsystem-6e222"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COLLECTION = "bookings"


def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def decode(v):
    (kind, val), = v.items()
    if kind == "integerValue": return int(val)
    if kind == "doubleValue": return float(val)
    if kind == "nullValue": return None
    if kind == "mapValue": return {k: decode(x) for k, x in val.get("fields", {}).items()}
    if kind == "arrayValue": return [decode(x) for x in val.get("values", [])]
    return val  # string, boolean, timestamp, reference stay as returned


def main():
    docs, token = [], None
    while True:
        url = f"{BASE}/{COLLECTION}?pageSize=300" + (f"&pageToken={token}" if token else "")
        page = call(url)
        docs += page.get("documents", [])
        token = page.get("nextPageToken")
        if not token:
            break

    agg = call(f"{BASE}:runAggregationQuery", {"structuredAggregationQuery": {
        "structuredQuery": {"from": [{"collectionId": COLLECTION}]},
        "aggregations": [{"alias": "n", "count": {}}]}})
    server_count = int(agg[0]["result"]["aggregateFields"]["n"]["integerValue"])

    simple = [{"id": d["name"].rsplit("/", 1)[1],
               **{k: decode(v) for k, v in d.get("fields", {}).items()}} for d in docs]

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = Path(__file__).resolve().parent.parent / "backups"
    out.mkdir(exist_ok=True)
    raw_p, simple_p = out / f"bookings-{stamp}.raw.json", out / f"bookings-{stamp}.json"
    raw_p.write_text(json.dumps(docs, indent=1))
    simple_p.write_text(json.dumps(simple, indent=1))

    print(f"downloaded {len(docs)} docs, server count {server_count}")
    print(f"sha256 {hashlib.sha256(simple_p.read_bytes()).hexdigest()[:16]}  {simple_p.name}")
    if len(docs) != server_count or not docs:
        sys.exit("COUNT MISMATCH or empty - do not trust this backup")
    print("OK: counts match")


if __name__ == "__main__":
    main()
