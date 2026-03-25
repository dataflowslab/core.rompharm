# 2026-03-25 – Build order production group aggregation
- Backend: aggregated production series across build-order groups by batch code, added `group_build_orders` to `/build-orders/{id}/production`, enforced sign/save only for the current batch code, blocked saving if already saved elsewhere, and computed remaining/return data across the whole group (return orders stored on all group production docs).
- Frontend: Production tab now edits only the current batch code, shows other series read-only, calculates available qty against total used across all series, adds an outlined "Open build order" button per batch, and removes the sequential completion lock.
- Translations: added `Open build order` in `en` and `ro`.

Notes: existing production docs may still include multiple batch codes; the save endpoint now preserves other series but updates only the current batch code.
