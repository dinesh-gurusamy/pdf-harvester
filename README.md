# 🚀 Automated PDF Batch Downloader & Harvester

An all-in-one automation suite built to eliminate manual, repetitive PDF downloads from any webpage.

---

## 🌟 Choose Your Favorite Way to Download

### Option 1: 🖥️ Interactive Web Dashboard (Recommended)
A visual dashboard with dark mode, live progress bars, multi-select checkboxes, and one-click ZIP download.

1. **Start the Web App:**
   ```bash
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
3. **Features:**
   - 🔍 **Paste any webpage URL** and click **Scan Webpage**.
   - ⚡ Real-time discovery of all `.pdf` links (including relative links & script-embedded links).
   - 🎯 **Filter & Search** PDFs by keyword or filename.
   - 💾 **Download to Local Folder**: Parallel high-speed downloads directly to the `./downloads/` directory.
   - 📦 **Download ZIP**: Packages all selected PDFs into a clean ZIP archive directly to your browser.
   - 📂 **Open Folder**: Click the "Open Folder" button in the header to open Windows File Explorer to your downloaded files instantly.

---

### Option 2: 🐍 Python Automation CLI Script
If you prefer running a command or scheduling automated downloads headless:

1. **Run the script interactively:**
   ```bash
   python pdf_downloader.py
   ```
   *(It will prompt you to enter the webpage URL)*

2. **Or pass the URL directly:**
   ```bash
   python pdf_downloader.py https://example.com/reports
   ```
3. **Features:**
   - Multi-threaded parallel downloads (ThreadPoolExecutor).
   - Automatic sanitization of Windows-invalid characters (`\ / : * ? " < > |`).
   - Duplicate filename resolution (`report_1.pdf`, `report_2.pdf`).
   - Clean summary report showing total time and file sizes.

---

### Option 3: ⚡ 1-Click Browser Bookmarklet (Zero Install)
Download all PDFs from any page you are currently viewing without copying/pasting URLs:

1. In Chrome, Edge, or Firefox, create a new Bookmark.
2. Name it: `📥 Download All PDFs`
3. Paste the following snippet into the **URL / Location** field:
   ```javascript
   javascript:(function(){const links=Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).filter(h=>/\.pdf(\?.*)?$/i.test(h));if(!links.length){alert('No PDF links found on this page!');return;}const unique=[...new Set(links)];if(confirm(`Found ${unique.length} PDF files! Download all now?`)){unique.forEach((url,i)=>{setTimeout(()=>{const a=document.createElement('a');a.href=url;a.download=url.split('/').pop().split('?')[0]||`file_${i}.pdf`;document.body.appendChild(a);a.click();a.remove();},i*400);});}})();
   ```
4. Whenever you are on any webpage with PDFs, simply click that bookmark in your bookmarks bar!

---

## 🛠️ Project Structure

```
pdf-download-automation/
├── downloads/             # Automatically created; holds all downloaded PDFs
├── public/                # Web Dashboard frontend assets
│   ├── index.html         # Modern responsive UI
│   ├── style.css          # Glassmorphism dark mode design system
│   └── app.js             # Client-side scanner, filter, & batch manager
├── pdf_downloader.py      # Standalone multi-threaded Python automation script
├── server.js              # Express API server for scraping and streaming
├── bookmarklet.js         # In-browser bookmarklet script
└── package.json           # Node.js configuration
```
