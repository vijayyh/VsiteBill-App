from flask import Blueprint, Response, jsonify, request

from .. import photos
from ..auth import login_required

bp = Blueprint("photos", __name__, url_prefix="/api/photos")


@bp.post("/jpeg")
@login_required
def to_jpeg():
    """A photo the phone's browser can't open (a HEIC from its gallery) back as a JPEG, so the
    bill form can show it, read it and send it like a camera photo."""
    photo = request.files.get("photo")
    data = photo.read() if photo else b""
    if not data:
        return jsonify({"error": "A photo file is required"}), 400
    try:
        jpeg = photos.to_jpeg(data)
    except photos.PhotoError:
        return jsonify({"error": "Couldn't open that photo"}), 415
    return Response(jpeg, mimetype="image/jpeg")
