const { ipcRenderer } = require('electron');

document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab-button");
    const snippets = document.querySelectorAll(".snippet");

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
        if (event.ctrlKey && event.key === "Tab") {
            event.preventDefault();
            let activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains("active"));
            let nextIndex = (activeIndex + 1) % tabs.length;
            switchTab(nextIndex);
        }
    });

    switchTab(0);

    document.getElementById('saveButton').addEventListener('click', () => {
        const snippets = [
            document.getElementById('snippet1').value,
            document.getElementById('snippet2').value,
            document.getElementById('snippet3').value
        ];
        ipcRenderer.send('saveSnippets', snippets);
        document.getElementById('status').textContent = 'Snippets saved and program started!';
    });
});
