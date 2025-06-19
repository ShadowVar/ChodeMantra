import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron';
import Store from 'electron-store';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
const logDir = path.join(app.getPath('userData'), 'logs');
const logFile = path.join(logDir, 'snippet_log.txt');
const tempFile = path.join(os.tmpdir(), 'snippet_temp.txt');
const tempPythonScript = path.join(os.tmpdir(), 'type_snippet_temp.py');
const stopFile = path.join(os.tmpdir(), 'autotyper_stop.txt');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function logAction(action) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(logEntry);
}

function findPythonExecutable() {
    const pythonCandidates = ['python', 'python3', 'py'];
    for (const cmd of pythonCandidates) {
        try {
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            logAction(`Found Python executable: ${cmd}`);
            return cmd;
        } catch (error) {
            continue;
        }
    }
    logAction('Python executable not found in system PATH');
    return null;
}

function extractPythonScript() {
    const sourcePath = path.join(__dirname, 'type_snippet.py');
    try {
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, tempPythonScript);
            logAction(`Extracted type_snippet.py to ${tempPythonScript}`);
        } else {
            const asarContent = fs.readFileSync(path.join(__dirname, '..', 'app.asar', 'type_snippet.py'), 'utf8');
            fs.writeFileSync(tempPythonScript, asarContent);
            logAction(`Extracted type_snippet.py from app.asar to ${tempPythonScript}`);
        }
        if (os.platform() !== 'win32') {
            fs.chmodSync(tempPythonScript, '755');
            logAction(`Set executable permissions for ${tempPythonScript} on ${os.platform()}`);
        }
    } catch (error) {
        logAction(`Failed to extract type_snippet.py: ${error.message}`);
        return false;
    }
    return true;
}

function createTempFile() {
    try {
        if (!fs.existsSync(tempFile)) {
            fs.writeFileSync(tempFile, '', 'utf8');
            logAction(`Created empty snippet_temp.txt in ${os.tmpdir()}`);
            if (os.platform() !== 'win32') {
                fs.chmodSync(tempFile, '664');
                logAction(`Set read/write permissions for ${tempFile} on ${os.platform()}`);
            }
        } else {
            fs.writeFileSync(tempFile, '', 'utf8');
            logAction(`Overwrote existing snippet_temp.txt in ${os.tmpdir()} to empty`);
        }
    } catch (error) {
        logAction(`Failed to create/overwrote snippet_temp.txt: ${error.message}`);
        return false;
    }
    return true;
}

function typeMessage(message, webContents) {
    try {
        fs.writeFileSync(tempFile, message, 'utf8');
        logAction(`Saved message to file: ${message}`);
    } catch (error) {
        logAction(`Failed to write to snippet_temp.txt: ${error.message}`);
        return;
    }

    // Ensure stop file is removed before starting
    if (fs.existsSync(stopFile)) {
        fs.unlinkSync(stopFile);
        logAction(`Removed stop file ${stopFile} before starting autotyping`);
    }

    const pythonCmd = findPythonExecutable();
    if (pythonCmd) {
        if (fs.existsSync(tempPythonScript)) {
            const childProcess = exec(`${pythonCmd} "${tempPythonScript}"`, (error, stdout, stderr) => {
                if (error) {
                    logAction(`Error typing message: ${stderr || error.message}`);
                } else {
                    logAction(`Message typed successfully: ${stdout || 'No output'}`);
                }
                if (global.activeProcess === childProcess) {
                    global.activeProcess = null;
                    webContents.send('autotyping-stopped');
                    if (fs.existsSync(stopFile)) {
                        fs.unlinkSync(stopFile);
                        logAction(`Cleaned up stop file ${stopFile} after process end`);
                    }
                }
            });
            global.activeProcess = childProcess;
            logAction(`Autotyping process started with PID: ${childProcess.pid}`);
        } else {
            logAction('Temporary Python script not found. Extraction may have failed.');
        }
    } else {
        logAction('Python not found. Please ensure Python is installed and added to the system PATH.');
    }
}

function updateTempFileWithSnippets() {
    const snippets = store.get('snippets', []);
    try {
        if (snippets.length > 0) {
            fs.writeFileSync(tempFile, snippets.join('\n'), 'utf8');
            logAction(`Updated temp file with snippets: ${snippets.join('\n')}`);
        } else {
            fs.writeFileSync(tempFile, '', 'utf8');
            logAction('Updated temp file: no snippets available');
        }
    } catch (error) {
        logAction(`Failed to update snippet_temp.txt: ${error.message}`);
    }
}

function registerShortcuts(webContents) {
    const mainShortcuts = {
        'Control+Alt+Q': 'Snippet 1',
        'Control+Alt+W': 'Snippet 2',
        'Control+Alt+E': 'Snippet 3',
        'Control+Alt+S': 'Save & Start',
        'F9': 'Terminate Autotyping'
    };

    Object.entries(mainShortcuts).forEach(([keyCombo, action]) => {
        const success = globalShortcut.register(keyCombo, () => {
            if (keyCombo === 'Control+Alt+S') {
                const snippets = [
                    webContents.executeJavaScript("document.getElementById('snippet1').value"),
                    webContents.executeJavaScript("document.getElementById('snippet2').value"),
                    webContents.executeJavaScript("document.getElementById('snippet3').value")
                ];
                Promise.all(snippets).then((values) => {
                    ipcMain.emit('saveSnippets', { sender: webContents }, values);
                    webContents.send('snippets-saved', 'Snippets saved and program started!');
                    logAction(`Shortcut ${keyCombo} triggered: ${action}`);
                });
            } else if (keyCombo === 'F9') {
                if (global.activeProcess) {
                    try {
                        const pid = global.activeProcess.pid;
                        logAction(`Terminating process with PID: ${pid}`);
                        // Create stop file to signal Python script
                        fs.writeFileSync(stopFile, '', 'utf8');
                        logAction(`Created stop file ${stopFile}`);
                        // Try SIGTERM
                        global.activeProcess.kill('SIGTERM');
                        // Wait briefly and try taskkill
                        setTimeout(() => {
                            if (global.activeProcess && !global.activeProcess.killed) {
                                if (os.platform() === 'win32') {
                                    try {
                                        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                                        logAction(`Forced termination with taskkill /PID ${pid}`);
                                    } catch (error) {
                                        logAction(`taskkill /PID failed: ${error.message}`);
                                        // Fallback to killing all python.exe processes
                                        try {
                                            execSync(`taskkill /IM python.exe /F`, { stdio: 'ignore' });
                                            logAction(`Forced termination of all python.exe processes`);
                                        } catch (fallbackError) {
                                            logAction(`taskkill /IM python.exe failed: ${fallbackError.message}`);
                                        }
                                    }
                                } else {
                                    global.activeProcess.kill('SIGKILL');
                                    logAction('Forced autotyping termination with SIGKILL via F9');
                                }
                            }
                            if (fs.existsSync(stopFile)) {
                                fs.unlinkSync(stopFile);
                                logAction(`Cleaned up stop file ${stopFile}`);
                            }
                        }, 500);
                        global.activeProcess = null;
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('autotyping-terminated');
                        }
                        logAction('Autotyping terminated via F9');
                    } catch (error) {
                        logAction(`Failed to terminate autotyping via F9: ${error.message}`);
                        // Cleanup stop file on error
                        if (fs.existsSync(stopFile)) {
                            fs.unlinkSync(stopFile);
                            logAction(`Cleaned up stop file ${stopFile} after error`);
                        }
                    }
                } else {
                    logAction('F9 pressed: No active autotyping process to terminate');
                }
            } else {
                const snippets = store.get('snippets', []);
                const index = parseInt(action.split(' ')[1]) - 1;
                if (snippets[index]) {
                    typeMessage(snippets[index], webContents);
                    logAction(`Shortcut ${keyCombo} triggered: ${action}`);
                } else {
                    logAction(`Shortcut ${keyCombo} triggered: ${action} not set`);
                }
            }
        });
        if (!success) {
            console.error(`Failed to register shortcut: ${keyCombo}`);
            logAction(`Failed to register shortcut: ${keyCombo}`);
        }
    });

    const tabSuccess = globalShortcut.register('Control+Tab', () => {
        webContents.executeJavaScript(`
            (function() {
                try {
                    const tabs = document.querySelectorAll(".tab-button");
                    if (tabs.length > 0) {
                        let activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains("active"));
                        let nextIndex = (activeIndex + 1) % tabs.length;
                        tabs.forEach((tab, i) => {
                            tab.classList.toggle("active", i === nextIndex);
                            document.querySelectorAll(".snippet")[i].classList.toggle("hidden", i !== nextIndex);
                        });
                        return true;
                    } else {
                        console.error('Ctrl+Tab error: Tab elements not found');
                        return false;
                    }
                } catch (error) {
                    console.error('Ctrl+Tab error:', error);
                    return false;
                }
            })();
        `).then((success) => {
            if (success) {
                logAction('Ctrl+Tab triggered to switch tabs successfully');
            }
        }).catch((error) => {
            logAction(`Ctrl+Tab execution failed: ${error.message}`);
            console.error('Ctrl+Tab error:', error);
        });
    });
    if (!tabSuccess) {
        console.error('Failed to register shortcut: Control+Tab');
        logAction('Failed to register shortcut: Control+Tab');
    }

    logAction('Global shortcuts registered.');
}

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
    mainWindow.webContents.on('did-finish-load', () => {
        logAction('Window content fully loaded, registering shortcuts');
        registerShortcuts(mainWindow.webContents);
    });
    logAction('Main window created and loaded.');
}

ipcMain.on('saveSnippets', (event, snippets) => {
    store.set('snippets', snippets);
    updateTempFileWithSnippets();
    logAction(`Snippets saved: ${JSON.stringify(snippets)}`);
    if (event && event.sender) event.sender.send('snippets-saved', 'Snippets have been saved successfully.');
});

ipcMain.on('trigger-type', (event, index) => {
    const snippets = store.get('snippets', []);
    if (snippets[index]) {
        typeMessage(snippets[index], event.sender);
    }
});

app.whenReady().then(() => {
    store.clear();
    const pythonCmd = findPythonExecutable();
    if (!pythonCmd) {
        dialog.showErrorBox(
            'Python Not Found',
            'Python is not found in your system PATH. Please install Python and add it to your system PATH to use this app. Visit https://www.python.org/downloads/ for installation instructions.'
        );
        logAction('App startup aborted due to missing Python.');
        app.quit();
        return;
    }

    if (!extractPythonScript() || !createTempFile()) {
        dialog.showErrorBox(
            'Script or Temp File Setup Failed',
            'Failed to set up the Python script or temp file. Please reinstall the app or contact support.'
        );
        logAction('App startup aborted due to setup failure.');
        app.quit();
        return;
    }

    // Clean up stop file on startup
    if (fs.existsSync(stopFile)) {
        fs.unlinkSync(stopFile);
        logAction(`Cleaned up stop file ${stopFile} on startup`);
    }

    createWindow();

    ['Control+Alt+Q', 'Control+Alt+W', 'Control+Alt+E', 'Control+Alt+S', 'Control+Tab', 'F9'].forEach((key) => {
        const registered = globalShortcut.isRegistered(key);
        console.log(`Shortcut Check: ${key} -> ${registered ? '✅ Working' : '❌ Not Registered'}`);
        logAction(`Shortcut Check: ${key} -> ${registered ? '✅ Working' : '❌ Not Registered'}`);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (fs.existsSync(tempFile)) {
        try {
            fs.unlinkSync(tempFile);
            logAction(`Deleted snippet_temp.txt from ${os.tmpdir()} on exit.`);
        } catch (error) {
            logAction(`Failed to delete snippet_temp.txt: ${error.message}`);
        }
    }
    if (fs.existsSync(tempPythonScript)) {
        try {
            fs.unlinkSync(tempPythonScript);
            logAction(`Deleted type_snippet_temp.py from ${os.tmpdir()} on exit.`);
        } catch (error) {
            logAction(`Failed to delete type_snippet_temp.py: ${error.message}`);
        }
    }
    if (fs.existsSync(stopFile)) {
        try {
            fs.unlinkSync(stopFile);
            logAction(`Deleted autotyper_stop.txt from ${os.tmpdir()} on exit.`);
        } catch (error) {
            logAction(`Failed to delete autotyper_stop.txt: ${error.message}`);
        }
    }
    globalShortcut.unregisterAll();
    logAction('Application exited and resources cleaned up.');
});
