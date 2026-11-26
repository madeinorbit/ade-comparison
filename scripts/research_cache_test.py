import contextlib
import http.server
from pathlib import Path
import tempfile
import threading
import unittest

from research_cache import fetch


class SourceCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.requests = 0
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                owner.requests += 1
                body = b"different" if self.path == "/other" else b"source42"
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                with contextlib.suppress(BrokenPipeError):
                    self.wfile.write(body)

            def log_message(self, *args):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def test_reuses_pinned_download_and_deduplicates_identical_bytes(self):
        first = fetch(self.url + "/one", "commit1", self.root)
        again = fetch(self.url + "/one", "commit1", self.root)
        self.assertTrue(again["cached"])
        self.assertEqual(self.requests, 1)
        same_bytes = fetch(self.url + "/two", "commit1", self.root)
        self.assertEqual(first["path"], same_bytes["path"])
        self.assertEqual(len(list((self.root / "objects").iterdir())), 1)

    def test_oversized_response_leaves_no_partial_download_or_lock(self):
        with self.assertRaisesRegex(ValueError, "download limit"):
            fetch(self.url, "commit1", self.root, max_bytes=4)
        self.assertFalse((self.root / "fetch.lock").exists())
        self.assertFalse(list(self.root.glob("incoming-*")))
        self.assertFalse(list((self.root / "objects").iterdir()))

    def test_shared_budget_is_enforced_without_losing_prior_source(self):
        first = fetch(self.url, "commit1", self.root, budget=12)
        with self.assertRaisesRegex(ValueError, "budget"):
            fetch(self.url + "/other", "commit2", self.root, budget=12)
        self.assertEqual(Path(first["path"]).read_bytes(), b"source42")
        self.assertFalse(list(self.root.glob("incoming-*")))
        self.assertFalse((self.root / "fetch.lock").exists())

    def test_corrupted_cached_source_is_rejected(self):
        first = fetch(self.url, "commit1", self.root)
        Path(first["path"]).write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "integrity"):
            fetch(self.url, "commit1", self.root)
        self.assertEqual(self.requests, 1)


if __name__ == "__main__":
    unittest.main()
