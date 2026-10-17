import io

import pillow_heif
import pytest
from PIL import Image

from siteverify import ocr, photos

from test_deliveries import PHOTO_BYTES
from test_ocr import CHALLAN

pillow_heif.register_heif_opener()


def heic_photo(width=2400, height=1600) -> bytes:
    """A real HEIC photo, as many phones save them in their gallery."""
    out = io.BytesIO()
    Image.new("RGB", (width, height), (240, 236, 220)).save(out, format="HEIF", quality=80)
    return out.getvalue()


def send_bill(client, headers, photo: bytes, name: str):
    return client.post(
        "/api/projects/kh-014/deliveries",
        data={"photo": (io.BytesIO(photo), name), "vendor": "UltraTech Cement", "delivered": "480"},
        headers=headers,
        content_type="multipart/form-data",
    )


def stored(app, photo_url: str) -> bytes:
    return (app.config["UPLOAD_DIR"] / photo_url.rsplit("/", 1)[-1]).read_bytes()


def test_only_formats_every_browser_opens_count_as_viewable():
    assert photos.is_viewable(PHOTO_BYTES)  # JPEG
    assert photos.is_viewable(b"\x89PNG\r\n\x1a\n....")
    assert photos.is_viewable(b"RIFF\x00\x00\x00\x00WEBPVP8 ")
    assert not photos.is_viewable(heic_photo(64, 64))


def test_a_heic_photo_comes_back_as_a_jpeg_no_bigger_than_the_apps_send(client, login):
    res = client.post(
        "/api/photos/jpeg",
        data={"photo": (io.BytesIO(heic_photo()), "IMG_0042.HEIC")},
        headers=login("supervisor"),
        content_type="multipart/form-data",
    )
    assert res.status_code == 200
    assert res.mimetype == "image/jpeg"
    with Image.open(io.BytesIO(res.data)) as image:
        assert image.format == "JPEG"
        assert max(image.size) == photos.MAX_EDGE_PX


def test_converting_a_photo_needs_a_login(client):
    res = client.post(
        "/api/photos/jpeg", data={"photo": (io.BytesIO(heic_photo(64, 64)), "a.heic")}, content_type="multipart/form-data"
    )
    assert res.status_code == 401


def test_a_file_that_isnt_a_photo_cant_be_converted(client, login):
    res = client.post(
        "/api/photos/jpeg",
        data={"photo": (io.BytesIO(b"not a photo at all"), "notes.heic")},
        headers=login("supervisor"),
        content_type="multipart/form-data",
    )
    assert res.status_code == 415


def test_a_heic_bill_is_kept_as_a_jpeg_the_office_can_open(app, client, login):
    res = send_bill(client, login("supervisor"), heic_photo(), "IMG_0042.HEIC")
    assert res.status_code == 201
    photo_url = res.get_json()["delivery"]["photoUrl"]
    assert photo_url.endswith(".jpg")
    assert stored(app, photo_url).startswith(b"\xff\xd8\xff")


def test_a_jpeg_bill_is_kept_exactly_as_sent(app, client, login):
    res = send_bill(client, login("supervisor"), PHOTO_BYTES, "bill.jpg")
    assert res.status_code == 201
    assert stored(app, res.get_json()["delivery"]["photoUrl"]) == PHOTO_BYTES


def test_a_bill_whose_photo_cant_be_converted_is_still_sent(app, client, login):
    res = send_bill(client, login("supervisor"), b"not a photo at all", "IMG_0042.HEIC")
    assert res.status_code == 201
    photo_url = res.get_json()["delivery"]["photoUrl"]
    assert photo_url.endswith(".heic")
    assert stored(app, photo_url) == b"not a photo at all"


@pytest.fixture
def vision_sees(app, monkeypatch):
    """OCR switched on; records the bytes the reader was given."""
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    seen = []

    def fake_vision(photo):
        seen.append(photo)
        return CHALLAN

    monkeypatch.setattr(ocr, "_google_vision", fake_vision)
    return seen


def read(client, headers, photo: bytes, name: str):
    return client.post(
        "/api/ocr/bill", data={"photo": (io.BytesIO(photo), name)}, headers=headers, content_type="multipart/form-data"
    )


def test_reading_a_heic_bill_gives_the_reader_a_jpeg(client, login, vision_sees):
    res = read(client, login("supervisor"), heic_photo(), "IMG_0042.HEIC")
    assert res.status_code == 200
    assert res.get_json()["fields"]["vendor"]["value"] == "SHREE GANESH BUILDING MATERIALS PVT LTD"
    assert vision_sees[0].startswith(b"\xff\xd8\xff")


def test_reading_a_jpeg_bill_sends_it_unchanged(client, login, vision_sees):
    assert read(client, login("supervisor"), PHOTO_BYTES, "bill.jpg").status_code == 200
    assert vision_sees == [PHOTO_BYTES]


def test_reading_a_photo_that_cant_be_opened_says_so(client, login, vision_sees):
    res = read(client, login("supervisor"), b"not a photo at all", "IMG_0042.HEIC")
    assert res.status_code == 415
    assert vision_sees == []
