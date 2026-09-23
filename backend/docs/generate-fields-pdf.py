"""Generate UAE E-Invoice fields PDF (EN + Malayalam) for insurance broking."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).with_name("UAE-E-Invoice-Fields-Broking-ML.pdf")
FONT = r"C:\Windows\Fonts\NIRMALA.TTF"
FONT_B = r"C:\Windows\Fonts\NIRMALAB.TTF"


class Guide(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Nirmala", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "UAE E-Invoice Fields - Insurance Broking (IBMS)  |  EN + മലയാളം", align="L")
        self.ln(8)
        self.set_draw_color(200, 200, 200)
        self.line(15, self.get_y(), 195, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-14)
        self.set_font("Nirmala", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")


def section(pdf: Guide, title: str):
    pdf.ln(4)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Nirmala", "B", 13)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(20, 60, 100)
    pdf.line(15, pdf.get_y(), 80, pdf.get_y())
    pdf.ln(4)


def field_block(pdf: Guide, name: str, what: str, why: str, example: str, ml: str, need: str):
    # Keep blocks from splitting awkwardly
    if pdf.get_y() > 250:
        pdf.add_page()

    pdf.set_x(pdf.l_margin)
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Nirmala", "B", 10)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(140, 7, name, fill=True)
    pdf.set_font("Nirmala", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(40, 7, need, fill=True, align="R", new_x="LMARGIN", new_y="NEXT")

    label_what = "What / \u0d0e\u0d28\u0d4d\u0d24\u0d3e\u0d23\u0d4d: "  # എന്താണ്
    label_why = "Why / \u0d0e\u0d28\u0d4d\u0d24\u0d3f\u0d28\u0d4d: "  # എന്തിന്
    label_ex = "Example / \u0d09\u0d26\u0d3e\u0d39\u0d30\u0d23\u0d02: "  # ഉദാഹരണം
    label_ml = "\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02: "  # മലയാളം

    pdf.set_font("Nirmala", "", 9)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 5, label_what + what, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 5, label_why + why, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 90, 60)
    pdf.multi_cell(0, 5, label_ex + example, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(70, 40, 100)
    pdf.multi_cell(0, 5, label_ml + ml, new_x="LMARGIN", new_y="NEXT")
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
        "സാധാരണ ടാക്സ് ഇൻവോയ്‌സ് - വാറ്റ് ഉൾപ്പെടെ കമ്മീഷൻ ബിൽ",
    ),
    (
        "CREDIT_NOTE (381)",
        "Credit against a prior tax invoice",
        "Cancel or reduce previous bill (policy cancel / clawback)",
        "Credit AED 500 vs INV-100245 after policy cancel",
        "ക്രെഡിറ്റ് നോട്ട് - മുമ്പത്തെ ബിൽ കുറയ്ക്കുക/റദ്ദാക്കുക",
    ),
    (
        "DEBIT_NOTE (383)",
        "Debit linked to a prior invoice",
        "Extra charge when commission was under-billed",
        "Extra AED 200 commission after endorsement",
        "ഡെബിറ്റ് നോട്ട് - അധിക തുക ചാർജ് ചെയ്യുക",
    ),
    (
        "SELF_BILLED_TAX_INVOICE (389)",
        "Buyer issues invoice for supplier",
        "Agreed self-billing (seller=issuer, buyer=supplier)",
        "CMIB self-bills underwriter commission",
        "സെൽഫ്-ബിൽഡ് ടാക്സ് ഇൻവോയ്‌സ് - വാങ്ങുന്നയാൾ ബിൽ ഇഷ്യൂ ചെയ്യുന്നു",
    ),
    (
        "SELF_BILLED_CREDIT_NOTE (261)",
        "Credit for a self-billed tax invoice",
        "Adjust/cancel prior self-billed amount",
        "Self-bill credit after premium refund",
        "സെൽഫ്-ബിൽഡ് ക്രെഡിറ്റ് നോട്ട്",
    ),
    (
        "COMMERCIAL_INVOICE (480)",
        "Invoice when all lines are E or all O",
        "Exempt / out-of-scope supplies (not standard VAT TI)",
        "All lines vatCategory E with exemption reason",
        "കൊമേഴ്‌സ്യൽ ഇൻവോയ്‌സ് - എക്‌സംപ്റ്റ്/സ്‌കോപ്പിന് പുറത്ത്",
    ),
    (
        "COMMERCIAL_CREDIT_NOTE (81)",
        "Credit for a commercial invoice",
        "Credit pure E/O commercial bill",
        "Credit exempt fee previously billed",
        "കൊമേഴ്‌സ്യൽ ക്രെഡിറ്റ് നോട്ട്",
    ),
]

HEADER_FIELDS = [
    (
        "tenantCode",
        "Company/tenant code in Hub",
        "Routes invoice to correct broker company & API key tenant",
        "CITY_MARINE",
        "ഏത് കമ്പനിയുടെ ഇൻവോയ്‌സ് ആണെന്ന് തിരിച്ചറിയാൻ",
        "Required",
    ),
    (
        "sourceSystem",
        "Source application code",
        "Must match integration (so Hub accepts IBMS traffic)",
        "IBMS_BROKING",
        "ഏത് സോഴ്‌സ് സിസ്റ്റത്തിൽ നിന്ന് വന്നു എന്ന് അറിയാൻ",
        "Required",
    ),
    (
        "idempotencyKey",
        "Unique retry-safe key",
        "Prevents duplicate invoice if IBMS retries the same POST",
        "BROKING-COMM-100245",
        "ഒരേ ഇൻവോയ്‌സ് രണ്ടുതവണ സൃഷ്ടിക്കാതിരിക്കാൻ",
        "Required",
    ),
    (
        "documentType",
        "UAE document type",
        "Tells Hub which Peppol type/rules to apply",
        "TAX_INVOICE",
        "ഏത് തരം ഇ-ഇൻവോയ്‌സ് ആണെന്ന് നിർണയിക്കാൻ",
        "Required",
    ),
    (
        "invoiceNumber",
        "Business document number (BT-1)",
        "Official number shown to customer / FTA",
        "INV-100245",
        "കസ്റ്റമറും FTA-യും കാണുന്ന ബിൽ നമ്പർ",
        "Required",
    ),
    (
        "sourceDocumentId",
        "Internal IBMS document id",
        "Links Hub record back to IBMS voucher / commission id",
        "100245",
        "IBMS-ലെ ആന്തരിക വൗച്ചർ ID ബന്ധിപ്പിക്കാൻ",
        "Required",
    ),
    (
        "issueDate",
        "Issue date (BT-2)",
        "Legal date the invoice/credit was issued",
        "2026-08-19",
        "ഇൻവോയ്‌സ് ഇഷ്യൂ ചെയ്ത തീയതി",
        "Required",
    ),
    (
        "dueDate",
        "Payment due date (BT-9)",
        "Required when amount to pay > 0",
        "2026-09-18",
        "പണം അടയ്‌ക്കേണ്ട അവസാന തീയതി (തുക > 0 ആണെങ്കിൽ)",
        "Conditional",
    ),
    (
        "currencyCode",
        "Invoice currency",
        "Defaults to AED; non-AED needs FX fields",
        "AED",
        "ഇൻവോയ്‌സ് കറൻസി (സാധാരണ AED)",
        "Optional",
    ),
    (
        "references.policyNo",
        "Insurance policy number",
        "Broking reference (Hub accepts; not yet in Peppol XML)",
        "POL-8891",
        "പോളിസി നമ്പർ റഫറൻസ്",
        "Optional",
    ),
    (
        "notes",
        "Free-text remark",
        "Extra human note on the document (max 1000)",
        "Commission for marine cargo insurance",
        "അധിക കുറിപ്പ്",
        "Optional",
    ),
]

PARTY_FIELDS = [
    (
        "seller.name / buyer.name",
        "Legal party names",
        "Who supplies and who buys - mandatory for UAE e-invoice",
        "City Marine Insurance LLC / ABC Trading LLC",
        "വിൽപ്പനക്കാരൻ / വാങ്ങുന്നയാളുടെ നിയമപരമായ പേര്",
        "Required",
    ),
    (
        "seller.trn / buyer.trn",
        "UAE Tax Registration Number",
        "Tax identity for FTA; buyer TRN optional only on commercial E/O",
        "100123456700003",
        "UAE ടാക്സ് രജിസ്ട്രേഷൻ നമ്പർ (TRN)",
        "Required*",
    ),
    (
        "address.line1, city, state, countryCode",
        "Postal / emirate address",
        "UAE Peppol needs street, city, emirate, country (seller AE)",
        "Business Bay / Dubai / DXB / AE",
        "വിലാസം, നഗരം, എമിറേറ്റ്, രാജ്യം",
        "Required",
    ),
    (
        "legalRegistration + schemeAgencyName",
        "Trade licence (or EID/PAS/CD) + authority",
        "Company legal id + who issued it (BTAE-12)",
        "tradeLicense 1045678 + Department of Economic Development",
        "ട്രേഡ് ലൈസൻസും അതോറിറ്റി പേരും",
        "Required",
    ),
]

LINE_FIELDS = [
    (
        "description",
        "Line service / item text",
        "Explains what is billed (commission, fee, adjustment)",
        "Broking Commission - Marine Cargo Policy POL-8891",
        "എന്താണ് ബിൽ ചെയ്യുന്നത് എന്ന വിവരണം",
        "Required",
    ),
    (
        "quantity",
        "Number of units",
        "Usually 1 for commission; used to compute line net",
        "1",
        "യൂണിറ്റ് എണ്ണം (കമ്മീഷന് സാധാരണ 1)",
        "Required",
    ),
    (
        "unitPrice",
        "Price per unit before VAT",
        "Line net = quantity × unitPrice (Hub calculates)",
        "5000",
        "യൂണിറ്റ് വില (വാറ്റ് ഇല്ലാതെ)",
        "Required",
    ),
    (
        "vatCategory",
        "UAE VAT category code",
        "Controls tax treatment: S/Z/E/O/AE/K/G",
        "S",
        "വാറ്റ് കാറ്റഗറി കോഡ്",
        "Required",
    ),
    (
        "vatRate",
        "VAT percentage",
        "Must match category rules (e.g. S -> 5)",
        "5",
        "വാറ്റ് ശതമാനം",
        "Required",
    ),
    (
        "vatExemptionReason",
        "Text reason for E/AE/O/K/G",
        "FTA needs why supply is not standard-rated",
        "Exempt supply under UAE VAT law",
        "എക്‌സംപ്ഷൻ/റിവേഴ്‌സ് ചാർജ് കാരണം",
        "Conditional",
    ),
    (
        "rcmNatureCode",
        "Reverse-charge nature code",
        "Required when vatCategory = AE (BTAE-09)",
        "DL8.48.8.2",
        "റിവേഴ്‌സ് ചാർജ് പ്രകൃതി കോഡ് (AE-ന്)",
        "Conditional",
    ),
]

EXTRA_FIELDS = [
    (
        "paymentMeans.code",
        "Payment method code (UNCL 4461)",
        "Needed for tax/debit/self-bill/commercial invoices",
        "30 = Credit transfer (bank)",
        "പേയ്‌മെന്റ് രീതി കോഡ്",
        "Conditional",
    ),
    (
        "precedingInvoiceRef.id",
        "Original invoice number",
        "Links credit/debit to the invoice being adjusted",
        "INV-100245",
        "ക്രെഡിറ്റ്/ഡെബിറ്റ് ചെയ്യുന്ന യഥാർത്ഥ ബിൽ നമ്പർ",
        "Conditional",
    ),
    (
        "creditNoteReasonCode",
        "FTA credit reason code (BTAE-03)",
        "Required on credit-note family documents",
        "DL8.61.1.A",
        "ക്രെഡിറ്റ് നോട്ട് കാരണ കോഡ്",
        "Conditional",
    ),
    (
        "profileExecutionId",
        "8-bit UAE transaction flags",
        "Self-bill must be 00000000; else freezone/agent/export flags",
        "00000000",
        "UAE ട്രാൻസാക്ഷൻ ഫ്ലാഗ് (സെൽഫ്-ബില്ലിൽ എല്ലാം 0)",
        "Conditional",
    ),
    (
        "principalTrn",
        "Principal TRN for disclosed agent",
        "When broker bills as disclosed agent (BTAE-14)",
        "100555566600003",
        "ഡിസ്‌ക്ലോസ്ഡ് ഏജന്റ് ബില്ലിംഗിൽ പ്രിൻസിപ്പൽ TRN",
        "Conditional",
    ),
]

VAT = [
    ("S", "Standard 5%", "Most UAE broking commission", "സാധാരണ വാറ്റ്"),
    ("Z", "Zero-rated", "Zero-rated supply if applicable", "സീറോ-റേറ്റഡ്"),
    ("E", "Exempt (needs reason)", "May auto-switch to Commercial", "എക്‌സംപ്റ്റ്"),
    ("O", "Out of scope (needs reason)", "May auto-switch to Commercial", "സ്‌കോപ്പിന് പുറത്ത്"),
    ("AE", "Reverse charge (+ rcmNatureCode)", "Buyer accounts for VAT", "റിവേഴ്‌സ് ചാർജ്"),
    ("K", "Intra-GCC (needs reason)", "Intra-GCC treatment", "GCC-യ്ക്കുള്ളിൽ"),
    ("G", "Export outside GCC (needs reason)", "Export of service", "GCC-യ്ക്ക് പുറത്ത് എക്‌സ്‌പോർട്ട്"),
]


def main():
    pdf = Guide(format="A4", unit="mm")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("Nirmala", "", FONT)
    pdf.add_font("Nirmala", "B", FONT_B if Path(FONT_B).exists() else FONT)
    pdf.set_margins(15, 15, 15)

    # Cover
    pdf.add_page()
    pdf.ln(30)
    pdf.set_font("Nirmala", "B", 22)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 10, "UAE E-Invoice Field Guide", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Nirmala", "B", 14)
    pdf.multi_cell(
        0,
        8,
        "Insurance Broking (IBMS) - Source System Fields",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)
    pdf.set_font("Nirmala", "", 12)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 7, "English + Malayalam", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Nirmala", "", 11)
    pdf.multi_cell(0, 7, "English + മലയാളം", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Nirmala", "", 10)
    pdf.multi_cell(
        0,
        6,
        "Brief explanation of each field: What it is / Why needed / Example / Malayalam.\n"
        "Aligned with E-Invoice Hub POST /v1/invoices (Peppol PINT-AE).",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(10)
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Nirmala", "", 9)
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

    # Document types
    pdf.add_page()
    section(pdf, "1. Document Types / ഡോക്യുമെന്റ് തരങ്ങൾ")
    for code, what, why, ex, ml in DOCS:
        field_block(pdf, code, what, why, ex, ml, "Type")

    section(pdf, "2. Header Fields / ഹെഡർ ഫീൽഡുകൾ")
    for row in HEADER_FIELDS:
        field_block(pdf, *row)

    section(pdf, "3. Seller & Buyer / കക്ഷികൾ")
    for row in PARTY_FIELDS:
        field_block(pdf, *row)

    section(pdf, "4. Line Items / ലൈൻ ഇനങ്ങൾ")
    for row in LINE_FIELDS:
        field_block(pdf, *row)

    pdf.set_font("Nirmala", "B", 10)
    pdf.set_text_color(0, 90, 60)
    pdf.multi_cell(
        0,
        6,
        "Sample: qty 1 × unitPrice 5000 + vatCategory S @ 5% -> net 5,000 + VAT 250 = 5,250 AED",
    )
    pdf.ln(2)

    section(pdf, "5. Type Extras / തരം അനുസരിച്ച് അധിക ഫീൽഡുകൾ")
    for row in EXTRA_FIELDS:
        field_block(pdf, *row)

    section(pdf, "6. VAT Codes / വാറ്റ് കോഡുകൾ")
    pdf.set_font("Nirmala", "B", 9)
    pdf.set_text_color(15, 15, 15)
    pdf.set_fill_color(230, 235, 240)
    for h, w in [("Code", 18), ("Meaning", 55), ("Broking use", 60), ("മലയാളം", 47)]:
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Nirmala", "", 8)
    for code, meaning, use, ml in VAT:
        if pdf.get_y() > 270:
            pdf.add_page()
        pdf.cell(18, 7, code, border=1)
        pdf.cell(55, 7, meaning, border=1)
        pdf.cell(60, 7, use[:34], border=1)
        pdf.cell(47, 7, ml, border=1)
        pdf.ln()

    pdf.ln(6)
    pdf.set_font("Nirmala", "", 9)
    pdf.set_text_color(80, 40, 20)
    pdf.multi_cell(
        0,
        5,
        "Note: If all lines are E or all are O, Hub may auto-change TAX_INVOICE -> COMMERCIAL_INVOICE "
        "(and CREDIT_NOTE -> COMMERCIAL_CREDIT_NOTE). Self-billed and debit notes are never remapped.",
    )

    pdf.ln(4)
    section(pdf, "7. Quick Checklist / ചെക്ക്‌ലിസ്റ്റ്")
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
    pdf.set_font("Nirmala", "", 9)
    pdf.set_text_color(30, 30, 30)
    for c in checks:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, f"- {c}", new_x="LMARGIN", new_y="NEXT")

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
