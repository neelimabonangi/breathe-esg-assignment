# Decisions

Every significant ambiguity I resolved, plus what I'd ask the PM if I could.

---

## SAP: Which export format?

**Chose:** Flat file (semicolon-delimited CSV), mapping SAP's standard field names (WERKS, MATNR, BUDAT, MENGE, MEINS, BWART).

**Why not IDoc:** IDocs are XML or positional flat files used for system-to-system EDI. Parsing them requires knowing the message type (e.g., MATMAS, MBGMCR) and the segment structure, which varies by SAP version and client customization. Without a live SAP system or IDoc metadata, the parser is fragile. Flat file exports from transaction MB52, MB51, or a custom report are what sustainability leads actually send.

**Why not OData:** OData (via SAP's Gateway or S/4HANA API) is the right choice for a production integration — it's query-able, typed, and paginates. But it requires credentials, an RFC connection, and knowledge of which Business Object (e.g., `/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV`) the client has exposed. Without those, we'd be building a connector we can't test. For a prototype, flat file is more honest.

**What I'd ask the PM:** Does this client use S/4HANA or ECC? Do they have a Gateway configured? Who owns the SAP integration project on their side? If they can give us an OData endpoint, we should use it. If they're exporting manually, we need to know which transaction they run.

**German headers:** SAP exports in the language of the logged-in user. A German installation sends WERKS not PLANT. I handle this with a normalization map in the parser. The map is not exhaustive — I'd want to see an actual export before claiming completeness.

---

## SAP: Movement type (BWART) scope

**Chose:** Movement type 261 (goods issue to production order) as the primary fuel consumption signal.

**Why:** 261 is a consumption posting — stock leaving inventory for use. 501 (receipt without PO) and 101 (GR against PO) are procurement postings. Using 261 correctly identifies consumption vs. procurement. In reality, some clients record fuel via FI cost center postings (transaction FB50) not MM movements — another thing to ask the PM.

**What I'd ask:** Does this client use plant maintenance orders for fuel recording, or is it direct goods issue? Do they have a custom fuel management workflow?

---

## Utility data: Which mode?

**Chose:** Portal CSV export (comma-delimited, Green Button-compatible columns).

**Why not PDF:** PDF parsing is brittle and format-dependent. Every utility has a different bill layout. OCR introduces errors in numbers — exactly the wrong place to have errors. A structured CSV is what a facilities team can actually produce repeatably.

**Why not utility API:** Very few US utilities expose a real API. Green Button Connect (ESPI) is the closest standard, but adoption is patchy. Large commercial customers sometimes get EDI 867 (meter data) delivered to their ERP. For a prototype, assuming portal CSV is the realistic path.

**Billing period alignment:** Utility bills don't align to calendar months — a meter read on Jan 14 to Feb 13 is a real thing. I store `period_start` and `period_end` separately (not just a month) to handle this correctly. Downstream GHG calculations need to prorate across calendar months if they want monthly granularity.

**What I'd ask:** Does this client use interval data (15-min smart meter) or monthly billing totals? Multiple meters per facility? Do they have RECs or renewable contracts that affect Scope 2 market-based calculation?

---

## Travel: Which platform?

**Chose:** Concur/Navan CSV expense export format, since both platforms export a similar structure (trip ID, expense type, traveler, origin, destination, date, amount).

**Why not Navan API:** Navan's API is real and documented, but it requires an API key and OAuth flow. Concur's API (TripIt format) similarly requires credentials. For a prototype without a live client system, CSV export is more honest and testable.

**Distance calculation:** Navan/Concur sometimes include `distance_km` for car rentals and rail; they almost never include it for flights. I fall back to a static airport-pair lookup table for common routes. Unknown routes default to 1,000 km — this is a visible gap and would be flagged in a real deployment.

**Emission factor split:** I split flights at 3,700 km (short vs. long haul) following DEFRA 2023, which is the most commonly cited source for UK/EU reporting. US reporters often use EPA factors; I default to DEFRA here but flag it as a question for client reporting requirements.

**What I'd ask:** Does this client need radiative forcing index (RFI) applied to flights? Some frameworks require it, some don't. Does the travel platform export hotel nights or just cost? Do they need Scope 3 Category 6 broken out by transport mode for CSRD?

---

## Procurement: Spend-based or activity-based?

**Chose:** Spend-based with a flat $0.50/USD intensity factor as a placeholder.

**Why:** Activity-based procurement emissions require knowing the physical quantity and material composition of each purchased item, plus lifecycle emission factors per material. SAP has material-level data (MATNR), but mapping every material code to an emission factor would require an EEIO database (like USEEIO or Exiobase) that is outside scope for a prototype. Spend-based is what most companies at early reporting maturity actually use for Category 1.

**What's wrong with this:** $0.50/kg CO2e per USD is a rough placeholder. The real number varies enormously by spend category — steel is ~2 kg CO2e/USD, software services is ~0.05 kg CO2e/USD. In production, you'd categorize spend by NAICS/ISIC code and apply the appropriate EEIO sector.

**What I'd ask:** What level of Scope 3 Category 1 granularity does this client need? Do they have a preferred EEIO model? Are they reporting to GHG Protocol, CDP, or CSRD? Each has different materiality thresholds for Category 1.

---

## Review workflow: Who can approve?

**Chose:** Any authenticated analyst can approve any record.

**Why not:** In production, you'd want separation of duties — the person who ingested the data shouldn't be the one approving it. You might also want a two-person rule for records above a threshold. I didn't implement this because it would require a proper auth system (see TRADEOFFS.md), and the data model already supports it: `reviewed_by` is stored, so adding role-based approval is a policy change, not a schema change.

---

## Anomaly detection thresholds

**Chose:** Hard-coded per-category thresholds (e.g., >50,000 kg CO2e for a single fuel record is an anomaly).

**Why not ML:** Anomaly detection on time series requires historical data. A client being onboarded has no history. Threshold-based detection is less sophisticated but works immediately on first ingestion.

**Known limitation:** Thresholds are not per-facility or per-client. A large manufacturing plant that genuinely uses 100,000 kg CO2e/month in fuel would generate constant false positives. In production, thresholds would be calibrated per facility after the first few months of data.
