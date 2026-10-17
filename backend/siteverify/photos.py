"""Bill photos in a format everything can open.

Many phones save their photos as HEIC ("high efficiency"). Chrome can't show those, Google's
reader won't read them and the office's browser can't display them, so a photo that isn't already
JPEG, PNG, WebP or GIF is turned into a JPEG here: when it's read, when the bill is sent, and on
request for the phone's own preview. Ordinary camera photos are recognised from their first bytes
and pass through untouched; the HEIC decoder is only loaded the first time one is needed.
"""

import io
import threading

# Same size the apps shrink a photo to before sending (frontend/src/lib/compressImage.ts).
MAX_EDGE_PX = 2000
JPEG_QUALITY = 80
# Decoding takes ~3 bytes a pixel: a 200-megapixel phone photo would need ~600 MB, more than the
# whole (512 MB) server, which would crash it for everyone. Bigger photos are refused instead
# (the phone decodes those itself; a bill sent with one keeps its original photo).
MAX_PIXELS = 64_000_000

_heif_registered = False
# Decoding a 12-megapixel HEIC takes ~90 MB for under a second. One at a time per server process,
# so a few arriving together can't add up on a small (512 MB) server; the others wait a moment.
_one_at_a_time = threading.Lock()


class PhotoError(Exception):
    pass


def is_viewable(data: bytes) -> bool:
    """True for the formats browsers and the reader all open: JPEG, PNG, WebP, GIF."""
    return (
        data.startswith(b"\xff\xd8\xff")
        or data.startswith(b"\x89PNG\r\n\x1a\n")
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
        or data[:6] in (b"GIF87a", b"GIF89a")
    )


def to_jpeg(data: bytes) -> bytes:
    """The photo as a JPEG, upright and at most MAX_EDGE_PX on its longest side.

    Raises PhotoError if it isn't a photo this server can open.
    """
    global _heif_registered
    from PIL import Image, ImageOps

    with _one_at_a_time:
        if not _heif_registered:
            import pillow_heif

            pillow_heif.register_heif_opener(thumbnails=False)
            _heif_registered = True

        try:
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size  # from the header: nothing decoded yet
                if width * height > MAX_PIXELS:
                    raise PhotoError(f"Too big to convert here ({width}x{height})")
                # Shrink first, then turn upright: the full-size copy is never made twice.
                image.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX))
                upright = ImageOps.exif_transpose(image)
                out = io.BytesIO()
                upright.convert("RGB").save(out, "JPEG", quality=JPEG_QUALITY)
                return out.getvalue()
        except PhotoError:
            raise
        except Exception as e:  # Pillow raises many kinds for a file it can't decode
            raise PhotoError(f"Can't open this photo: {e}") from e


def viewable(data: bytes) -> bytes:
    """The photo itself if it's already viewable, else as a JPEG. Raises PhotoError."""
    return data if is_viewable(data) else to_jpeg(data)
