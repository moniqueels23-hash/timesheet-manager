const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { format, parse } = require('date-fns');
const bcrypt = require('bcrypt');

let currentUser = null;

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  
  const permissionMap = {
    view: 'canView',
    edit: 'canEdit',
    create: 'canCreate',
    delete: 'canDelete',
    export: 'canExport'
  };
  
  return user[permissionMap[permission]] === 1;
}

function checkPermission(user, permission) {
  if (!user) {
    throw new Error('Not authenticated');
  }
  if (!hasPermission(user, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

module.exports = (ipcMain, dbManager, store, dialog, setupFileWatcher) => {
  const db = () => {
    if (!dbManager) {
      throw new Error('Database manager not initialized');
    }
    return dbManager.getDatabase();
  };

  ipcMain.handle('auth:login', async (event, username, password) => {
    try {
      console.log('Login attempt for user:', username);
      const database = db();
      console.log('Database retrieved successfully');
      
      const user = database.prepare('SELECT * FROM Users WHERE username = ?').get(username);
      console.log('User query executed, found:', user ? 'yes' : 'no');
      
      if (user && await bcrypt.compare(password, user.password)) {
        currentUser = user;
        console.log('Login successful for:', username);
        return { success: true, user: { ...user, password: undefined } };
      }
      
      console.log('Login failed: invalid credentials');
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:getCurrentUser', async () => {
    if (currentUser) {
      return { ...currentUser, password: undefined };
    }
    return null;
  });

  ipcMain.handle('users:getAll', async () => {
    try {
      if (!currentUser || currentUser.role !== 'Admin') {
        throw new Error('Only admins can view user management');
      }
      const users = db().prepare('SELECT * FROM Users').all();
      return users.map(u => ({ ...u, password: undefined }));
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('users:create', async (event, user) => {
    try {
      if (!currentUser || currentUser.role !== 'Admin') {
        return { success: false, error: 'Only admins can create users' };
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      const result = db().prepare(`
        INSERT INTO Users (username, password, role, canEdit, canCreate, canDelete, canView, canExport)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.username,
        hashedPassword,
        user.role,
        user.canEdit ? 1 : 0,
        user.canCreate ? 1 : 0,
        user.canDelete ? 1 : 0,
        user.canView ? 1 : 0,
        user.canExport ? 1 : 0
      );
      
      dbManager.logAudit(
        currentUser.username,
        'CREATE',
        'Users',
        result.lastInsertRowid.toString(),
        null,
        { username: user.username, role: user.role, canEdit: user.canEdit, canCreate: user.canCreate, canDelete: user.canDelete, canView: user.canView, canExport: user.canExport },
        `Created user: ${user.username} with role ${user.role}`
      );
      
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:update', async (event, id, user) => {
    try {
      if (!currentUser || currentUser.role !== 'Admin') {
        return { success: false, error: 'Only admins can update users' };
      }

      const oldUser = db().prepare('SELECT * FROM Users WHERE id = ?').get(id);

      if (user.password) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        db().prepare(`
          UPDATE Users 
          SET username = ?, password = ?, role = ?, canEdit = ?, canCreate = ?, canDelete = ?, canView = ?, canExport = ?
          WHERE id = ?
        `).run(
          user.username,
          hashedPassword,
          user.role,
          user.canEdit ? 1 : 0,
          user.canCreate ? 1 : 0,
          user.canDelete ? 1 : 0,
          user.canView ? 1 : 0,
          user.canExport ? 1 : 0,
          id
        );
      } else {
        db().prepare(`
          UPDATE Users 
          SET username = ?, role = ?, canEdit = ?, canCreate = ?, canDelete = ?, canView = ?, canExport = ?
          WHERE id = ?
        `).run(
          user.username,
          user.role,
          user.canEdit ? 1 : 0,
          user.canCreate ? 1 : 0,
          user.canDelete ? 1 : 0,
          user.canView ? 1 : 0,
          user.canExport ? 1 : 0,
          id
        );
      }
      
      dbManager.logAudit(
        currentUser.username,
        'UPDATE',
        'Users',
        id.toString(),
        { username: oldUser.username, role: oldUser.role, canEdit: oldUser.canEdit, canCreate: oldUser.canCreate, canDelete: oldUser.canDelete, canView: oldUser.canView, canExport: oldUser.canExport },
        { username: user.username, role: user.role, canEdit: user.canEdit, canCreate: user.canCreate, canDelete: user.canDelete, canView: user.canView, canExport: user.canExport },
        `Updated user: ${user.username}${user.password ? ' (password changed)' : ''}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:delete', async (event, id) => {
    try {
      if (!currentUser || currentUser.role !== 'Admin') {
        return { success: false, error: 'Only admins can delete users' };
      }
      
      const user = db().prepare('SELECT * FROM Users WHERE id = ?').get(id);
      
      db().prepare('DELETE FROM Users WHERE id = ?').run(id);
      
      dbManager.logAudit(
        currentUser.username,
        'DELETE',
        'Users',
        id.toString(),
        { username: user.username, role: user.role },
        null,
        `Deleted user: ${user.username}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:getAll', async () => {
    try {
      checkPermission(currentUser, 'view');
      return db().prepare('SELECT * FROM Clients ORDER BY clientName').all();
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('clients:create', async (event, client) => {
    try {
      checkPermission(currentUser, 'create');
      const result = db().prepare(`
        INSERT INTO Clients (clientId, clientName, notes)
        VALUES (?, ?, ?)
      `).run(client.clientId, client.clientName, client.notes || '');
      
      dbManager.logAudit(
        currentUser.username,
        'CREATE',
        'Clients',
        result.lastInsertRowid.toString(),
        null,
        { clientId: client.clientId, clientName: client.clientName, notes: client.notes },
        `Created client: ${client.clientName}`
      );
      
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:update', async (event, id, client) => {
    try {
      checkPermission(currentUser, 'edit');
      
      const oldClient = db().prepare('SELECT * FROM Clients WHERE id = ?').get(id);
      
      db().prepare(`
        UPDATE Clients 
        SET clientId = ?, clientName = ?, notes = ?
        WHERE id = ?
      `).run(client.clientId, client.clientName, client.notes || '', id);
      
      dbManager.logAudit(
        currentUser.username,
        'UPDATE',
        'Clients',
        id.toString(),
        { clientId: oldClient.clientId, clientName: oldClient.clientName, notes: oldClient.notes },
        { clientId: client.clientId, clientName: client.clientName, notes: client.notes },
        `Updated client: ${client.clientName}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:delete', async (event, id) => {
    try {
      checkPermission(currentUser, 'delete');
      
      const client = db().prepare('SELECT * FROM Clients WHERE id = ?').get(id);
      
      db().prepare('DELETE FROM Clients WHERE id = ?').run(id);
      
      dbManager.logAudit(
        currentUser.username,
        'DELETE',
        'Clients',
        id.toString(),
        { clientId: client.clientId, clientName: client.clientName },
        null,
        `Deleted client: ${client.clientName}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:import', async (event, data) => {
    try {
      checkPermission(currentUser, 'create');
      const results = {
        success: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Check if client ID already exists
          const existing = db().prepare('SELECT * FROM Clients WHERE clientId = ?').get(row.clientId);
          
          if (existing) {
            results.errors.push(`Row ${i + 1}: Client ID ${row.clientId} already exists`);
            continue;
          }

          if (!row.clientId || !row.clientName) {
            results.errors.push(`Row ${i + 1}: Missing required fields (Client ID or Client Name)`);
            continue;
          }

          const result = db().prepare(`
            INSERT INTO Clients (clientId, clientName, notes)
            VALUES (?, ?, ?)
          `).run(row.clientId, row.clientName, row.notes || '');

          dbManager.logAudit(
            currentUser.username,
            'CREATE',
            'Clients',
            result.lastInsertRowid.toString(),
            null,
            { clientId: row.clientId, clientName: row.clientName, notes: row.notes },
            `Imported client: ${row.clientName}`
          );

          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      return { success: 0, errors: [error.message] };
    }
  });

  ipcMain.handle('employees:getAll', async () => {
    try {
      checkPermission(currentUser, 'view');
      return db().prepare('SELECT * FROM Employees ORDER BY name').all();
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('employees:create', async (event, employee) => {
    try {
      checkPermission(currentUser, 'create');
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      
      const result = db().prepare(`
        INSERT INTO Employees (employeeId, name, hourlyRate)
        VALUES (?, ?, ?)
      `).run(employee.employeeId, employee.name, employee.hourlyRate);

      db().prepare(`
        INSERT INTO EmployeeRateHistory (employeeId, hourlyRate, effectiveDate)
        VALUES (?, ?, ?)
      `).run(employee.employeeId, employee.hourlyRate, currentDate);

      dbManager.logAudit(
        currentUser.username,
        'CREATE',
        'Employees',
        result.lastInsertRowid.toString(),
        null,
        { employeeId: employee.employeeId, name: employee.name, hourlyRate: employee.hourlyRate },
        `Created employee: ${employee.name} with rate R${employee.hourlyRate}`
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('employees:update', async (event, id, employee) => {
    try {
      checkPermission(currentUser, 'edit');
      const existing = db().prepare('SELECT * FROM Employees WHERE id = ?').get(id);
      const currentDate = format(new Date(), 'yyyy-MM-dd');

      db().prepare(`
        UPDATE Employees 
        SET employeeId = ?, name = ?, hourlyRate = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(employee.employeeId, employee.name, employee.hourlyRate, id);

      // Log all field changes
      dbManager.logAudit(
        currentUser.username,
        'UPDATE',
        'Employees',
        id.toString(),
        { employeeId: existing.employeeId, name: existing.name, hourlyRate: existing.hourlyRate },
        { employeeId: employee.employeeId, name: employee.name, hourlyRate: employee.hourlyRate },
        `Updated employee: ${employee.name}${existing.hourlyRate !== employee.hourlyRate ? ` (rate changed from R${existing.hourlyRate} to R${employee.hourlyRate})` : ''}`
      );

      // Additionally track rate change in history
      if (existing && existing.hourlyRate !== employee.hourlyRate) {
        db().prepare(`
          INSERT INTO EmployeeRateHistory (employeeId, hourlyRate, effectiveDate)
          VALUES (?, ?, ?)
        `).run(employee.employeeId, employee.hourlyRate, currentDate);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('employees:delete', async (event, id) => {
    try {
      checkPermission(currentUser, 'delete');
      
      const employee = db().prepare('SELECT * FROM Employees WHERE id = ?').get(id);
      
      db().prepare('DELETE FROM Employees WHERE id = ?').run(id);
      
      dbManager.logAudit(
        currentUser.username,
        'DELETE',
        'Employees',
        id.toString(),
        { employeeId: employee.employeeId, name: employee.name, hourlyRate: employee.hourlyRate },
        null,
        `Deleted employee: ${employee.name}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('employees:getRateHistory', async (event, employeeId) => {
    try {
      checkPermission(currentUser, 'view');
      return db().prepare(`
        SELECT * FROM EmployeeRateHistory 
        WHERE employeeId = ? 
        ORDER BY effectiveDate DESC
      `).all(employeeId);
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('timesheets:getAll', async (event, options = {}) => {
    try {
      checkPermission(currentUser, 'view');
      
      const { page = 1, pageSize = 100, startDate = null, endDate = null, clientId = null, linkedId = null } = options;
      const offset = (page - 1) * pageSize;
      
      // Build query with filters
      let query = 'SELECT * FROM Timesheets WHERE 1=1';
      const params = [];
      
      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
      }
      
      if (clientId) {
        query += ' AND clientId = ?';
        params.push(clientId);
      }
      
      if (linkedId) {
        query += ' AND linkedId = ?';
        params.push(linkedId);
      }
      
      query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
      
      const timesheets = db().prepare(query).all(...params);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM Timesheets WHERE 1=1';
      const countParams = [];
      
      if (startDate) {
        countQuery += ' AND date >= ?';
        countParams.push(startDate);
      }
      
      if (endDate) {
        countQuery += ' AND date <= ?';
        countParams.push(endDate);
      }
      
      if (clientId) {
        countQuery += ' AND clientId = ?';
        countParams.push(clientId);
      }
      
      if (linkedId) {
        countQuery += ' AND linkedId = ?';
        countParams.push(linkedId);
      }
      
      const { total } = db().prepare(countQuery).get(...countParams);
      
      return {
        timesheets,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('timesheets:create', async (event, timesheet) => {
    try {
      checkPermission(currentUser, 'create');
      let chargeOut = timesheet.chargeOut;

      if (timesheet.entryType === 'Normal' && !timesheet.chargeOut) {
        const rate = dbManager.getEmployeeRateOnDate(timesheet.linkedId, timesheet.date);
        const timeFraction = parseFraction(timesheet.timeSpent);
        chargeOut = Math.round(rate * timeFraction);
      }

      const result = db().prepare(`
        INSERT INTO Timesheets (date, clientId, description, linkedId, timeSpent, chargeOut, entryType, transferFromClientId, transferToClientId, importedDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        timesheet.date,
        timesheet.clientId,
        timesheet.description,
        timesheet.linkedId,
        timesheet.timeSpent,
        chargeOut,
        timesheet.entryType,
        timesheet.transferFromClientId || null,
        timesheet.transferToClientId || null,
        timesheet.importedDate || null
      );

      dbManager.logAudit(
        currentUser.username,
        'CREATE',
        'Timesheets',
        result.lastInsertRowid.toString(),
        null,
        { date: timesheet.date, clientId: timesheet.clientId, description: timesheet.description, linkedId: timesheet.linkedId, timeSpent: timesheet.timeSpent, chargeOut, entryType: timesheet.entryType },
        `Created ${timesheet.entryType} timesheet for ${timesheet.clientId}`
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('timesheets:update', async (event, id, timesheet) => {
    try {
      checkPermission(currentUser, 'edit');
      
      const oldTimesheet = db().prepare('SELECT * FROM Timesheets WHERE id = ?').get(id);
      
      db().prepare(`
        UPDATE Timesheets 
        SET date = ?, clientId = ?, description = ?, linkedId = ?, timeSpent = ?, chargeOut = ?, entryType = ?, transferFromClientId = ?, transferToClientId = ?
        WHERE id = ?
      `).run(
        timesheet.date,
        timesheet.clientId,
        timesheet.description,
        timesheet.linkedId,
        timesheet.timeSpent,
        timesheet.chargeOut,
        timesheet.entryType,
        timesheet.transferFromClientId || null,
        timesheet.transferToClientId || null,
        id
      );
      
      dbManager.logAudit(
        currentUser.username,
        'UPDATE',
        'Timesheets',
        id.toString(),
        { date: oldTimesheet.date, clientId: oldTimesheet.clientId, description: oldTimesheet.description, linkedId: oldTimesheet.linkedId, timeSpent: oldTimesheet.timeSpent, chargeOut: oldTimesheet.chargeOut, entryType: oldTimesheet.entryType },
        { date: timesheet.date, clientId: timesheet.clientId, description: timesheet.description, linkedId: timesheet.linkedId, timeSpent: timesheet.timeSpent, chargeOut: timesheet.chargeOut, entryType: timesheet.entryType },
        `Updated timesheet for ${timesheet.clientId}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('timesheets:delete', async (event, id) => {
    try {
      checkPermission(currentUser, 'delete');
      
      const timesheet = db().prepare('SELECT * FROM Timesheets WHERE id = ?').get(id);
      
      db().prepare('DELETE FROM Timesheets WHERE id = ?').run(id);
      
      dbManager.logAudit(
        currentUser.username,
        'DELETE',
        'Timesheets',
        id.toString(),
        { date: timesheet.date, clientId: timesheet.clientId, description: timesheet.description, linkedId: timesheet.linkedId, timeSpent: timesheet.timeSpent, chargeOut: timesheet.chargeOut, entryType: timesheet.entryType },
        null,
        `Deleted timesheet for ${timesheet.clientId}`
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('timesheets:import', async (event, data) => {
    try {
      checkPermission(currentUser, 'create');
      const results = {
        success: 0,
        errors: []
      };

      const importDate = format(new Date(), 'yyyy-MM-dd');

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          const client = db().prepare('SELECT clientId FROM Clients WHERE clientName = ? OR clientId = ?').get(row.clientName, row.clientName);
          
          if (!client) {
            results.errors.push(`Row ${i + 1}: Client not found - ${row.clientName}`);
            continue;
          }

          // Convert decimal time to fraction format (e.g., 0.25 → ¼, 0.5 → ½)
          const timeSpent = decimalToFraction(row.timeSpent);
          
          // Skip entries with zero or invalid time
          if (timeSpent === '0' || !timeSpent) {
            results.errors.push(`Row ${i + 1}: Invalid or zero time value`);
            continue;
          }
          
          let chargeOut = row.chargeOut;
          const entryType = row.entryType || 'Normal';

          // Auto-calculate charge-out for Normal entries when not provided
          if (entryType === 'Normal' && !chargeOut) {
            const employeeId = row.employeeId || row.linkedId;
            if (!employeeId) {
              results.errors.push(`Row ${i + 1}: Missing employee ID for charge-out calculation`);
              continue;
            }
            
            const rate = dbManager.getEmployeeRateOnDate(employeeId, row.date);
            if (!rate) {
              results.errors.push(`Row ${i + 1}: No rate found for employee ${employeeId} on ${row.date}`);
              continue;
            }
            
            const timeFraction = parseFraction(timeSpent);
            chargeOut = Math.round(rate * timeFraction);
          } else if (entryType === 'Close-off' && chargeOut) {
            // Ensure close-off amounts are negative
            chargeOut = -Math.abs(parseFloat(chargeOut));
          } else if (entryType === 'Normal' && chargeOut) {
            // If charge-out is provided for Normal entry, use it
            chargeOut = parseFloat(chargeOut);
          }

          db().prepare(`
            INSERT INTO Timesheets (date, clientId, description, linkedId, timeSpent, chargeOut, entryType, transferFromClientId, transferToClientId, importedDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            row.date,
            client.clientId,
            row.description,
            row.employeeId || row.linkedId,
            timeSpent,  // Now stores as fraction (¼, ½, etc.) instead of decimal
            chargeOut,
            entryType,
            row.transferFromClientId || null,
            row.transferToClientId || null,
            importDate
          );

          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      return { success: 0, errors: [error.message] };
    }
  });

  ipcMain.handle('timesheets:getByClient', async (event, clientId, startDate, endDate) => {
    try {
      checkPermission(currentUser, 'view');
      let query = 'SELECT * FROM Timesheets WHERE clientId = ?';
      const params = [clientId];

      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY date, id';

      return db().prepare(query).all(...params);
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('reports:generateByClient', async (event, clientId, startDate, endDate) => {
    try {
      checkPermission(currentUser, 'view');
      const client = db().prepare('SELECT * FROM Clients WHERE clientId = ?').get(clientId);
      
      return {
        client,
        timesheets: db().prepare(`
          SELECT * FROM Timesheets 
          WHERE clientId = ? AND date >= ? AND date <= ?
          ORDER BY date, id
        `).all(clientId, startDate || '1900-01-01', endDate || '2100-12-31')
      };
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('reports:generateAll', async (event, startDate, endDate) => {
    try {
      checkPermission(currentUser, 'view');
      const clients = db().prepare('SELECT * FROM Clients ORDER BY clientName').all();
      const allData = [];

      for (const client of clients) {
        const timesheets = db().prepare(`
          SELECT * FROM Timesheets 
          WHERE clientId = ? AND date >= ? AND date <= ?
          ORDER BY date, id
        `).all(client.clientId, startDate || '1900-01-01', endDate || '2100-12-31');

        if (timesheets.length > 0) {
          allData.push({ client, timesheets });
        }
      }

      return allData;
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('reports:exportToExcel', async (event, reportData, filename) => {
    try {
      checkPermission(currentUser, 'export');
      const result = await dialog.showSaveDialog({
        title: 'Export to Excel',
        defaultPath: filename || 'timesheet-report.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });

      if (result.canceled) return { success: false };

      const workbook = XLSX.utils.book_new();

      reportData.forEach(({ client, timesheets }) => {
        const sheetData = [
          [client.clientName, '', '', '', '', client.clientId],
          [],
          ['DATE', 'DESCRIPTION', 'ID', 'TIME', 'CHARGE OUT']
        ];

        let totalChargeOut = 0;

        timesheets.forEach(ts => {
          const displayId = ts.entryType === 'Close-off'
            ? 'C/O'
            : ts.entryType === 'Transfer' 
              ? (ts.transferToClientId || ts.transferFromClientId || ts.linkedId)
              : ts.linkedId;

          sheetData.push([
            formatDateDisplay(ts.date),
            ts.description,
            displayId,
            ts.timeSpent,
            ts.chargeOut
          ]);

          totalChargeOut += ts.chargeOut;
        });

        sheetData.push([]);
        sheetData.push(['', '', '', 'TOTAL:', totalChargeOut]);

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Auto-fit column widths based on content
        const colWidths = [
          { wch: 12 }, // DATE - minimum for dd.mm.yyyy
          { wch: 10 }, // DESCRIPTION - will auto-expand
          { wch: 8 },  // ID - minimum for C/O or employee IDs
          { wch: 6 },  // TIME - minimum for fractions
          { wch: 12 }  // CHARGE OUT - minimum for numbers
        ];
        
        // Calculate maximum width needed for each column
        sheetData.forEach(row => {
          row.forEach((cell, colIdx) => {
            if (cell && cell.toString) {
              const cellLength = cell.toString().length;
              if (cellLength > colWidths[colIdx].wch) {
                colWidths[colIdx].wch = cellLength;
              }
            }
          });
        });
        
        worksheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, worksheet, client.clientId.substring(0, 31));
      });

      XLSX.writeFile(workbook, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:exportToPDF', async (event, reportData, filename) => {
    try {
      checkPermission(currentUser, 'export');
      const result = await dialog.showSaveDialog({
        title: 'Export to PDF',
        defaultPath: filename || 'timesheet-report.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (result.canceled) return { success: false };

      const doc = new jsPDF();
      let isFirstPage = true;

      reportData.forEach(({ client, timesheets }) => {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // PAGE LAYOUT CONSTANTS - A4 Portrait with exact specifications
        const pageWidth = 210; // A4 width in mm
        const leftMargin = 7; // 7mm from left edge
        const rightMargin = 7; // 7mm from right edge
        const tableWidth = 188; // Exact table width as per specification
        const printableWidth = pageWidth - leftMargin - rightMargin; // 196mm printable area
        const tableStartX = leftMargin + ((printableWidth - tableWidth) / 2); // Center table: 7 + 4 = 11mm
        
        // HEADER SECTION - Client name and ID blocks
        const headerY = 10; // Start position from top
        const headerHeight = 8; // 8mm block height
        const headerPaddingH = 2; // Horizontal padding inside blocks
        
        // Company name block (blue background with white text) - LEFT SIDE at 7mm margin
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10); // 10pt font
        const nameText = client.clientName;
        const nameWidth = doc.getTextWidth(nameText);
        const nameBlockWidth = nameWidth + (headerPaddingH * 2);
        
        // Draw rounded blue block for company name
        doc.setFillColor(41, 128, 186); // #2980BA
        doc.roundedRect(leftMargin, headerY, nameBlockWidth, headerHeight, 1.2, 1.2, 'F');
        
        // Company name text (white, 10pt bold) - centered vertically in block
        doc.setTextColor(255, 255, 255);
        doc.text(nameText, leftMargin + headerPaddingH, headerY + (headerHeight / 2), { baseline: 'middle' });
        
        // Client ID block (blue background) - RIGHT SIDE, 10mm width, ends 7mm from edge
        const idBlockWidth = 10; // Fixed 10mm width
        const idBlockX = pageWidth - rightMargin - idBlockWidth; // 210 - 7 - 10 = 193mm
        
        // Draw rounded blue block for client ID
        doc.setFillColor(41, 128, 186); // #2980BA
        doc.roundedRect(idBlockX, headerY, idBlockWidth, headerHeight, 1.2, 1.2, 'F');
        
        // Client ID text (white, 10pt bold) - centered in block
        const idText = client.clientId;
        doc.setTextColor(255, 255, 255);
        doc.text(idText, idBlockX + (idBlockWidth / 2), headerY + (headerHeight / 2), { 
          baseline: 'middle', 
          align: 'center' 
        });
        
        // Reset for table
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        const tableData = timesheets.map(ts => {
          const displayId = ts.entryType === 'Close-off'
            ? 'C/O'
            : ts.entryType === 'Transfer' 
              ? (ts.transferToClientId || ts.transferFromClientId || ts.linkedId)
              : ts.linkedId;

          return [
            formatDateDisplay(ts.date),
            ts.description,
            displayId,
            ts.timeSpent,
            'R ' + ts.chargeOut.toLocaleString('en-ZA') // Format with "R " prefix and thousands separators
          ];
        });

        // Calculate total for footer
        const totalChargeOut = timesheets.reduce((sum, ts) => sum + ts.chargeOut, 0);
        const formattedTotal = 'R ' + totalChargeOut.toLocaleString('en-ZA');

        // Column widths: Date 18mm, Description auto-fill, ID 15mm, Time 15mm, Charge Out 20mm
        const colWidthDate = 18;
        const colWidthId = 15;
        const colWidthTime = 15;
        const colWidthChargeOut = 20;
        const colWidthDescription = tableWidth - colWidthDate - colWidthId - colWidthTime - colWidthChargeOut; // Auto-fill remaining width (120mm)

        doc.autoTable({
          startY: headerY + headerHeight + 3, // 2-3mm gap after header (10 + 8 + 3 = 21mm)
          head: [['DATE', 'DESCRIPTION', 'ID', 'TIME', 'CHARGE OUT']],
          body: tableData,
          foot: [[
            { content: '', colSpan: 3 },  // Span first 3 columns (Date, Description, ID)
            { content: 'TOTAL:', styles: { halign: 'right', fontStyle: 'bold' } },  // Time column
            { content: formattedTotal, styles: { halign: 'right', fontStyle: 'bold' } }  // Charge Out column
          ]],
          theme: 'grid',
          tableWidth: tableWidth, // 188mm exact
          margin: { left: tableStartX }, // Start at 11mm (centered)
          styles: {
            font: 'helvetica',
            fontSize: 8, // 8pt body text
            cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
            lineColor: [41, 128, 186], // #2980BA - blue gridlines
            lineWidth: 0.15, // 0.5px borders
            minCellHeight: 6,
            overflow: 'visible',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [41, 128, 186], // #2980BA header background
            textColor: [255, 255, 255], // White text
            fontStyle: 'bold',
            fontSize: 8, // 8pt bold header
            cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
            lineColor: [41, 128, 186],
            lineWidth: 0.15
          },
          footStyles: {
            fillColor: [242, 244, 246], // Light grey #f2f4f6 (not blue!)
            textColor: [0, 0, 0], // Black text
            fontStyle: 'bold',
            halign: 'right',
            fontSize: 8,
            cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
            lineColor: [41, 128, 186],
            lineWidth: 0.15
          },
          columnStyles: {
            0: { cellWidth: colWidthDate, halign: 'left', overflow: 'visible' },  // DATE - 18mm, left-aligned
            1: { cellWidth: colWidthDescription, halign: 'left', overflow: 'linebreak' }, // DESCRIPTION - 120mm auto-fill, wraps
            2: { cellWidth: colWidthId, halign: 'center', overflow: 'visible' },  // ID - 15mm, centered
            3: { cellWidth: colWidthTime, halign: 'center', overflow: 'visible' },  // TIME - 15mm, centered
            4: { cellWidth: colWidthChargeOut, halign: 'right', overflow: 'visible' }   // CHARGE OUT - 20mm, right-aligned
          },
          didParseCell: function(data) {
            if (data.section === 'body') {
              const ts = timesheets[data.row.index];
              
              // Color-code entire row by entry type
              if (ts.entryType === 'Close-off') {
                data.cell.styles.textColor = [255, 0, 0]; // Red for close-off entries
              } else if (ts.entryType === 'Transfer') {
                data.cell.styles.textColor = [0, 128, 0]; // Green for transfer entries
              }
              
              // Make negative charge-out values red and bold
              if (data.column.index === 4) {
                const chargeOutText = data.cell.text[0];
                if (chargeOutText && chargeOutText.includes('-')) {
                  data.cell.styles.textColor = [255, 0, 0]; // Red
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          }
        });
      });

      doc.save(result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audit:getLogs', async (event, filters = {}) => {
    try {
      checkPermission(currentUser, 'view');
      
      let query = 'SELECT * FROM AuditLog WHERE 1=1';
      const params = [];
      
      if (filters.startDate) {
        query += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }
      
      if (filters.endDate) {
        query += ' AND timestamp <= ?';
        params.push(filters.endDate + ' 23:59:59');
      }
      
      if (filters.username) {
        query += ' AND username = ?';
        params.push(filters.username);
      }
      
      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }
      
      if (filters.tableName) {
        query += ' AND tableName = ?';
        params.push(filters.tableName);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT 1000';
      
      return db().prepare(query).all(...params);
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('sync:selectFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Google Drive Sync Folder'
      });

      if (result.canceled) return { success: false };

      const folderPath = result.filePaths[0];
      const dbPath = path.join(folderPath, 'timesheet-data.db');

      if (!fs.existsSync(dbPath)) {
        dbManager.close();
        fs.copyFileSync(dbManager.dbPath, dbPath);
      }

      store.set('syncDatabasePath', dbPath);
      dbManager.setDatabasePath(dbPath);
      setupFileWatcher(dbPath);
      store.set('lastSync', new Date().toISOString());

      return { success: true, path: dbPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync:selectFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Database', extensions: ['db'] }],
        title: 'Select Existing Shared Data File'
      });

      if (result.canceled) return { success: false };

      const dbPath = result.filePaths[0];
      
      store.set('syncDatabasePath', dbPath);
      dbManager.setDatabasePath(dbPath);
      setupFileWatcher(dbPath);
      store.set('lastSync', new Date().toISOString());

      return { success: true, path: dbPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync:getSyncPath', async () => {
    return store.get('syncDatabasePath') || null;
  });

  ipcMain.handle('sync:getLastSync', async () => {
    return store.get('lastSync') || null;
  });

  ipcMain.handle('sync:syncNow', async () => {
    try {
      dbManager.close();
      dbManager.initialize();
      store.set('lastSync', new Date().toISOString());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:export', async () => {
    try {
      checkPermission(currentUser, 'export');
      const result = await dialog.showSaveDialog({
        title: 'Export Backup',
        defaultPath: `timesheet-backup-${format(new Date(), 'yyyy-MM-dd')}.db`,
        filters: [{ name: 'Database Backup', extensions: ['db'] }]
      });

      if (result.canceled) return { success: false };

      fs.copyFileSync(dbManager.dbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:import', async () => {
    try {
      if (!currentUser || currentUser.role !== 'Admin') {
        return { success: false, error: 'Only admins can import backups' };
      }

      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Database Backup', extensions: ['db'] }],
        title: 'Import Backup'
      });

      if (result.canceled) return { success: false };

      dbManager.close();
      fs.copyFileSync(result.filePaths[0], dbManager.dbPath);
      dbManager.initialize();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};

function parseFraction(timeStr) {
  if (!timeStr) return 0;
  
  const str = timeStr.toString().trim();
  
  // Handle slash fractions (e.g., "1/4")
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  
  // Complete fraction map covering all valid timesheet values (up to 8 hours)
  const fractionMap = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '1': 1, '1¼': 1.25, '1½': 1.5, '1¾': 1.75,
    '2': 2, '2¼': 2.25, '2½': 2.5, '2¾': 2.75,
    '3': 3, '3¼': 3.25, '3½': 3.5, '3¾': 3.75,
    '4': 4, '4¼': 4.25, '4½': 4.5, '4¾': 4.75,
    '5': 5, '5¼': 5.25, '5½': 5.5, '5¾': 5.75,
    '6': 6, '6¼': 6.25, '6½': 6.5, '6¾': 6.75,
    '7': 7, '7¼': 7.25, '7½': 7.5, '7¾': 7.75,
    '8': 8
  };
  
  // Return mapped value or parse as decimal
  return fractionMap[str] || parseFloat(str) || 0;
}

function decimalToFraction(timeValue) {
  if (!timeValue && timeValue !== 0) return '0';
  
  const str = timeValue.toString().trim();
  
  // If already a valid fraction format, return as-is
  const validFractions = ['¼', '½', '¾', '1', '1¼', '1½', '1¾', '2', '2¼', '2½', '2¾', '3', '3¼', '3½', '3¾', '4', '4¼', '4½', '4¾', '5', '5¼', '5½', '5¾', '6', '6¼', '6½', '6¾', '7', '7¼', '7½', '7¾', '8'];
  if (validFractions.includes(str)) {
    return str;
  }
  
  // Parse as decimal number
  const num = parseFloat(str);
  
  // Handle invalid, zero, or negative inputs
  if (isNaN(num)) return '0';
  if (num <= 0) return '0';
  
  // Split into whole and fractional parts
  const whole = Math.floor(num);
  const fractionalPart = num - whole;
  
  // Convert fractional part to fraction string
  let fractionStr = '';
  if (Math.abs(fractionalPart - 0.25) < 0.01) {
    fractionStr = '¼';
  } else if (Math.abs(fractionalPart - 0.5) < 0.01) {
    fractionStr = '½';
  } else if (Math.abs(fractionalPart - 0.75) < 0.01) {
    fractionStr = '¾';
  } else if (fractionalPart < 0.01) {
    fractionStr = '';  // No fraction, whole number only
  } else {
    // Non-standard fraction, keep as decimal
    return num.toString();
  }
  
  // Combine whole and fractional parts
  if (whole === 0 && fractionStr) {
    return fractionStr;  // Just the fraction (e.g., "¼")
  } else if (whole > 0 && !fractionStr) {
    return whole.toString();  // Just the whole number (e.g., "2")
  } else if (whole > 0 && fractionStr) {
    return `${whole}${fractionStr}`;  // Mixed fraction (e.g., "1¼")
  } else {
    return '0';  // Fallback for edge cases
  }
}

function formatDateDisplay(dateStr) {
  try {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    return format(date, 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
}
