import json
from pathlib import Path

from flask_migrate import upgrade
from sqlalchemy import text

from siteverify import create_app
from siteverify.extensions import db
from siteverify.seed import seed_if_empty
from tests.test_deliveries import upload_bill

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

THREE_GRADES = [
    {"description": "M-10", "quantity": 36.5, "unit": "CU.MT", "rate": 5063.56, "amount": 184819.94},
    {"description": "M-45", "quantity": 4.5, "unit": "CU.MT", "rate": 7012.71, "amount": 31557.2},
    {"description": "M-60", "quantity": 44.5, "unit": "CU.MT", "rate": 8686.44, "amount": 386546.58},
]


def test_a_bill_with_several_items_and_its_amounts(client, login):
    res = upload_bill(
        client,
        login("supervisor"),
        items=json.dumps(THREE_GRADES),
        invoiceNumber="MRL/26-27/158",
        billDate="2026-08-31",
        taxableAmount="602,923.72",
        cgst="54263.13",
        sgst="54263.13",
        totalAmount="711450",
    )
    assert res.status_code == 201
    bill = res.get_json()["delivery"]
    assert [i["description"] for i in bill["items"]] == ["M-10", "M-45", "M-60"]
    assert bill["items"][0] == THREE_GRADES[0]
    # The summary the lists show and the office compares with the PO.
    assert bill["item"] == "M-10, M-45, M-60"
    assert bill["delivered"] == 85.5
    assert bill["invoiceNumber"] == "MRL/26-27/158"
    assert bill["billDate"] == "2026-08-31"
    assert bill["taxableAmount"] == 602923.72
    assert bill["igst"] is None
    assert bill["totalAmount"] == 711450


def test_a_bill_from_an_app_without_the_items_table_gets_one_row(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    assert bill["items"] == [
        {"description": "OPC 53, 50kg bags", "quantity": 480, "unit": None, "rate": None, "amount": None}
    ]
    assert bill["delivered"] == 480


def test_unreadable_values_never_lose_a_queued_bill(client, login):
    res = upload_bill(client, login("supervisor"), items="not json", billDate="someday", cgst="-5", totalAmount="lots")
    assert res.status_code == 201
    bill = res.get_json()["delivery"]
    assert bill["billDate"] is None and bill["cgst"] is None and bill["totalAmount"] is None
    assert len(bill["items"]) == 1  # fell back to the plain item and quantity


def test_empty_item_rows_are_dropped(client, login):
    rows = [{"description": "River sand", "quantity": "3"}, {"description": " ", "quantity": ""}]
    bill = upload_bill(client, login("supervisor"), items=json.dumps(rows)).get_json()["delivery"]
    assert len(bill["items"]) == 1
    assert bill["delivered"] == 3


def test_the_office_can_edit_the_items_and_amounts(client, login):
    bill = upload_bill(client, login("supervisor"), items=json.dumps(THREE_GRADES)).get_json()["delivery"]
    edited = [{**THREE_GRADES[0], "quantity": 30}, THREE_GRADES[2]]
    res = client.patch(
        f"/api/deliveries/{bill['id']}",
        json={"items": edited, "billDate": "31/08/2026", "igst": 1000, "invoiceNumber": " INV-9 "},
        headers=login("accountant"),
    )
    assert res.status_code == 200
    saved = res.get_json()["delivery"]
    assert [i["quantity"] for i in saved["items"]] == [30, 44.5]
    assert saved["item"] == "M-10, M-60"
    assert saved["delivered"] == 74.5
    assert saved["billDate"] == "2026-08-31"
    assert saved["igst"] == 1000
    assert saved["invoiceNumber"] == "INV-9"


def test_bad_values_from_the_office_are_refused_and_change_nothing(client, login):
    bill = upload_bill(client, login("supervisor"), items=json.dumps(THREE_GRADES)).get_json()["delivery"]
    headers = login("accountant")
    for body in (
        {"items": [{"description": "M-10", "quantity": -1}], "vendor": "Changed"},
        {"items": "nope"},
        {"billDate": "31st August"},
        {"totalAmount": "a lot"},
        {"items": [{"description": 5}]},
    ):
        assert client.patch(f"/api/deliveries/{bill['id']}", json=body, headers=headers).status_code == 400
    unchanged = client.get(f"/api/deliveries/{bill['id']}", headers=headers).get_json()["delivery"]
    assert unchanged["vendor"] == bill["vendor"]
    assert len(unchanged["items"]) == 3


def test_editing_the_single_item_the_old_way_keeps_its_row_in_step(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    res = client.patch(
        f"/api/deliveries/{bill['id']}", json={"item": "OPC 53 cement", "delivered": 470}, headers=login("accountant")
    )
    saved = res.get_json()["delivery"]
    assert saved["items"] == [{"description": "OPC 53 cement", "quantity": 470, "unit": None, "rate": None, "amount": None}]


def test_supervisors_still_cant_edit_items(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    res = client.patch(f"/api/deliveries/{bill['id']}", json={"items": []}, headers=login("supervisor"))
    assert res.status_code == 403


def test_bills_sent_before_items_existed_become_one_row(tmp_path):
    # The live database already holds bills; the migration must give each of them its row.
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'old.db'}"})
    with app.app_context():
        upgrade(directory=str(MIGRATIONS_DIR), revision="d0dc350e48df")
        seed_if_empty()
        db.session.execute(
            text(
                "INSERT INTO deliveries (project_id, uploaded_by_id, vendor, item, status, delivered, "
                "quantity_low_confidence, uploaded_at) VALUES ('kh-014', 1, 'UltraTech', 'OPC 53', 'MATCHED', 480, 0, "
                "'2026-10-01 10:00:00')"
            )
        )
        db.session.commit()
        upgrade(directory=str(MIGRATIONS_DIR))
        rows = db.session.execute(text("SELECT description, quantity, position FROM delivery_items")).all()
        assert [tuple(r) for r in rows] == [("OPC 53", 480.0, 0)]
        db.session.remove()
        db.engine.dispose()
