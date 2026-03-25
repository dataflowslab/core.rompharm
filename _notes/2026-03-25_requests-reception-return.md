# 2026-03-25 – Reception refusal/return to sender
- Added rejection handling in `update_reception_status` for Requests: when Receive Stock decision is refused/canceled, destination is switched to source, `reception_*` metadata is stored, and audit logs include a return-to-sender entry.
- Reception “Stock received” transfer now skips stock redistribution when source==destination but still updates movement states, to avoid altering stock splits.
- `get_request` now enriches `reception_initial_destination_detail` and serializes new reception fields.
- ReceptieTab shows a decision message for rejected cases (“Canceled/Refused by … Goods are set to return to Expeditor”), allows decision changes for return-to-sender even if signatures exist, and skips auto-sign on rejected decisions.
- Added i18n keys for the new messaging.
