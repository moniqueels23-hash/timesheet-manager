const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { app } = require('electron');

class DatabaseManager {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'timesheet-data.db');
    this.db = null;
    this.initialize();
  }

  setDatabasePath(newPath) {
    if (this.db) {
      this.db.close();
    }
    this.dbPath = newPath;
    this.initialize();
  }

  initialize() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.createTables();
      this.createDefaultAdmin();
      console.log('Database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Admin', 'Normal')),
        canEdit INTEGER DEFAULT 0,
        canCreate INTEGER DEFAULT 0,
        canDelete INTEGER DEFAULT 0,
        canView INTEGER DEFAULT 1,
        canExport INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientId TEXT UNIQUE NOT NULL,
        clientName TEXT NOT NULL,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        hourlyRate REAL NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS EmployeeRateHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId TEXT NOT NULL,
        hourlyRate REAL NOT NULL,
        effectiveDate TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES Employees(employeeId)
      );

      CREATE TABLE IF NOT EXISTS Timesheets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        clientId TEXT NOT NULL,
        description TEXT NOT NULL,
        linkedId TEXT NOT NULL,
        timeSpent TEXT NOT NULL,
        chargeOut REAL NOT NULL,
        entryType TEXT NOT NULL CHECK(entryType IN ('Normal', 'Close-off', 'Transfer')),
        transferFromClientId TEXT,
        transferToClientId TEXT,
        importedDate TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES Clients(clientId)
      );

      CREATE TABLE IF NOT EXISTS AuditLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        tableName TEXT NOT NULL,
        recordId TEXT,
        oldValues TEXT,
        newValues TEXT,
        details TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_timesheets_date ON Timesheets(date);
      CREATE INDEX IF NOT EXISTS idx_timesheets_client ON Timesheets(clientId);
      CREATE INDEX IF NOT EXISTS idx_timesheets_linkedId ON Timesheets(linkedId);
      CREATE INDEX IF NOT EXISTS idx_timesheets_date_id ON Timesheets(date DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_employee_rates ON EmployeeRateHistory(employeeId, effectiveDate);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON AuditLog(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON AuditLog(username);
      CREATE INDEX IF NOT EXISTS idx_audit_table ON AuditLog(tableName);
    `);
  }

  createDefaultAdmin() {
    console.log('Checking for default admin user...');
    const existingAdmin = this.db.prepare('SELECT * FROM Users WHERE username = ?').get('admin');
    
    if (!existingAdmin) {
      console.log('Creating default admin user with username: admin, password: admin123');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.prepare(`
        INSERT INTO Users (username, password, role, canEdit, canCreate, canDelete, canView, canExport)
        VALUES (?, ?, 'Admin', 1, 1, 1, 1, 1)
      `).run('admin', hashedPassword);
      console.log('Default admin user created successfully!');
    } else {
      console.log('Default admin user already exists');
    }
    
    // Verify the admin user exists
    const adminUser = this.db.prepare('SELECT username, role FROM Users WHERE username = ?').get('admin');
    console.log('Admin user verification:', adminUser);
  }

  logAudit(username, action, tableName, recordId, oldValues = null, newValues = null, details = null) {
    try {
      this.db.prepare(`
        INSERT INTO AuditLog (username, action, tableName, recordId, oldValues, newValues, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        username,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        details
      );
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  getEmployeeRateOnDate(employeeId, date) {
    const rate = this.db.prepare(`
      SELECT hourlyRate FROM EmployeeRateHistory
      WHERE employeeId = ? AND effectiveDate <= ?
      ORDER BY effectiveDate DESC
      LIMIT 1
    `).get(employeeId, date);

    if (rate) return rate.hourlyRate;

    const employee = this.db.prepare('SELECT hourlyRate FROM Employees WHERE employeeId = ?').get(employeeId);
    return employee ? employee.hourlyRate : 0;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  getDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}

module.exports = DatabaseManager;
