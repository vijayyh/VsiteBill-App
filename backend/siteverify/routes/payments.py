import re

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy.exc import IntegrityError

from .. import bills, drive, payment_sheet
from ..auth import require_role
from ..extensions import db
from ..models import BillChange, Delivery, PaymentApproval, PaymentSheet, VendorBankDetails

bp = Blueprint("payments", __name__, url_prefix="/api")


def _vendor_key(vendor):
    return re.sub(r"\s+", " ", (vendor or "").strip().lower())


@bp.get("/payment-sheet")
@require_role("accountant", "admin")
def sheet_status():
    """Whether bills can be approved for payment, and where the sheet is."""
    account = drive.get_account()
    sheet = payment_sheet.get_sheet()
    return jsonify(
        {
            "googleConnected": account is not None,
            "googleEmail": account.email if account else None,
            "sheetsAllowed": bool(account and account.has_scope(payment_sheet.SHEETS_SCOPE)),
            "sheet": sheet.to_dict() if sheet else None,
            "categories": list(payment_sheet.CATEGORIES),
        }
    )


@bp.post("/payment-sheet")
@require_role("admin")
def connect_sheet():
    data = request.get_json(silent=True) or {}
    try:
        sheet = payment_sheet.connect(data.get("link"), g.current_user)
    except payment_sheet.SheetError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"sheet": sheet.to_dict()})


@bp.delete("/payment-sheet")
@require_role("admin")
def disconnect_sheet():
    payment_sheet.disconnect()
    return jsonify({"ok": True})


@bp.get("/deliveries/<int:delivery_id>/payment")
@require_role("accountant", "admin")
def payment_defaults(delivery_id):
    """What the approval form starts from: the vendor's bank details as last entered."""
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    remembered = VendorBankDetails.query.filter_by(vendor_key=_vendor_key(delivery.vendor)).first()
    return jsonify(
        {
            "payment": delivery.payment.to_dict() if delivery.payment else None,
            "bankDetails": remembered.bank_details if remembered else "",
        }
    )


@bp.post("/deliveries/<int:delivery_id>/payment")
@require_role("accountant", "admin")
def approve_payment(delivery_id):
    """Approves a matched bill for payment: it becomes a row in the payment sheet (once)."""
    # Locked, so a second tap on Approve waits here for the first to finish (and then gets 409)
    # instead of saving the photo to Drive a second time. FOR NO KEY UPDATE (key_share), not FOR
    # UPDATE: saving an approval checks the bill still exists, and with FOR UPDATE that check would
    # wait on the second tap's lock while the second tap waits on the first: a deadlock.
    delivery = db.session.get(Delivery, delivery_id, with_for_update={"key_share": True})
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    if delivery.payment:
        return jsonify({"error": f"Already approved for payment as {delivery.payment.pay_id}"}), 409
    if delivery.status != "MATCHED":
        return jsonify({"error": "Only a matched bill can be approved for payment"}), 409
    if delivery.total_amount is None:
        return jsonify({"error": "Enter the bill's total amount under Amounts and save it first"}), 409

    data = request.get_json(silent=True) or {}
    category = data.get("category")
    if category not in payment_sheet.CATEGORIES:
        return jsonify({"error": "Pick a category"}), 400
    try:
        held = {
            "amount_on_hold": bills.number(data.get("amountOnHold"), "Amount on hold") or 0.0,
            "advance": bills.number(data.get("advance"), "Advance") or 0.0,
            "tds": bills.number(data.get("tds"), "TDS") or 0.0,
        }
        bank_details = bills.text(data.get("bankDetails"), "Bank details", 500)
    except bills.BillError as e:
        return jsonify({"error": str(e)}), 400
    if sum(held.values()) > delivery.total_amount + 0.005:
        return jsonify({"error": "More is held back than the bill amount"}), 400
    if payment_sheet.get_sheet() is None:
        return jsonify({"error": "The payment sheet isn't connected yet. Ask an admin to connect it."}), 409

    # The sheet links to the bill photo in Drive, so it goes there first if it isn't already.
    if not delivery.drive_file_id and delivery.photo_filename:
        try:
            drive.upload_delivery_photo(delivery.project, delivery)
        except drive.DriveNotConnected:
            return jsonify({"error": "Connect Google Drive first (Admin → Google Drive)"}), 409
        except Exception:
            current_app.logger.exception("Saving the bill photo to Drive failed")
            return jsonify({"error": "Couldn't save the bill photo to Drive. Try again."}), 502

    # One approval at a time. populate_existing: the sheet was loaded above, and without it the
    # lock would hand back that copy, with a Pay ID number another approval may have used since.
    sheet = PaymentSheet.query.with_for_update().populate_existing().first()
    if PaymentApproval.query.filter_by(delivery_id=delivery.id).first() is not None:
        db.session.rollback()
        return jsonify({"error": "This bill was just approved for payment"}), 409
    try:
        number = payment_sheet.next_pay_number(sheet)
    except payment_sheet.SheetError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 502
    approval = PaymentApproval(
        delivery_id=delivery.id,
        pay_id=f"PAY-{number:04d}",
        category=category,
        bank_details=bank_details,
        bill_amount=delivery.total_amount,
        approved_by_id=g.current_user.id,
        **held,
    )
    sheet.next_pay_number = number + 1
    # Saved (not yet committed) before the sheet is written, so a clash ends here, not in the sheet.
    db.session.add(approval)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "This bill was just approved for payment"}), 409
    try:
        row = payment_sheet.add_bill(delivery, approval)
    except payment_sheet.SheetError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 502

    try:
        approval.sheet_row = row
        if bank_details:
            key = _vendor_key(delivery.vendor)
            remembered = VendorBankDetails.query.filter_by(vendor_key=key).first() or VendorBankDetails(vendor_key=key)
            remembered.vendor = delivery.vendor
            remembered.bank_details = bank_details
            remembered.updated_by_id = g.current_user.id
            db.session.add(remembered)
        db.session.add(
            BillChange(
                delivery_id=delivery.id,
                user_id=g.current_user.id,
                action="payment",
                changes=[{"field": "payment", "from": None, "to": approval.pay_id}],
            )
        )
        db.session.commit()
    except Exception:
        # The row is in the sheet but the approval isn't saved: take the row out again, so trying
        # again doesn't leave the bill in the sheet twice.
        current_app.logger.exception("Saving the approval of bill %s failed after its sheet row was written", delivery.id)
        if row:
            try:
                payment_sheet.clear_row(sheet, row)
            except Exception:
                current_app.logger.exception("Couldn't blank payment sheet row %s", row)
        db.session.rollback()
        return jsonify({"error": "Couldn't save the approval. Try again."}), 500
    db.session.refresh(delivery)
    return jsonify({"delivery": delivery.to_dict()})
