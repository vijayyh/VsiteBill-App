from siteverify import create_app

app = create_app()

if __name__ == "__main__":
    # use_reloader=False: Werkzeug's auto-reloader has been spawning duplicate,
    # orphaned processes on this machine (requests randomly hitting whichever
    # stale process still held the port, with old code/state) — restart the
    # server manually after backend changes instead. debug=True is kept for
    # in-browser tracebacks.
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
