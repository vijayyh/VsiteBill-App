from flask import Flask, jsonify, redirect, send_from_directory
from flask_cors import CORS

from . import storage
from .auth import login_required
from .config import Config
from .extensions import db, migrate
from .seed import seed_if_empty


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)

    from .routes.admin import bp as admin_bp
    from .routes.auth import bp as auth_bp
    from .routes.deliveries import bp as deliveries_bp
    from .routes.office import bp as office_bp
    from .routes.projects import bp as projects_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(deliveries_bp)
    app.register_blueprint(office_bp)
    app.register_blueprint(admin_bp)

    @app.get("/uploads/<path:filename>")
    @login_required
    def uploaded_file(filename):
        if storage.configured():
            return redirect(storage.presigned_url(filename))
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    from sqlalchemy import inspect

    with app.app_context():
        if inspect(db.engine).has_table("users"):
            seed_if_empty()

    return app
