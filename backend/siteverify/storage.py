"""Delivery photo storage: an S3-compatible bucket when configured, local disk
otherwise.

Render's web service filesystem is ephemeral — anything written to local disk
disappears on the next deploy/restart unless a persistent disk is explicitly
attached. Any S3-compatible bucket (Supabase Storage, Backblaze B2, Cloudflare
R2, AWS S3, ...) is the durable, scalable fix — this talks to all of them the
same way via boto3's generic "s3" client and a configurable endpoint URL.
Local disk stays as the fallback so local dev needs no cloud credentials.
"""

import boto3
from botocore.config import Config as BotoConfig
from flask import current_app


def configured() -> bool:
    c = current_app.config
    return bool(c["S3_ENDPOINT_URL"] and c["S3_ACCESS_KEY_ID"] and c["S3_SECRET_ACCESS_KEY"] and c["S3_BUCKET"])


def _client():
    c = current_app.config
    return boto3.client(
        "s3",
        endpoint_url=c["S3_ENDPOINT_URL"],
        aws_access_key_id=c["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=c["S3_SECRET_ACCESS_KEY"],
        region_name=c["S3_REGION"],
        # Many S3-compatible gateways (Supabase Storage included) only accept
        # SigV4, path-style requests — boto3's defaults for a custom endpoint
        # can otherwise fall back to the legacy SigV2 scheme, which these
        # reject with "Missing signature".
        config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def save_photo(file_storage, key: str) -> None:
    """Stores an uploaded werkzeug FileStorage under `key`."""
    if configured():
        _client().upload_fileobj(
            file_storage.stream,
            current_app.config["S3_BUCKET"],
            key,
            ExtraArgs={"ContentType": file_storage.mimetype or "application/octet-stream"},
        )
        return

    upload_dir = current_app.config["UPLOAD_DIR"]
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_storage.save(upload_dir / key)


def read_photo(key: str) -> bytes:
    """Reads a stored photo's raw bytes — used for the Google Drive upload path."""
    if configured():
        obj = _client().get_object(Bucket=current_app.config["S3_BUCKET"], Key=key)
        return obj["Body"].read()

    with open(current_app.config["UPLOAD_DIR"] / key, "rb") as f:
        return f.read()


def presigned_url(key: str, expires_in: int = 300) -> str:
    """A short-lived signed URL for `key`, for the /uploads/<key> route to redirect to."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": current_app.config["S3_BUCKET"], "Key": key},
        ExpiresIn=expires_in,
    )
