# Legacy UI retirement — 2026-10-13

Status: legacy route implementations removed; retained capabilities are available under v3.

Removed only `app/dashboard` and `app/super-admin`. Database tables, migrations, APIs, and shared components were retained. Existing records were not modified by migration verification.

## Restored capabilities

| Capability | New destination |
| --- | --- |
| Excel intake (stock/pawn/installment) | `/v3/tools` |
| Device / goods / parts barcode and QR labels | `/v3/tools` (30x20 and 50x25 printer) |
| A4 goods labels and QR sizes | `/v3/goods/print` |
| Edit/delete device sales | `/v3/sales/history` |
| Edit/delete goods sale rows and receipts | `/v3/goods/history` |
| View/delete completed installment history | `/v3/installment/history` |
| Edit installment contracts, delete payments, early closure | `/v3/installment/detail?id=...` |
| Repair paid amounts, parts, status, deletion | `/v3/repair/detail?id=...` |
| Daily report and CSV export | `/v3/reports/detailed` |
| Super-admin account editing | `/v3/super-admin/users/manage` |
| Feedback statuses, notes, deletion | `/v3/super-admin/feedback/manage` |

Main v3 add/edit/sell/detail modals remain the default. Supplemental screens preserve the tested legacy workflows under the v3 authenticated shell and reuse their existing visual components where appropriate; this is not a complete visual rewrite of those forms.

## Navigation and access

- `lib/legacy-routes.ts` maps all 38 old page URLs to existing v3 pages, preserving record IDs and required modal query parameters; `old=1` no longer reopens the removed system.
- Contextual links expose tools/history/export actions from the relevant module.
- Server-side guards protect administrative history/report pages and all super-admin pages.
- New import/label tools explicitly filter by shop and selected branch; migrated sale/history mutations also include shop filters.
- PWA start URL, shortcuts, impersonation destination and auth-confirm fallback now use v3.
- Shared classic CSS remains necessary for retained forms and label printing; it was not blindly deleted.

## Verification

- `node verify-legacy-retirement.cjs`: verifies all 38 destinations, ID preservation, migrated capability symbols, pawn import defaults and inclusive report ranges.
- Read-only live schema checks succeeded for sales, goods sales, installment stock/payments/history, and compatibility joins. No production write was used for verification.
- Production build succeeds after removing both legacy directories.

## Limits

Live authenticated two-shop tests, destructive history edits/deletes, contract closure, physical label printing and a real Excel import were not executed against production records. Build/schema/source tests do not prove those complete user workflows. Validate them using a test shop before relying on the migration in production.