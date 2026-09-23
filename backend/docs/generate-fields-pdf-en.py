"""Generate UAE E-Invoice fields PDF (English only) for insurance broking."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).with_name("UAE-E-Invoice-Fields-Broking-EN.pdf")
FONT = r"C:\Windows\Fonts\arial.ttf"
FONT_B = r"C:\Windows\Fonts\arialbd.ttf"


class Guide(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Body", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "UAE E-Invoice Fields - Insurance Broking (IBMS) | English", align="L")
        self.ln(8)
        self.set_draw_color(200, 200, 200)
        self.line(15, self.get_y(), 195, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-14)
        self.set_font("Body", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")


def section(pdf: Guide, title: str):
    pdf.ln(4)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Body", "B", 13)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(20, 60, 100)
    pdf.line(15, pdf.get_y(), 80, pdf.get_y())
    pdf.ln(4)


def field_block(pdf: Guide, name: str, what: str, why: str, example: str, need: str):
    if pdf.get_y() > 250:
        pdf.add_page()

    pdf.set_x(pdf.l_margin)
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Body", "B", 10)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(140, 7, name, fill=True)
    pdf.set_font("Body", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(40, 7, need, fill=True, align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Body", "", 9)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 5, f"What: {what}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 5, f"Why needed: {why}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 90, 60)
    pdf.multi_cell(0, 5, f"Example: {example}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_draw_color(220, 220, 220)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(3)


DOCS = [
    (
        "TAX_INVOICE (380)",
        "Standard VAT tax invoice",
        "Normal broking commission / fee bill with VAT",
        "Commission on POL-8891 billed to client",
        "Type",
    ),
    (
        "CREDIT_NOTE (381)",
        "Credit against a prior tax invoice",
        "Cancel or reduce previous bill (policy cancel / clawback)",
        "Credit AED 500 vs INV-100245 after policy cancel",
        "Type",
    ),
    (
        "DEBIT_NOTE (383)",
        "Debit linked to a prior invoice",
        "Extra charge when commission was under-billed",
        "Extra AED 200 commission after endorsement",
        "Type",
    ),
    (
        "SELF_BILLED_TAX_INVOICE (389)",
        "Buyer issues invoice for supplier",
        "Agreed self-billing (seller = issuer, buyer = supplier)",
        "CMIB self-bills underwriter commission",
        "Type",
    ),
    (
        "SELF_BILLED_CREDIT_NOTE (261)",
        "Credit for a self-billed tax invoice",
        "Adjust/cancel prior self-billed amount",
        "Self-bill credit after premium refund",
        "Type",
    ),
    (
        "COMMERCIAL_INVOICE (480)",
        "Invoice when all lines are E or all O",
        "Exempt / out-of-scope supplies (not a standard VAT tax invoice)",
        "All lines vatCategory E with exemption reason",
        "Type",
    ),
    (
        "COMMERCIAL_CREDIT_NOTE (81)",
        "Credit for a commercial invoice",
        "Credit pure E/O commercial bill",
        "Credit exempt fee previously billed",
        "Type",
    ),
]

HEADER_FIELDS = [
    (
        "tenantCode",
        "Company/tenant code in Hub",
        "Routes invoice to correct broker company and API key tenant",
        "CITY_MARINE",
        "Required",
    ),
    (
        "sourceSystem",
        "Source application code",
        "Must match integration so Hub accepts IBMS traffic",
        "IBMS_BROKING",
        "Required",
    ),
    (
        "idempotencyKey",
        "Unique retry-safe key",
        "Prevents duplicate invoice if IBMS retries the same POST",
        "BROKING-COMM-100245",
        "Required",
    ),
    (
        "documentType",
        "UAE document type",
        "Tells Hub which Peppol type and validation rules to apply",
        "TAX_INVOICE",
        "Required",
    ),
    (
        "invoiceNumber",
        "Business document number (BT-1)",
        "Official number shown to customer / FTA",
        "INV-100245",
        "Required",
    ),
    (
        "sourceDocumentId",
        "Internal IBMS document id",
        "Links Hub record back to IBMS voucher / commission id",
        "100245",
        "Required",
    ),
    (
        "issueDate",
        "Issue date (BT-2)",
        "Legal date the invoice/credit was issued",
        "2026-08-19",
        "Required",
    ),
    (
        "dueDate",
        "Payment due date (BT-9)",
        "Required when amount to pay > 0",
        "2026-09-18",
        "Conditional",
    ),
    (
        "currencyCode",
        "Invoice currency",
        "Defaults to AED; non-AED needs FX fields",
        "AED",
        "Optional",
    ),
    (
        "taxCurrencyCode",
        "Tax reporting currency",
        "Must be AED when invoice currency is not AED",
        "AED",
        "Optional",
    ),
    (
        "exchangeRate",
        "FX rate to AED",
        "Required when currency is not AED",
        "3.6725",
        "Conditional",
    ),
    (
        "taxInclusiveAmountInAed",
        "VAT-inclusive total in AED",
        "Required when currency is not AED",
        "1928.25",
        "Conditional",
    ),
    (
        "references.policyNo",
        "Insurance policy number",
        "Broking reference (Hub accepts; not yet mapped to Peppol XML)",
        "POL-8891",
        "Optional",
    ),
    (
        "notes",
        "Free-text remark",
        "Extra human note on the document (max 1000 chars)",
        "Commission for marine cargo insurance",
        "Optional",
    ),
]

PARTY_FIELDS = [
    (
        "seller.name / buyer.name",
        "Legal party names",
        "Who supplies and who buys - mandatory for UAE e-invoice",
        "City Marine Insurance LLC / ABC Trading LLC",
        "Required",
    ),
    (
        "seller.trn / buyer.trn",
        "UAE Tax Registration Number",
        "Tax identity for FTA; buyer TRN optional only on commercial E/O",
        "100123456700003",
        "Required*",
    ),
    (
        "address.line1, city, state, countryCode",
        "Postal / emirate address",
        "UAE Peppol needs street, city, emirate, country (seller AE)",
        "Business Bay / Dubai / DXB / AE",
        "Required",
    ),
    (
        "legalRegistration + schemeAgencyName",
        "Trade licence (or EID/PAS/CD) + issuing authority",
        "Company legal id plus who issued it (BTAE-12)",
        "tradeLicense 1045678 + Department of Economic Development",
        "Required",
    ),
    (
        "endpointId / endpointScheme",
        "Peppol endpoint",
        "If omitted, Hub uses first 10 digits of TRN; scheme default 0235",
        "1001234567 / 0235",
        "Optional",
    ),
    (
        "contact.name / phone / email",
        "Party contact details",
        "Optional contact person for seller or buyer",
        "accounts@citymarine.ae",
        "Optional",
    ),
]

LINE_FIELDS = [
    (
        "description",
        "Line service / item text",
        "Explains what is billed (commission, fee, adjustment)",
        "Broking Commission - Marine Cargo Policy POL-8891",
        "Required",
    ),
    (
        "quantity",
        "Number of units",
        "Usually 1 for commission; used to compute line net",
        "1",
        "Required",
    ),
    (
        "unitCode",
        "Unit of measure",
        "UN/ECE unit code; default EA (each)",
        "EA",
        "Optional",
    ),
    (
        "unitPrice",
        "Price per unit before VAT",
        "Line net = quantity x unitPrice (Hub calculates)",
        "5000",
        "Required",
    ),
    (
        "vatCategory",
        "UAE VAT category code",
        "Controls tax treatment: S / Z / E / O / AE / K / G",
        "S",
        "Required",
    ),
    (
        "vatRate",
        "VAT percentage",
        "Must match category rules (e.g. S -> 5)",
        "5",
        "Required",
    ),
    (
        "vatExemptionReason",
        "Text reason for E / AE / O / K / G",
        "FTA needs why the supply is not standard-rated",
        "Exempt supply under UAE VAT law",
        "Conditional",
    ),
    (
        "rcmNatureCode",
        "Reverse-charge nature code",
        "Required when vatCategory = AE (BTAE-09)",
        "DL8.48.8.2",
        "Conditional",
    ),
]

EXTRA_FIELDS = [
    (
        "paymentMeans.code",
        "Payment method code (UNCL 4461)",
        "Needed for tax / debit / self-bill / commercial invoices",
        "30 = Credit transfer (bank)",
        "Conditional",
    ),
    (
        "paymentTerms.note",
        "Human-readable payment terms",
        "Optional note such as Net 30 days",
        "Net 30 days",
        "Optional",
    ),
    (
        "precedingInvoiceRef.id",
        "Original invoice number",
        "Links credit/debit to the invoice being adjusted",
        "INV-100245",
        "Conditional",
    ),
    (
        "precedingInvoiceRef.issueDate",
        "Original invoice issue date",
        "Optional date of the referenced invoice",
        "2026-08-19",
        "Optional",
    ),
    (
        "creditNoteReasonCode",
        "FTA credit reason code (BTAE-03)",
        "Required on credit-note family documents",
        "DL8.61.1.A",
        "Conditional",
    ),
    (
        "profileExecutionId",
        "8-bit UAE transaction flags",
        "Self-bill must be 00000000; else freezone / agent / export flags",
        "00000000",
        "Conditional",
    ),
    (
        "principalTrn",
        "Principal TRN for disclosed agent",
        "When broker bills as disclosed agent (BTAE-14)",
        "100555566600003",
        "Conditional",
    ),
]

VAT = [
    ("S", "Standard 5%", "Most UAE broking commission"),
    ("Z", "Zero-rated", "Zero-rated supply if applicable"),
    ("E", "Exempt (needs reason)", "May auto-switch to Commercial"),
    ("O", "Out of scope (needs reason)", "May auto-switch to Commercial"),
    ("AE", "Reverse charge (+ rcmNatureCode)", "Buyer accounts for VAT"),
    ("K", "Intra-GCC (needs reason)", "Intra-GCC treatment"),
    ("G", "Export outside GCC (needs reason)", "Export of service"),
]


def main():
    pdf = Guide(format="A4", unit="mm")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("Body", "", FONT)
    pdf.add_font("Body", "B", FONT_B if Path(FONT_B).exists() else FONT)
    pdf.set_margins(15, 15, 15)

    # Cover
    pdf.add_page()
    pdf.ln(30)
    pdf.set_font("Body", "B", 22)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 10, "UAE E-Invoice Field Guide", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Body", "B", 14)
    pdf.multi_cell(
        0,
        8,
        "Insurance Broking (IBMS) - Source System Fields",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)
    pdf.set_font("Body", "", 12)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 7, "English only", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Body", "", 10)
    pdf.multi_cell(
        0,
        6,
        "Brief explanation of each field: What it is / Why needed / Example.\n"
        "Aligned with E-Invoice Hub POST /v1/invoices (Peppol PINT-AE).",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(10)
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Body", "", 9)
    pdf.multi_cell(
        0,
        6,
        "Hub auto-fills: totals, line IDs, Peppol profile IDs, TaxScheme VAT, endpoint from TRN.\n"
        "IBMS must send: identity, parties, lines, and type-specific extras.",
        fill=True,
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.add_page()
    section(pdf, "1. Document Types")
    for row in DOCS:
        field_block(pdf, *row)

    section(pdf, "2. Header Fields")
    for row in HEADER_FIELDS:
        field_block(pdf, *row)

    section(pdf, "3. Seller & Buyer")
    for row in PARTY_FIELDS:
        field_block(pdf, *row)

    section(pdf, "4. Line Items")
    for row in LINE_FIELDS:
        field_block(pdf, *row)

    pdf.set_font("Body", "B", 10)
    pdf.set_text_color(0, 90, 60)
    pdf.multi_cell(
        0,
        6,
        "Sample: qty 1 x unitPrice 5000 + vatCategory S @ 5% -> net 5,000 + VAT 250 = 5,250 AED",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(2)

    section(pdf, "5. Type Extras")
    for row in EXTRA_FIELDS:
        field_block(pdf, *row)

    section(pdf, "6. VAT Codes")
    pdf.set_font("Body", "B", 9)
    pdf.set_text_color(15, 15, 15)
    pdf.set_fill_color(230, 235, 240)
    for h, w in [("Code", 20), ("Meaning", 75), ("Broking use", 85)]:
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Body", "", 8)
    for code, meaning, use in VAT:
        if pdf.get_y() > 270:
            pdf.add_page()
        pdf.cell(20, 7, code, border=1)
        pdf.cell(75, 7, meaning, border=1)
        pdf.cell(85, 7, use, border=1)
        pdf.ln()

    pdf.ln(6)
    pdf.set_font("Body", "", 9)
    pdf.set_text_color(80, 40, 20)
    pdf.multi_cell(
        0,
        5,
        "Note: If all lines are E or all are O, Hub may auto-change TAX_INVOICE -> COMMERCIAL_INVOICE "
        "(and CREDIT_NOTE -> COMMERCIAL_CREDIT_NOTE). Self-billed and debit notes are never remapped.",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.ln(4)
    section(pdf, "7. Quick Checklist")
    checks = [
        "Credentials + tenantCode + sourceSystem = IBMS_BROKING",
        "Seller & buyer: name, TRN, address, trade licence + schemeAgencyName",
        "Correct documentType",
        "Lines: description, qty, unitPrice, vatCategory, vatRate",
        "Invoice family: paymentMeans.code + dueDate (if payable > 0)",
        "Credit family: precedingInvoiceRef + creditNoteReasonCode",
        "Self-bill: profileExecutionId = 00000000 and correct seller/buyer roles",
        "AE lines: vatExemptionReason + rcmNatureCode",
    ]
    pdf.set_font("Body", "", 9)
    pdf.set_text_color(30, 30, 30)
    for c in checks:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, f"- {c}", new_x="LMARGIN", new_y="NEXT")

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
