// Sample data that mirrors realistic exports from each source type.
// See SOURCES.md for research justification.

export const SAP_FUEL_CSV = `WERKS;TXTMD;MATNR;BUDAT;MENGE;MEINS;BWART
1000;Chicago Plant;DIESEL-EN590;20240115;12500;L;261
1000;Chicago Plant;DIESEL-EN590;20240215;11800;L;261
1000;Chicago Plant;DIESEL-EN590;20240315;13200;L;261
2000;Houston Facility;PETROL-95RON;20240110;8400;L;261
2000;Houston Facility;PETROL-95RON;20240210;9100;L;261
2000;Houston Facility;PETROL-95RON;20240310;7600;L;261
1000;Chicago Plant;ERDGAS-H;20240115;4200;M3;261
1000;Chicago Plant;ERDGAS-H;20240215;3800;M3;261
1000;Chicago Plant;ERDGAS-H;20240315;4600;M3;261
3000;Atlanta Warehouse;DIESEL-EN590;20240120;6200;L;261
3000;Atlanta Warehouse;DIESEL-EN590;20240220;5900;L;261
3000;Atlanta Warehouse;DIESEL-EN590;20240320;6800;L;261
2000;Houston Facility;ERDGAS-H;20240110;2900;M3;261
2000;Houston Facility;ERDGAS-H;20240210;3100;M3;261
2000;Houston Facility;DIESEL-EN590;20240115;89500;L;261`;

export const SAP_PROCUREMENT_CSV = `WERKS;TXTMD;MATNR;BUDAT;MENGE;MEINS;BWART;DESCRIPTION
1000;Chicago Plant;RAW-STEEL;20240131;145000;USD;101;Steel procurement Q1
1000;Chicago Plant;CHEM-SOLV;20240131;28000;USD;101;Chemical solvents
2000;Houston Facility;RAW-ALUM;20240131;67000;USD;101;Aluminum raw material
2000;Houston Facility;PLASTIC-PE;20240131;34500;USD;101;Polyethylene pellets
3000;Atlanta Warehouse;PACKAGING;20240131;19000;USD;101;Cardboard packaging
1000;Chicago Plant;RAW-STEEL;20240229;138000;USD;101;Steel procurement Feb
2000;Houston Facility;CHEM-SOLV;20240229;31000;USD;101;Chemical solvents Feb
3000;Atlanta Warehouse;RAW-ALUM;20240229;52000;USD;101;Aluminum Feb`;

export const UTILITY_CSV = `meter_id,billing_period_start,billing_period_end,consumption_kwh,demand_kw,tariff,utility_name,facility,state
MTR-CHI-001,2024-01-01,2024-01-31,187400,320,C&I-Large,ComEd,Chicago Plant,IL
MTR-CHI-001,2024-02-01,2024-02-29,174200,305,C&I-Large,ComEd,Chicago Plant,IL
MTR-CHI-001,2024-03-01,2024-03-31,192600,335,C&I-Large,ComEd,Chicago Plant,IL
MTR-HOU-001,2024-01-01,2024-01-31,243800,410,TDU-Large,CenterPoint Energy,Houston Facility,TX
MTR-HOU-001,2024-02-01,2024-02-29,228500,390,TDU-Large,CenterPoint Energy,Houston Facility,TX
MTR-HOU-001,2024-03-01,2024-03-31,251200,425,TDU-Large,CenterPoint Energy,Houston Facility,TX
MTR-ATL-001,2024-01-01,2024-01-31,98600,180,Commercial,Georgia Power,Atlanta Warehouse,GA
MTR-ATL-001,2024-02-01,2024-02-29,91200,165,Commercial,Georgia Power,Atlanta Warehouse,GA
MTR-ATL-001,2024-03-01,2024-03-31,104300,190,Commercial,Georgia Power,Atlanta Warehouse,GA
MTR-CHI-002,2024-01-01,2024-01-31,22400,55,Small-Commercial,ComEd,Chicago Office,IL
MTR-CHI-002,2024-02-01,2024-02-29,20800,50,Small-Commercial,ComEd,Chicago Office,IL
MTR-HOU-002,2024-01-15,2024-02-14,31600,70,TDU-Medium,CenterPoint Energy,Houston Office,TX`;

export const TRAVEL_CSV = `trip_id,traveler,expense_type,origin,destination,travel_date,distance_km,nights,amount_usd,currency,flight_class
T-2024-001,Sarah Chen,Air Travel,JFK,LAX,2024-01-08,,0,680,USD,Economy
T-2024-001,Sarah Chen,Hotel,,,2024-01-08,,3,450,USD,
T-2024-002,Marcus Webb,Air Travel,ORD,ATL,2024-01-15,,0,310,USD,Economy
T-2024-002,Marcus Webb,Taxi,,,2024-01-15,25,0,45,USD,
T-2024-003,Priya Nair,Air Travel,JFK,LHR,2024-01-22,,0,1850,USD,Business
T-2024-003,Priya Nair,Hotel,,,2024-01-22,,5,2100,USD,
T-2024-004,Devon Park,Air Travel,SFO,SEA,2024-02-05,,0,285,USD,Economy
T-2024-004,Devon Park,Car Rental,,,2024-02-05,340,0,210,USD,
T-2024-005,Sarah Chen,Air Travel,LAX,LHR,2024-02-12,,0,2100,USD,Economy
T-2024-005,Sarah Chen,Hotel,,,2024-02-12,,4,1800,USD,
T-2024-006,Marcus Webb,Air Travel,DFW,MIA,2024-02-19,,0,420,USD,Economy
T-2024-006,Marcus Webb,Hotel,,,2024-02-19,,2,320,USD,
T-2024-007,Priya Nair,Train,,,2024-03-04,450,0,120,USD,
T-2024-008,Devon Park,Air Travel,ORD,ATL,2024-03-11,,0,310,USD,Economy
T-2024-008,Devon Park,Rideshare,,,2024-03-11,18,0,32,USD,
T-2024-009,Sarah Chen,Air Travel,JFK,LAX,2024-03-18,,0,650,USD,Economy
T-2024-009,Sarah Chen,Hotel,,,2024-03-18,,2,380,USD,
T-2024-010,Marcus Webb,Air Travel,ORD,LHR,2024-03-25,,0,1900,USD,Business`;
