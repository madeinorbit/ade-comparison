#!/usr/bin/env python3
"""Bounded, content-addressed cache for public research source files."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import urllib.parse
import urllib.request


def fetch(url, pin, root, max_bytes=20 * 1024**2, budget=200 * 1024**2):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("https", "http") or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("Use a public HTTP(S) source URL without credentials")
    if not pin.strip() or max_bytes <= 0 or budget <= 0:
        raise ValueError("A commit/version/dated snapshot and positive size limits are required")
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    for name in ("objects", "receipts"):
        (root / name).mkdir(exist_ok=True)
    # One lock also enforces the shared budget across simultaneous researchers.
    lock = root / "fetch.lock"
    deadline = time.monotonic() + 60
    while True:
        try:
            lock.mkdir()
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError("Cache is busy; check the owning fetch before retrying")
            time.sleep(0.1)
    partial = None
    try:
        key = hashlib.sha256(json.dumps([url, pin]).encode()).hexdigest()
        receipt_path = root / "receipts" / (key + ".json")
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_text())
            blob = root / "objects" / receipt["sha256"]
            if blob.is_file() and hashlib.sha256(blob.read_bytes()).hexdigest() == receipt["sha256"]:
                return {**receipt, "path": str(blob.resolve()), "cached": True}
            raise ValueError("Cached source failed integrity check; do not silently replace it")
        used = sum(p.stat().st_size for p in (root / "objects").iterdir() if p.is_file())
        remaining = budget - used
        if remaining <= 0:
            raise ValueError("Shared cache budget exhausted; clean completed research first")
        request = urllib.request.Request(url, headers={"User-Agent": "ADE-research-source-cache"})
        with urllib.request.urlopen(request, timeout=30) as response:
            size_hint = response.headers.get("Content-Length")
            if size_hint and int(size_hint) > max_bytes:
                raise ValueError("Source exceeds download limit; fetch targeted pinned files instead")
            fd, filename = tempfile.mkstemp(prefix="incoming-", dir=root)
            partial = Path(filename)
            digest, size = hashlib.sha256(), 0
            with os.fdopen(fd, "wb") as output:
                while chunk := response.read(64 * 1024):
                    size += len(chunk)
                    if size > min(max_bytes, remaining):
                        raise ValueError("Source exceeds download or shared-cache budget")
                    digest.update(chunk)
                    output.write(chunk)
            sha = digest.hexdigest()
            blob = root / "objects" / sha
            if not blob.exists():
                partial.replace(blob)
            receipt = {"url": url, "pin": pin, "sha256": sha, "bytes": size,
                       "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
            return {**receipt, "path": str(blob.resolve()), "cached": False}
    finally:
        if partial is not None:
            partial.unlink(missing_ok=True)
        lock.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "status"))
    parser.add_argument("url", nargs="?")
    parser.add_argument("--pin")
    parser.add_argument("--cache", default=os.environ.get("ADE_RESEARCH_CACHE", "/tmp/ade-research-cache"))
    parser.add_argument("--max-mib", type=int, default=20)
    parser.add_argument("--budget-mib", type=int, default=200)
    args = parser.parse_args()
    if args.command == "fetch":
        if not args.url or not args.pin:
            parser.error("fetch requires URL and --pin")
        result = fetch(args.url, args.pin, args.cache, args.max_mib * 1024**2, args.budget_mib * 1024**2)
    else:
        root = Path(args.cache)
        blobs = list((root / "objects").glob("*"))
        result = {"cache": str(root), "objects": len(blobs), "bytes": sum(p.stat().st_size for p in blobs)}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
