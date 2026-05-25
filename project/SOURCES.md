# Sources

For each data source: what real-world format I researched, what I learned, what the sample data looks like and why, and what would break in a real deployment.

---

## SAP Fuel & Procurement

### Format researched

SAP stores material movements in table MSEG (document segment) and MKPF (document header). The standard extraction paths are:

- **Transaction MB51** — Material Documents report. Exports to spreadsheet as a delimited flat file. Headers are in the logged-in user's language — German installations use WERKS (plant), MATNR (material number), BUDAT (posting date), MENGE (quantity), MEINS (unit of measure), BWART (movement type).
- **Transaction MB52** — Warehouse stocks, useful for inventory levels but not consumption.
- **Custom ABAP report or SAP Query** — Most large SAP installations have bespoke extraction reports built by their BASIS team. These export whatever columns the report author chose.
- **OData API (S/4HANA)** — `API_MATERIAL_DOCUMENT_SRV` exposes material documents via REST. Requires Gateway configuration and authentication.

For procurement, SAP purchasing documents live in EKKO (PO header) and EKPO (PO items). The equivalent export paths are MB51 with movement type 101 (goods receipt against PO) or a custom ME2M report.

### What I learned

The semicolon delimiter is a German locale artifact — SAP installations configured for German use semicolons because German decimals use commas. An English installation uses comma-delimited with period decimals. This is a real source of parser failures in the wild.

Movement type 261 is goods issue to production order — the right signal for fuel consumption when fuel is drawn from a managed warehouse location. However, some clients record fuel purchases directly via FI (finance module) rather than MM (materials management), meaning the data lives in cost center line items, not material movements. There is no universal answer.

Dates in SAP default to DD.MM.YYYY in German locale, YYYYMMDD in some report exports. Both forms exist in real data.

Material numbers (MATNR) are internal codes that mean nothing without the material master description. The description comes from MAKT (material description table). A complete export joins MSEG to MAKT — not all export reports do this.

### Sample data

My sample uses:
- Semicolon delimiters (German locale, realistic for a European-headquartered manufacturer)
- Movement type 261 (consumption posting)
- Three plants: Chicago (1000), Houston (2000), Atlanta (3000)
- Materials: DIESEL-EN590 (Euro-standard diesel), PETROL-95RON, ERDGAS-H (natural gas H-gas)
- Units: L (liters) and M3 (cubic meters)
- Date format: YYYYMMDD

The one "suspicious" record is Houston plant: 89,500 L diesel in a single month — roughly 3× the other plants. This is intentional as an anomaly test case.

### What would break in production

1. **Material master missing.** Without MAKT joined in, we get material numbers but no descriptions. Our fuel type detection (diesel/petrol/gas) relies on pattern-matching material names. If the client uses opaque material codes like `0000000012345`, we'd misclassify everything.
2. **Multiple UOM.** SAP material master can have multiple units of measure (base UOM, order UOM, storage UOM). The export might show the PO unit (gallons) while the base UOM is liters. We'd need the conversion factor from MARM table.
3. **Cost center vs. MM fuel recording.** If fuel is recorded in FI not MM, this parser produces zero records. We'd need a parallel FI line item extractor.
4. **Reversal documents.** SAP movement type 262 reverses a 261. If a reversal posts in a different period, our monthly totals will be wrong. We'd need to net 261s against 262s.

---

## Utility Electricity

### Format researched

US utilities offer several data export paths:

- **Portal CSV download** — Most large commercial accounts (C&I tariff) have a web portal (e.g., ComEd SmartMeter, CenterPoint MyAccount). The CSV export typically includes billing period, kWh consumption, peak demand (kW), and sometimes interval data.
- **Green Button (ESPI)** — A federal standard for electricity data portability. Green Button Download gives you an XML file. Green Button Connect (OAuth) gives API access. Adoption is uneven — large utilities in California and the Northeast support it; many Midwest/Southern utilities do not.
- **EDI 867** — Electronic data interchange for meter reads, used in deregulated markets (Texas, PJM states) where the retail supplier is separate from the utility. Large commercial customers sometimes receive EDI 867 from their energy supplier.
- **PDF bills** — The fallback. Every utility provides a PDF. Parsing them requires OCR and bill-specific templates.

### What I learned

Billing periods are not calendar months. A utility reads the meter when the reader walks the route, not on the first of the month. A billing period might be Jan 14 – Feb 13, or 27 days, or 33 days. Any system that stores only "month + year" is losing information.

Peak demand (kW) appears on C&I bills alongside consumption (kWh). Demand charges are often the majority of the electricity bill for manufacturers. We store it but don't use it for emission calculation (demand is an instantaneous measure; emissions are from energy consumed).

US regional grid emission factors vary significantly. EPA eGRID 2022 has factors ranging from 0.148 kg CO2e/kWh (Pacific NW, hydro-heavy) to 0.592 kg CO2e/kWh (Mountain, coal-heavy). Using a national average for a client with facilities in both Oregon and Indiana would misrepresent both.

### Sample data

My sample includes:
- Meters for three facilities: Chicago (ComEd, Illinois), Houston (CenterPoint, Texas), Atlanta (Georgia Power, Georgia)
- One meter with a non-calendar billing period: MTR-HOU-002 runs Jan 15 – Feb 14
- Realistic consumption scale: Chicago plant at ~190 MWh/month for a mid-sized manufacturing facility
- Demand readings included (not used in emission calc but stored in `activity_description`)

I use a single US average eGRID factor (0.386) rather than per-state factors because we don't have state-specific factors wired into the parser for this prototype. This is flagged in TRADEOFFS.md.

### What would break in production

1. **Non-calendar billing periods.** We store period_start/period_end correctly, but any downstream monthly rollup needs to prorate across months. We don't implement prorating.
2. **Multiple tariffs per meter.** Some large accounts have demand + energy + off-peak charges on separate line items. A single CSV row per billing period conflates these.
3. **Green Button XML.** If the client uses Green Button Download instead of portal CSV, our CSV parser doesn't apply. We'd need an XML parser for ESPI format.
4. **Renewable tariffs.** If the client is on a utility green tariff or has PPAs, location-based factors should be replaced with market-based factors. We don't ask the utility export about this.
5. **Demand response adjustments.** Some utilities credit back energy during demand response events. Net consumption might not match the meter read delta.

---

## Corporate Travel

### Format researched

The major platforms:

- **SAP Concur** — Market leader. Trip data accessible via Expense Reports API (v3) or via Extract files (batch export). The extract is a flat file or CSV with columns including: ReportID, EmployeeName, ExpenseTypeName, TransactionDate, Amount, Currency, CityFrom, CityTo, ClassOfService, MilesKm. API requires OAuth client credentials.
- **Navan (TripActions)** — Newer entrant. Has a REST API with `/v1/trips` endpoint returning JSON, including flights (with IATA airport codes, cabin class), hotels (check-in/out dates, city), and ground transport. API requires bearer token.
- **BCD Travel, Amex GBT** — TMC platforms with proprietary export formats, often delivered as SFTP files in the airline industry's standard BSP/ARC format or a custom flat file.

The common thread: every platform gives you expense type, traveler, origin/destination (as city or airport code), date, and cost. Distance is sometimes included for car and rail, rarely for flights.

### What I learned

Airport codes (IATA) are the standard for origin/destination in flight data. Distance is almost never included — the platform knows the route, not the distance. Emission calculation requires either a distance lookup table or a great-circle calculation from lat/lon.

Cabin class matters significantly for emission factors. DEFRA 2023 factors for transatlantic flights: Economy 0.155 kg/km, Business 0.427 kg/km, First 0.581 kg/km. Ignoring cabin class undercounts business class travel substantially.

Ground transport is messier: some exports give distance (car rentals usually do from GPS data), others give only cost (taxis rarely have distance). Cost-based emission estimation for taxis introduces significant error.

Hotels: platforms give check-in/out dates and city, sometimes hotel name. Per-night emission factors are the most practical approach; property-level factors require data from hotel chains' environmental programs (e.g., Hotel Footprint Tool, HCMI standard).

### Sample data

My sample includes:
- Four travelers with realistic travel patterns (mostly air travel, some hotel, some ground)
- Mix of short-haul (ORD-ATL, SFO-SEA) and long-haul (JFK-LHR, LAX-LHR) flights
- Mix of economy and business class
- Hotel nights attached to multi-day trips
- Car rental, taxi/rideshare, and rail records
- No distances in flight rows (forcing airport-code lookup)
- One rail record (Priya Nair, 450 km) as an example of lower-carbon ground transport

### What would break in production

1. **Missing airport pairs.** My lookup table covers 8 common routes. Any route not in the table falls back to 1,000 km. A London-Singapore flight would be severely underestimated.
2. **Cabin class not exported.** If Concur doesn't include cabin class in the extract configuration, we can't apply class-specific factors. Many companies don't configure their extract to include this field.
3. **Hotel city vs. hotel brand.** Per-night factors assume an average hotel. Luxury hotels have higher emissions per night than budget hotels. Property-level data would require integration with the HCMI database or individual hotel group APIs.
4. **Currency conversion.** Travel costs in non-USD currencies need conversion for any spend-based supplementary calculations. We don't handle currency conversion.
5. **Personal vs. business travel.** Concur/Navan data includes all expense reports, not just GHG-reportable business travel. Commuting expenses, personal extensions to business trips, and some client entertainment would need to be filtered. There is no programmatic way to distinguish these without the expense type classification being consistently used by the client.
