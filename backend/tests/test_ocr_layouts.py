"""Bill layouts that were read wrongly from real photos (2026-10-17), rebuilt with made-up names and
numbers: a tagline taken for the vendor, values at the foot of a boxed header, a first row close
under the headings, item names cut at a centred heading, amounts on a photo taken at an angle,
charge lines without a quantity, and a table longer than the reader used to look."""

from siteverify.ocr import Line, Word, parse_page

from test_ocr import cell, page, rows, value


def read(app, *cells):
    with app.app_context():
        return parse_page(page(*cells))


# ── The vendor ──────────────────────────────────────────────────────────────────────────────────


def test_a_tagline_under_the_name_is_never_the_vendor(app):
    fields = read(
        app,
        cell(341, 50, "SHREE GANESH ELECTRICAL", h=22),
        cell(430, 90, "(We Supply the all type electrical Materials)", h=14),
        cell(343, 107, "Plot 4, Sahar road, Andheri east, Mumbai 400069", h=14),
        cell(352, 124, "Mob-0000000000 email id - sales@example.com", h=13),
        cell(530, 144, "TAX INVOICE", h=12),
        cell(74, 165, "BILL TO,", h=10),
        cell(74, 177, "KH Group", h=13),
    )
    assert value(fields, "vendor") == "SHREE GANESH ELECTRICAL"


def test_dealers_in_is_a_tagline_too(app):
    fields = read(
        app,
        cell(60, 30, "PATIL HARDWARE", h=26),
        cell(60, 70, "Dealers in Cement, Steel & Building Materials", h=16),
        cell(60, 120, "To, M/s KH Group", h=12),
    )
    assert value(fields, "vendor") == "PATIL HARDWARE"


def test_text_printed_up_the_margin_is_not_the_vendor(app):
    sideways = Line([Word("WHOLESALE TRADERS PVT LTD", 0.98, 1214, 40, 1235, 300)])
    fields = read(
        app,
        cell(341, 50, "SHREE GANESH ELECTRICAL", h=22),
        sideways,
        cell(343, 107, "Andheri east, Mumbai 400069", h=14),
        cell(74, 165, "BILL TO,", h=10),
    )
    assert value(fields, "vendor") == "SHREE GANESH ELECTRICAL"


def test_m_s_before_the_sellers_own_name_on_an_e_invoice(app):
    fields = read(
        app,
        cell(369, 30, "TAX INVOICE", h=9),
        cell(531, 28, "(ORIGINAL FOR RECIPIENT)", h=11),
        cell(120, 120, "Ack Date 13-Aug-26", h=10),
        cell(580, 150, "Invoice No.", h=8),
        cell(119, 156, "M/s.Sai Building Traders", h=10),
        cell(119, 170, "Shop No.6, Station Road", h=11),
        cell(581, 166, "1620/26-27", h=8),
        cell(117, 240, "Consignee (Ship to)", h=11),
        cell(115, 254, "KH Group (Andheri Site)", h=12),
        cell(300, 900, "This is a Computer Generated Invoice", h=9),
    )
    assert value(fields, "vendor") == "Sai Building Traders"
    assert value(fields, "invoiceNumber") == "1620/26-27"


def test_a_labour_bill_is_from_its_contractor(app):
    fields = read(
        app,
        cell(317, 40, "KH GROUP", h=26),
        cell(379, 80, "LABOUR PAYMENT BILL", h=17),
        cell(129, 105, "Bill No.: KH/LB/2026/001", h=19),
        cell(128, 140, "Labour Contractor: Ramesh Kumar", h=19),
        cell(127, 180, "Contact No.: +91 0000000000", h=16),
    )
    assert value(fields, "vendor") == "Ramesh Kumar"


# ── Bill number and date ────────────────────────────────────────────────────────────────────────


def test_values_at_the_foot_of_a_boxed_header(app):
    fields = read(
        app,
        cell(341, 50, "SHREE GANESH ELECTRICAL", h=22),
        cell(809, 197, "INVOICE NO-", h=8),
        cell(962, 199, "DATE:", h=8),
        cell(74, 209, "Floor 17, Orbit Tower, Lower Parel, Mumbai 400013.", h=13),
        cell(74, 245, "GSTIN NO:-27AAAAA0000A1Z5", h=12),
        cell(816, 248, "SG/0594", h=10),
        cell(945, 249, "12 June 2026", h=7),
    )
    assert value(fields, "invoiceNumber") == "SG/0594"
    assert value(fields, "billDate") == "2026-06-12"


def test_a_date_under_its_label_beside_another_number(app):
    fields = read(
        app,
        cell(119, 156, "M/s.Sai Building Traders", h=10),
        cell(580, 150, "Invoice No.", h=8),
        cell(660, 150, "e-Way Bill No.", h=11),
        cell(728, 150, "Dated", h=11),
        cell(581, 166, "1620/26-27", h=8),
        cell(661, 166, "282264874489", h=10),
        cell(745, 166, "12-Aug-26", h=10),
    )
    assert value(fields, "billDate") == "2026-08-12"


# ── The goods table ─────────────────────────────────────────────────────────────────────────────

HEADINGS = (
    cell(85, 306, "Sr.No.", h=9),
    cell(284, 306, "DESCRIPTION OF MATERIAL", h=10),
    cell(601, 307, "SAC CODE", h=9),
    cell(681, 307, "UNIT", h=9),
    cell(750, 305, "QTY", h=13),
    cell(829, 307, "RATE", h=8),
    cell(955, 307, "AMOUNT", h=8),
)


def goods_row(y, serial, name, unit, qty, rate, amount, rise=0):
    """A row as printed: serial and name on the left; the numbers on the right `rise` higher (a
    photo taken at an angle)."""
    return (
        cell(98, y + 1, serial, h=8),
        cell(136, y - 3, name, h=14),
        cell(609, y + 1, "995461", h=8),
        cell(685, y + 1 - rise, unit, h=8),
        cell(748, y - rise, qty, h=8),
        cell(827, y - rise, rate, h=8),
        cell(960, y - rise, amount, h=8),
    )


def test_a_first_row_close_under_the_headings_and_names_from_the_columns_left_edge(app):
    fields = read(
        app,
        *HEADINGS,
        *goods_row(322, "1", "Polycab 4 Sqmm 4 Core Cable", "Mtr", "100.00", "272.00", "27200.00"),
        *goods_row(338, "2", "32 Amp male Top", "Nos", "2.00", "255.00", "510.00"),
        *goods_row(354, "3", "16 Amp Socket", "Nos", "4.00", "35.00", "140.00"),
        cell(65, 375, "TOTAL OF AMOUNT", h=13),
        cell(963, 373, "27850.00", h=10),
    )
    assert rows(fields) == [
        {"description": "Polycab 4 Sqmm 4 Core Cable", "quantity": 100, "unit": "Mtr", "rate": 272, "amount": 27200},
        {"description": "32 Amp male Top", "quantity": 2, "unit": "Nos", "rate": 255, "amount": 510},
        {"description": "16 Amp Socket", "quantity": 4, "unit": "Nos", "rate": 35, "amount": 140},
    ]
    assert value(fields, "taxableAmount") == 27850


def test_amounts_on_a_photo_taken_at_an_angle(app):
    # Each row's right side sits 3 px higher than the one before: the foot of the table tilts
    # ~1.3% while the heading row is level. The GST lines below keep that tilt.
    table = [
        *goods_row(400, "1", "Cement OPC 53", "Bags", "10.00", "250.00", "2500.00", rise=0),
        *goods_row(416, "2", "Sand", "Brass", "1.00", "2500.00", "2500.00", rise=3),
        *goods_row(432, "3", "Steel 12mm", "Kg", "50.00", "50.00", "2500.00", rise=6),
        *goods_row(448, "4", "Binding Wire", "Kg", "25.00", "100.00", "2500.00", rise=9),
    ]
    fields = read(
        app,
        *HEADINGS,
        *table,
        cell(65, 470, "TOTAL OF AMOUNT", h=13),
        cell(963, 459, "10000.00", h=10),
        cell(65, 487, "9% SGST Tax", h=11),
        cell(967, 476, "900.00", h=9),
        cell(65, 504, "9% CGST Tax", h=11),
        cell(968, 493, "900.00", h=10),
        cell(964, 509, "11800 00", h=10),
    )
    assert value(fields, "taxableAmount") == 10000
    assert value(fields, "sgst") == 900
    assert value(fields, "cgst") == 900
    assert value(fields, "totalAmount") == 11800


E_INVOICE_HEADINGS = (
    cell(107, 300, "SI No", h=9),
    cell(255, 300, "Description of Goods", h=10),
    cell(471, 300, "HSN/SAC", h=8),
    cell(583, 300, "Quantity", h=10),
    cell(661, 300, "Rate", h=8),
    cell(713, 300, "per", h=9),
    cell(803, 300, "Amount", h=9),
)


def test_charge_lines_without_a_quantity_are_rows_of_their_own(app):
    fields = read(
        app,
        *E_INVOICE_HEADINGS,
        cell(109, 330, "1 Cable Black Plastic", h=9),
        cell(470, 331, "39269099", h=10),
        cell(590, 331, "20.00 kg", h=10),
        cell(663, 332, "150.00 kg", h=8),
        cell(813, 333, "3,000.00", h=9),
        cell(107, 345, "2 Transport Charges", h=11),
        cell(470, 346, "996791", h=8),
        cell(826, 348, "100.00", h=9),
        cell(108, 360, "3 PUDDLE FLANGE 4\"", h=9),
        cell(469, 360, "73079990", h=9),
        cell(590, 360, "5.00 nos", h=9),
        cell(650, 360, "2,700.00 nos", h=10),
        cell(805, 361, "13,500.00", h=10),
        cell(108, 376, "Round Off", h=9),
        cell(830, 377, "0.40", h=9),
        cell(795, 400, "16,600.40", h=9),
    )
    assert rows(fields) == [
        {"description": "Cable Black Plastic", "quantity": 20, "unit": "kg", "rate": 150, "amount": 3000},
        {"description": "Transport Charges", "quantity": None, "unit": None, "rate": None, "amount": 100},
        {"description": 'PUDDLE FLANGE 4"', "quantity": 5, "unit": "nos", "rate": 2700, "amount": 13500},
    ]
    assert value(fields, "delivered") == 25  # a charge line has nothing to count


def test_the_total_line_lined_up_with_the_last_item_is_not_a_row(app):
    # On a curved photo the table's total amount can sit level with the last item's name, so it
    # looked like a charge line of its own; its amount is what the rows above add up to.
    fields = read(
        app,
        *E_INVOICE_HEADINGS,
        cell(109, 330, "1 Cable Black Plastic", h=9),
        cell(590, 331, "20.00 kg", h=10),
        cell(663, 332, "150.00 kg", h=8),
        cell(813, 333, "3,000.00", h=9),
        cell(108, 345, "2 PUDDLE FLANGE 4\"", h=9),
        cell(590, 345, "5.00 nos", h=9),
        cell(650, 345, "2,700.00 nos", h=10),
        cell(805, 346, "13,500.00", h=10),
        cell(108, 362, "Loading and Unloading", h=9),
        cell(805, 362, "16,500.00", h=10),
        cell(108, 380, "TOTAL OF AMOUNT", h=9),
    )
    assert [r["description"] for r in rows(fields)] == ["Cable Black Plastic", 'PUDDLE FLANGE 4"']


def test_a_long_table_is_read_to_its_last_row(app):
    table = []
    for i in range(30):
        y = 330 + 16 * i
        table += [
            cell(109, y, f"{i + 1} Item number {i + 1}", h=9),
            cell(590, y, "2.00 nos", h=10),
            cell(663, y, "10.00 nos", h=8),
            cell(820, y, "20.00", h=9),
        ]
    fields = read(app, *E_INVOICE_HEADINGS, *table)
    found = rows(fields)
    assert len(found) == 30
    assert found[-1] == {"description": "Item number 30", "quantity": 2, "unit": "nos", "rate": 10, "amount": 20}
    assert value(fields, "delivered") == 60
