from flask import Flask, jsonify, redirect, send_from_directory
from markupsafe import escape
from flask_cors import CORS

from . import storage
from .auth import login_required
from .config import Config
from .extensions import db, migrate
from .seed import seed_if_empty


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)

    from .routes.admin import bp as admin_bp
    from .routes.auth import bp as auth_bp
    from .routes.deliveries import bp as deliveries_bp
    from .routes.notifications import bp as notifications_bp
    from .routes.ocr import bp as ocr_bp
    from .routes.office import bp as office_bp
    from .routes.projects import bp as projects_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(deliveries_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(office_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ocr_bp)

    @app.get("/uploads/<path:filename>")
    @login_required
    def uploaded_file(filename):
        if storage.configured():
            return redirect(storage.presigned_url(filename))
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/")
    def index():
        # This server is only the API; opening its address in a browser (the dev preview does)
        # used to show Flask's bare "Not Found". Point people at the actual app instead.
        frontend = escape(app.config["FRONTEND_URL"])
        return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SiteVerify API</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#eef2f7;font-family:system-ui,sans-serif;color:#1e2320">
  <div style="text-align:center;padding:24px">
    <div style="font-size:22px;font-weight:700">SiteVerify API is running</div>
    <p style="color:#6b6f6b;font-size:14px;margin:8px 0 20px">
      This is the server behind the app. The app itself is at the link below.</p>
    <a href="{frontend}" style="display:inline-block;background:#1a3c5e;color:#fff;font-weight:700;
      text-decoration:none;border-radius:999px;padding:12px 22px">Open SiteVerify</a>
  </div>
</body></html>"""

    from sqlalchemy import inspect

    with app.app_context():
        if inspect(db.engine).has_table("users"):
            seed_if_empty()

    return app
