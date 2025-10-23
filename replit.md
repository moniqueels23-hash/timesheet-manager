# Timesheet Manager - Electron Desktop Application

## Overview

A Windows desktop application for accounting firm timesheet management. Built with Electron + React + SQLite. The app manages clients, employees, timesheets with automatic charge-out calculations, historical rate tracking, and Google Drive sync for multi-user access.

## Recent Changes (October 23, 2025)

- **PAGINATION FOR 500K+ TIMESHEETS**: Complete server-side pagination implementation for handling large datasets
  - **Backend Pagination**: Modified `timesheets:getAll` IPC handler with LIMIT/OFFSET support
  - **Server-Side Filtering**: Date range, client, and employee filters applied before pagination
  - **Default Date Range**: Automatically loads current month on startup to prevent loading all 500K entries
  - **Pagination UI**: Page size selector (50/100/250/500/1000), First/Previous/Next/Last buttons
  - **Performance**: Returns metadata (total count, page info) with each request
  - **Composite Index**: Added `idx_timesheets_date_id` (date DESC, id DESC) for optimized sorting
  - **Status Display**: Shows "Showing X of Y total entries" for user awareness
  - Page resets to 1 when filters or page size change

- **TIMESHEET IMPORT FIXES**: Fixed critical issues with CSV/Excel import functionality
  - **Decimal to Fraction Conversion**: Decimal time values (0.25, 0.5, 2.25, etc.) now automatically convert to fractions (¼, ½, 2¼) during import
  - **Fraction Preservation**: Pre-formatted fraction values (¼, ½, 3¾) are preserved as-is without corruption
  - **Extended parseFraction**: Now handles all mixed fractions from ¼ to 8 hours (previously only up to 1¾)
  - **Auto Charge-Out Calculation**: Normal entries without charge-out values now automatically calculate based on employee rate × time
  - **Validation**: Zero and invalid time entries are rejected with clear error messages instead of creating corrupt data
  - **Non-Standard Fractions**: Decimal values like 0.33 are preserved as decimal strings when they don't map to standard quarter-hour fractions
  - Both functions (`parseFraction` and `decimalToFraction`) work in harmony to ensure accurate billing calculations

- **COMPLETE PDF GENERATION REBUILD**: Completely rebuilt to match exact A4 portrait print specifications
  - **Page Setup**: 
    - A4 portrait (210mm × 297mm)
    - Left and right margins: 7mm each
    - Printable area: 196mm (7mm to 203mm)
    - Table width: 188mm (centered within printable area)
    - Table position: Starts at 11mm, ends at 199mm (perfectly centered)
  - **Header Blocks**:
    - Client name: Blue block (#2980BA), 8mm height, 10pt bold, white text, positioned at 7mm from left
    - Client ID: Blue block (#2980BA), 8mm height, 10mm fixed width, 10pt bold, white text, positioned at 193mm (ends 7mm from right edge)
    - Gap between header and table: 3mm
  - **Table Specifications**:
    - Width: 188mm (centered between 7mm margins)
    - Body font: 8pt Helvetica
    - Header font: 10pt bold Helvetica
    - Gridlines: 0.5px thin, blue #2980BA throughout
    - Header row: Blue background (#2980BA), white text
    - **Total row**: Light grey background (#f2f4f6), black bold text (NOT blue)
  - **Column Widths** (exact fixed sizes totaling 188mm):
    - DATE: 18mm (left-aligned)
    - DESCRIPTION: 120mm auto-fill (left-aligned, wraps)
    - ID: 15mm (center-aligned)
    - TIME: 15mm (center-aligned)
    - CHARGE OUT: 20mm (right-aligned)
  - **Currency Formatting**: "R " prefix with thousands separators (e.g., "R 22 400")
  - **Text Overflow**: Visible for all columns except Description (linebreak)
  - **Color Coding**: Close-off entries (red), Transfer entries (green), negative values (red bold)
- **Unified Color Theme**: All blue elements use consistent color #2980BA (RGB: 41, 128, 186)
  - PDF reports: headers, borders, gridlines, header blocks
  - UI components: buttons, table headers, tab indicators, links
  - Custom CSS classes: `.bg-app-blue`, `.text-app-blue`, `.border-app-blue`
- **Close-off Display**: ID column shows "C/O" instead of full text in all reports

## Previous Changes (October 22, 2025)

- Initial project setup with complete Electron + React architecture
- Implemented all core features:
  - User authentication with role-based permissions (Admin/Normal)
  - Clients, Employees, Timesheets management with CRUD operations
  - Three entry types: Normal (black), Close-off (red), Transfer (green)
  - Automatic charge-out calculation with historical rate lookup
  - Employee rate history tracking
  - **CSV/Excel import functionality for both Clients and Timesheets**
  - Reports with Excel and PDF export (updated with blue header boxes)
  - Google Drive Desktop sync setup
  - Backup and restore functionality
  - **Comprehensive audit trail tracking all database changes**
- Created comprehensive UI with 6 tabs: Clients, Employees, Timesheets, Reports, Audit Trail, User Management, Sync Setup
- Implemented IPC handlers for all database operations
- Added file watcher for Google Drive sync automation
- Color-coded timesheet entries per requirements
- PDF reports now display client name/ID in blue rounded boxes (upper corners)

## Project Architecture

### Technology Stack
- **Desktop Framework**: Electron 28
- **Frontend**: React 18 with Tailwind CSS
- **Database**: SQLite with better-sqlite3
- **Build Tool**: Vite
- **Exports**: xlsx (Excel), jsPDF with autotable (PDF)
- **File Sync**: chokidar for file watching
- **Config Storage**: electron-store

### Key Features
1. **User Permissions**: Granular control (Edit/Create/Delete/View/Export)
2. **Rate History**: Automatic tracking of employee rate changes with effective dates
3. **Charge-Out Calculation**: `hourlyRate × timeSpent` rounded to nearest whole number
4. **Historical Rates**: Uses rate effective on entry date, not current rate
5. **Entry Types**:
   - Normal: Auto-calculated based on employee rate
   - Close-off: Manual negative amounts for billing adjustments
   - Transfer: Move charges between clients with audit trail
6. **Date Format**: dd.mm.yyyy for all displays and exports
7. **Fractions**: Time in quarters (¼, ½, ¾, 1, etc.)
8. **Multi-User**: Google Drive Desktop sync with automatic reload on changes
9. **Audit Trail**: Complete tracking of all database changes with:
   - Automatic logging of CREATE, UPDATE, DELETE operations
   - Old/new value snapshots for all changes
   - Filtering by date range, user, action type, and table
   - Detailed view showing before/after states
   - Security: password hashes excluded from logs

### Database Schema
- Users: Authentication and permissions
- Clients: Client ID, name, notes
- Employees: Employee ID, name, current hourly rate
- EmployeeRateHistory: Historical rates with effective dates
- Timesheets: Main data with color-coded entry types
- AuditLog: Complete change history with old/new values, timestamps, user tracking

### File Structure
```
electron/           - Main process, database, IPC handlers
src/
  components/       - React components for each tab
  contexts/         - AuthContext for user state
  App.jsx          - Main application with tab navigation
  index.css        - Tailwind + custom color classes
package.json       - Dependencies and electron-builder config
vite.config.js     - Development server configuration
```

## User Preferences

- Default admin credentials: admin / admin123
- Date format preference: dd.mm.yyyy
- Currency display: R (South African Rand)
- Time increments: Fractions (¼, ½, ¾, etc.)

## Important Notes

### Replit Environment
- Electron cannot run in Replit's cloud environment (missing desktop libraries)
- Vite dev server runs successfully for frontend development
- Project is designed to be exported to GitHub for Windows .exe packaging

### GitHub Workflow
- User will export files to GitHub
- GitHub Actions workflow will package the Windows .exe installer
- electron-builder configuration is in package.json

### Sync Mechanism
- Uses Google Drive Desktop folder sync (not API)
- File watcher monitors database file changes
- Auto-reloads when other users make changes
- Prevents data loss through timestamp checking

### Calculation Rules
- Charge-out = Employee Rate × Time Spent (rounded to whole number)
- Historical rates used based on entry date
- Old entries unchanged when rates update
- Close-off amounts are manual (negative values)
- Transfer amounts are manual (move between clients)

## Development Workflow

1. Install dependencies: `npm install`
2. Run development: `npm run dev`
3. Build React app: `npm run build`
4. Package Electron app: `npm run build:electron`

## Default Data

- Default admin user created on first run
- No sample clients/employees (clean start)
- Database file: timesheet-data.db (or custom path via sync)

## Known Limitations

- Electron requires Windows desktop environment (cannot run in Replit)
- Concurrent edits to same record may conflict (last write wins)
- Google Drive sync requires Desktop app (not web interface)
- PDF color export may vary by PDF reader

## Future Enhancements (Not in MVP)

- Conflict resolution for concurrent Google Drive edits
- Batch employee rate updates
- Dashboard with analytics
- Email notifications for sync conflicts
- Audit log export to CSV/Excel
- User activity analytics dashboard
