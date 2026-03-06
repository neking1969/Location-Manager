# Location-Manager — Archived Changes & Learnings

> Moved from CLAUDE.md on 2026-03-06 to keep the main file lean.

## Archived Changes (2026-02-13 and earlier)

### Recent Changes (2026-02-13)

27. **File Delete & Replace** - Added delete button on each file card with confirmation modal. "Delete File" removes data from S3, removes confirmation entry, removes card from UI.

26. **File Confirmation Blur Overlay** - Dashboard blurred until Kirsten confirms all source files. FileVerification component exposes `onAllConfirmed` callback.

25. **Sync Now Button** - Triggers Make.com auto-sync on-demand via Lambda `/trigger-sync` endpoint.

24. **Google Drive Auto-Sync — COMPLETE** - End-to-end: Kirsten drops files → Make.com detects → downloads → sends to Lambda → S3 → dashboard updates.

23. **Multipart File Upload Support** - Lambda `/sync` accepts `multipart/form-data` in addition to JSON.

22. **Non-Location Spend Indicator** - Amber badge on Budget page episode headers for payroll/overhead.

21. **Service Charge Classification** - SERVICE_CHARGE locations properly classified instead of `no_budget_match`.

20. **Location Mapping Expansion** (v2.4) - Reduced truly unknown locations from ~30 to 0.

19bis. **Ep 105 Budget Category Fix** - Locations with `totalFromMake` but no line items now propagate to all three maps.

19. **$921K Transaction Recovery** - Fixed service charge filter + txId hash collisions. Dashboard=$6,413,088.32.

### Recent Changes (2026-02-11)

18. **Transaction-Level Deduplication System** - Rewrote `mergeLedgers()` to deduplicate by `txId`.

16. **Drag-and-Drop Transaction Reassignment** - @dnd-kit/core drag-and-drop for moving budget line items.

17. **Deduplication Architecture Issue** - RESOLVED. Transaction-level dedup with automatic archival.

### Recent Changes (2026-02-08)

15. **Outline Button Style** - Replaced all solid-fill buttons with outline + semi-transparent fill.

11-14. Active Tab Highlighting, Over-Budget Count Fix, Topsheet Category Fix, Live Data Validation.

8-10. Category Order Matches Glide, Pre-computed Category Matching, Addl. Labor investigation.

1-7. Budget totalFromMake Fix, Live Glide Budget Fetch, Topsheet Math.abs Bug, Data Verification, Budget vs Actuals Fix, GL Categories Expanded, Unified Category Table.

### Previous Changes (2026-02-07)

1-10. GL-Based 10-Category System, Per-Row GL & Episode Extraction, Budget Parser, Multi-File Ledger Support, Location Recovery for Payroll, GL-Aware Production Overhead, Budget vs Actual Comparison, Episode Budget Distribution, Pending GL Codes, 31 Unmapped Locations.

### Previous Changes (2026-02-05)

1-5. Category Breakdown, GL Account Mapping, Deposit Detection, Financial Breakdown Cards, Episodes 101/102 Combined.

### Previous Changes (2026-02-04)

1-4. Cloud-Only Architecture, /data Endpoint, Expanded Location Mappings, Location Review UI.

## Archived Learnings (project-specific retained in CLAUDE.md)

The following learnings were removed as duplicates of global patterns:
- #26 (Lambda Function URLs base64-encode binary bodies) → global CLAUDE.md
- #14 (Amplify caches API responses) → general Amplify knowledge
