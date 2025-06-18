import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import Store from 'electron-store';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up Electron Store
const store = new Store();
const logDir = 'D:/SnippetTyper/logs';
const logFile = path.join(logDir, 'snippet_log.txt');
const tempFile = path.join(__dirname, 'snippet_temp.txt');
const pythonScript = path.join(__dirname, 'type_snippet.py');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Log actions
function logAction(action) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(logEntry);
}

// Save text to a temp file and trigger Python script to type it
function typeMessage(message) {
    fs.writeFileSync(tempFile, message, 'utf8'); // Save message to temp file
    logAction(`Saved message to file: ${message}`);

    exec(`python "${pythonScript}"`, (error, stdout, stderr) => {
        if (error) {
            logAction(`Error typing message: ${stderr}`);
        } else {
            logAction(`Message typed successfully: ${stdout}`);
        }
    });
}

// Register global shortcuts
function registerShortcuts() {
    const mainShortcuts = {
        'Control+Alt+Q': 'Snippet 1',
        'Control+Alt+W': 'Snippet 2',
        'Control+Alt+E': 'Snippet 3'
    };

    Object.entries(mainShortcuts).forEach(([keyCombo, snippetIndex]) => {
        const success = globalShortcut.register(keyCombo, () => {
            const snippets = store.get('snippets', []);
            const index = parseInt(snippetIndex.split(' ')[1]) - 1;

            if (snippets[index]) {
                typeMessage(snippets[index]); // Use typeMessage instead of logging
                logAction(`Shortcut ${keyCombo} triggered: ${snippetIndex}`);
            } else {
                logAction(`Shortcut ${keyCombo} triggered: ${snippetIndex} not set`);
            }
        });

        if (!success) {
            console.error(`Failed to register shortcut: ${keyCombo}`);
            logAction(`Failed to register shortcut: ${keyCombo}`);
        }
    });

    // 🎭 Savage Wrong Shortcut Messages (Now Typed Instead of Logged) 🎭
    const wrongShortcuts = {
        'Control+Alt+Z': "Bhosdike galat key dabai hai. Sahi key dabao nahi toh chudoge (Gracefully).",
        'Control+Alt+X': "Maa kasam, ye shortcut kaam nahi karta. 🤡",
        'Control+Alt+C': "Galat shortcut daba diya bhai. Teri aukaat nahi isko chalane ki. 😂",
        'Control+Alt+V': "Abe keyboard pe mat thuk, sahi key dabaa! 🤦‍♂️",
        'Control+Alt+B': "Windows bhi soch rha hai ye kya banda hai jo yeh key dabaa rha hai. 😭",
        'Control+Alt+N': "Beta tumse na ho payega. 🤡😂"
    };

    Object.entries(wrongShortcuts).forEach(([keyCombo, message]) => {
        const success = globalShortcut.register(keyCombo, () => {
            typeMessage(message); // Now types the message instead of logging
            logAction(`Easter Egg triggered: ${message}`);
        });

        if (!success) {
            console.error(`Failed to register shortcut: ${keyCombo}`);
            logAction(`Failed to register shortcut: ${keyCombo}`);
        }
    });

    logAction('Global shortcuts registered.');
}

// Create the main application window
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    logAction('Main window created and loaded.');
}

// Handle saving snippets from the frontend
ipcMain.on('saveSnippets', (event, snippets) => {
    store.set('snippets', snippets);
    logAction(`Snippets saved: ${JSON.stringify(snippets)}`);
    event.sender.send('snippets-saved', 'Snippets have been saved successfully.');
});

// Debugging: Check if shortcuts are actually registered
app.whenReady().then(() => {
    createWindow();
    registerShortcuts();

    // Check if wrong shortcut keys are working
    ['Control+Alt+Z', 'Control+Alt+X', 'Control+Alt+C', 'Control+Alt+V', 'Control+Alt+B', 'Control+Alt+N'].forEach((key) => {
        const registered = globalShortcut.isRegistered(key);
        console.log(`Shortcut Check: ${key} -> ${registered ? '✅ Working' : '❌ Not Registered'}`);
        logAction(`Shortcut Check: ${key} -> ${registered ? '✅ Working' : '❌ Not Registered'}`);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Clean up on app exit
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    logAction('Application exited and shortcuts unregistered.');
});
