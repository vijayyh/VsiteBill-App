"""Gunicorn settings, picked up automatically because the start command runs
`gunicorn app:app` from this directory.

Most of a request's time here is spent waiting on the network (Postgres,
Supabase Storage, Google Drive), so a single process with several threads
lets other users' requests run during that wait instead of queuing behind it.
"""

import os

# Render sets WEB_CONCURRENCY from the instance's CPU count (1 on the free plan).
workers = int(os.environ.get("WEB_CONCURRENCY", 1))
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", 8))

# Saving a large bill photo to Google Drive can take longer than gunicorn's
# 30-second default.
timeout = 120
