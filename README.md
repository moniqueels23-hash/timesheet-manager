# Timesheet Manager

A professional Windows desktop application for accounting firm timesheet management built with Electron, React, and SQLite.

## Features

- **User Authentication** with role-based permissions (Admin/Normal users)
- **Client Management** with client IDs, names, and notes
- **Employee Management** with hourly rates and automatic rate history tracking
- **Timesheet Management** with three entry types:
  - Normal entries (black) - Automatic charge-out calculation
  - Close-off entries (red) - Manual negative amounts for billing adjustments
  - Transfer entries (green) - Move charges between clients
- **Automatic Charge-Out Calculation** using historical rates based on entry date
- **CSV/Excel Import** for bulk timesheet entries
- **Reports** with Excel and PDF export
- **Google Drive Sync** for multi-user access
- **Backup & Restore** functionality

## Tech Stack

- **Frontend**: React 18 with Tailwind CSS
- **Desktop Framework**: Electron
- **Database**: SQLite with better-sqlite3
- **Build Tool**: Vite
- **Export**: xlsx, jsPDF with autotable

## Development

### Prerequisites

- Node.js 20.x or higher
- npm

### Installation

```bash
npm install
```

### Running Development Server

```bash
npm run dev
```

This starts:
- Vite dev server on http://localhost:5173
- Electron app window

### Building for Production

```bash
npm run build
npm run build:electron
```

The distributable will be created in the `dist` folder.

## Project Structure

```
├── electron/           # Electron main process
│   ├── main.js        # Main entry point
│   ├── preload.js     # Preload script for IPC
│   ├── database.js    # Database manager
│   └── ipc-handlers.js # IPC handlers for all operations
├── src/               # React application
│   ├── components/    # React components
│   ├── contexts/      # React contexts (Auth)
│   ├── App.jsx        # Main app component
│   ├── main.jsx       # React entry point
│   └── index.css      # Tailwind CSS
├── package.json       # Dependencies and scripts
└── vite.config.js     # Vite configuration
```

## Database Schema

### Users
- username, password, role (Admin/Normal)
- Permissions: canEdit, canCreate, canDelete, canView, canExport

### Clients
- clientId, clientName, notes

### Employees
- employeeId, name, hourlyRate

### EmployeeRateHistory
- employeeId, hourlyRate, effectiveDate
- Automatically tracks rate changes

### Timesheets
- date, clientId, description, linkedId
- timeSpent, chargeOut, entryType
- transferFromClientId, transferToClientId
- Supports Normal, Close-off, and Transfer entry types

## Features Detail

### Entry Types

1. **Normal Entries** (Black)
   - Linked to employees
   - Auto-calculated charge-out: `rate × time`
   - Uses historical rate based on entry date
   - Charge-out rounded to nearest whole number

2. **Close-off Entries** (Red)
   - Manual negative amounts for billing/write-offs
   - Can be partial or full amounts
   - Multiple close-offs per client allowed

3. **Transfer Entries** (Green)
   - Move charge-out amounts between clients
   - Shows audit trail in reports
   - Displays source/destination client IDs

### Permissions

Admins can grant Normal users:
- View: See all data
- Create: Add new entries
- Edit: Modify existing entries
- Delete: Remove entries
- Export: Generate Excel/PDF reports

### Google Drive Sync

**Note**: This app uses **Google Drive Desktop** (the application that syncs local folders with Google Drive cloud), NOT the Google Drive API. This means:
- Users must have Google Drive Desktop installed on their Windows machines
- The app creates/accesses a local database file in a folder that Google Drive Desktop syncs
- Changes are synced through Google Drive Desktop's native sync mechanism
- The app monitors the local file for changes made by other users

**Setup Process**:
1. **Install Google Drive Desktop**: Each user must have Google Drive Desktop installed and configured
2. **Select Sync Folder**: First user selects a folder inside their Google Drive Desktop sync folder (e.g., `C:\Users\YourName\Google Drive\Timesheets`)
3. **Create Shared File**: App creates `timesheet-data.db` in that folder
4. **Google Drive Syncs**: Google Drive Desktop automatically syncs the file to the cloud
5. **Connect Other Users**: Other users navigate to the same folder in their Google Drive Desktop sync folder and select the existing file
6. **Auto-Reload**: App monitors the local file for changes and automatically reloads when updates are detected from other users

**Benefits**:
- No Google Drive API authentication required
- Uses Google's robust sync mechanism
- Works offline with sync-on-reconnect
- Simple folder-based sharing

### Reports

- **Single Client Report**: Filter by date range
- **All Clients Report**: Multi-page with each client on separate page
- **Export to Excel**: Color-coded rows, dd.mm.yyyy format
- **Export to PDF**: Client ID blocks, transfer audit trails

## Default Login

- **Username**: admin
- **Password**: admin123

Change this immediately after first login!

## Notes for GitHub Packaging

This project is structured for GitHub workflow packaging. The electron-builder configuration in package.json will create the Windows .exe installer.

### GitHub Actions Workflow Example

```yaml
name: Build Electron App

on: [push]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - run: npm run build:electron
      - uses: actions/upload-artifact@v3
        with:
          name: timesheet-manager-installer
          path: dist/*.exe
```

## License

Internal use for accounting firm.
