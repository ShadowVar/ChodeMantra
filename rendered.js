const { ipcRenderer } = require('electron');

document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab-button");
    const snippets = document.querySelectorAll(".snippet");
    const shortcutsButton = document.getElementById('shortcutsButton');
    const saveButton = document.getElementById('saveButton');

    function switchTab(index) {
        tabs.forEach((tab, i) => {
            tab.classList.toggle("active", i === index);
            snippets[i].classList.toggle("hidden", i !== index);
        });
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            switchTab(index);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.altKey) {
            let activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains("active"));
            if (event.key === "Tab") {
                event.preventDefault();
                let nextIndex = (activeIndex + 1) % tabs.length;
                switchTab(nextIndex);
            } else if (event.key === "q" || event.key === "Q") {
                event.preventDefault();
                const snippet = document.getElementById('snippet1').value;
                if (snippet) {
                    ipcRenderer.send('saveSnippets', [snippet]); // Save only active snippet
                    ipcRenderer.send('trigger-type', 0); // Trigger autotyping for Chode 1
                    document.getElementById('status').textContent = 'Autotyping Snippet 1 started!';
                }
            } else if (event.key === "w" || event.key === "W") {
                event.preventDefault();
                const snippet = document.getElementById('snippet2').value;
                if (snippet) {
                    ipcRenderer.send('saveSnippets', [snippet]); // Save only active snippet
                    ipcRenderer.send('trigger-type', 1); // Trigger autotyping for Chode 2
                    document.getElementById('status').textContent = 'Autotyping Snippet 2 started!';
                }
            } else if (event.key === "e" || event.key === "E") {
                event.preventDefault();
                const snippet = document.getElementById('snippet3').value;
                if (snippet) {
                    ipcRenderer.send('saveSnippets', [snippet]); // Save only active snippet
                    ipcRenderer.send('trigger-type', 2); // Trigger autotyping for Chode 3
                    document.getElementById('status').textContent = 'Autotyping Snippet 3 started!';
                }
            } else if (event.key === "s" || event.key === "S") {
                event.preventDefault();
                saveButton.click(); // Trigger the Save & Start button's click event
            }
        }
    });

    switchTab(0);

    document.getElementById('saveButton').addEventListener('click', () => {
        const snippets = [
            document.getElementById('snippet1').value,
            document.getElementById('snippet2').value,
            document.getElementById('snippet3').value
        ];
        ipcRenderer.send('saveSnippets', snippets); // Save all snippets
        document.getElementById('status').textContent = 'Snippets saved and program started!';
    });

    // Handle shortcuts modal
    const shortcutsModal = document.getElementById('shortcutsModal');
    const closeModal = document.querySelector('.close');

    shortcutsButton.addEventListener('click', () => {
        const shortcuts = {
            'Ctrl+Alt+Q': 'AutoType Chode 1',
            'Ctrl+Alt+W': 'AutoType Chode 2',
            'Ctrl+Alt+E': 'AutoType Chode 3',
            'Ctrl+Alt+S': 'Save & Start',
            'F9': 'Stop autotyping',
            'Ctrl+Tab': 'Switch between chodes'
        };
        const shortcutsList = document.getElementById('shortcutsList');
        shortcutsList.innerHTML = '';
        for (const [key, action] of Object.entries(shortcuts)) {
            const li = document.createElement('li');
            li.textContent = `${key}: ${action}`;
            shortcutsList.appendChild(li);
        }
        shortcutsModal.style.display = 'block';
        shortcutsButton.classList.add('active');
        document.getElementById('snippet1').blur();
    });

    closeModal.addEventListener('click', () => {
        shortcutsModal.style.display = 'none';
        shortcutsButton.classList.remove('active');
        document.getElementById('snippet1').focus();
    });

    // Handle autotyping termination event
    ipcRenderer.on('autotyping-terminated', () => {
        document.getElementById('status').textContent = 'Autotyping terminated.';
    });

    // Handle snippets-saved event from shortcut
    ipcRenderer.on('snippets-saved', (event, message) => {
        document.getElementById('status').textContent = message;
    });
});
