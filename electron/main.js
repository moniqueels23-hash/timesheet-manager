const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const chokidar = require('chokidar');
const fs = require('fs');
const DatabaseManager = require('./database');

const store = new Store();
let mainWindow;
let dbManager;
let fileWatcher;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.openDevTools();
  }
}

function initializeDatabase() {
  try {
    const syncPath = store.get('syncDatabasePath');
    console.log('Initializing database with sync path:', syncPath);
    dbManager = new DatabaseManager(syncPath);
    console.log('Database manager created successfully');
    setupFileWatcher(syncPath);
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

function setupFileWatcher(filePath) {
  if (fileWatcher) {
    fileWatcher.close();
  }

  if (filePath && fs.existsSync(filePath)) {
    let lastModified = fs.statSync(filePath).mtime.getTime();

    fileWatcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true
    });

    fileWatcher.on('change', () => {
      const currentModified = fs.statSync(filePath).mtime.getTime();
      
      if (currentModified > lastModified) {
        lastModified = currentModified;
        
        if (dbManager) {
          dbManager.close();
          dbManager.initialize();
          mainWindow.webContents.send('database-updated');
        }
      }
    });
  }
}

app.whenReady().then(() => {
  console.log('App ready, starting initialization...');
  
  try {
    initializeDatabase();
    console.log('Database initialized, dbManager exists:', !!dbManager);
    
    createWindow();
    console.log('Window created');
    
    require('./ipc-handlers')(ipcMain, dbManager, store, dialog, setupFileWatcher);
    console.log('IPC handlers registered');
  } catch (error) {
    console.error('Initialization failed:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (dbManager) {
    dbManager.close();
  }
  if (fileWatcher) {
    fileWatcher.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
