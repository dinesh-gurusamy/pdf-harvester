<div align="center">

# 📄 PDF Harvester

### Modern Automated Webpage PDF Scanner & Batch Downloader

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://makeapullrequest.com)

**Never manually right-click and download dozens of PDFs one by one again.**  
PDF Harvester scans any public webpage, resolves dynamic and redirecting URLs, isolates PDF files, and downloads them in high-speed parallel batches or as a unified ZIP archive.

</div>

---

## ⚡ Highlights & Features

- 🌐 **Comprehensive Web Dashboard**: Sleek, glassmorphic dark-mode interface built with vanilla JS and CSS.
- ⚡ **301/302 Redirect Tracking**: Follows complex redirect chains (e.g. arXiv `/pdf/123` routes, nature, institutional portals) seamlessly.
- 🔍 **Smart URL & Keyword Filtering**: Filter down by filename, file extensions, URL path, query params, or host in real-time.
- 🎯 **Selective Batch Downloads**: Check or uncheck individual documents; batch download only what you filtered.
- 📦 **One-Click ZIP Streaming**: Packages all selected files into a single, uncorrupted ZIP archive directly in your browser.
- 💾 **Local Folder Sync**: High-speed multi-threaded downloads straight into your local `downloads/` directory.
- ✂️ **Middle-Truncation Display**: Long URLs and titles format as `https://start/.../ending_filename.pdf` with the identifier highlighted in cyan for effortless scanning.
- 🐍 **Standalone Python CLI**: Multi-threaded command-line tool with support for number ranges (`1-5, 8`), URL patterns, and regex scraping.
- 🔖 **1-Click Browser Bookmarklet**: Trigger in-page batch downloads on any active tab with zero installation.

---

## 🚀 Quick Start

### Option 1: Interactive Web Dashboard (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dinesh-gurusamy/pdf-harvester.git
   cd pdf-harvester
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

5. **Scan & Download:**
   - Paste any URL containing PDF links and click **Scan Webpage**.
   - Review discovered items, search or filter by URL/name.
   - Click **Download to Local Folder** or **Download ZIP**.
   - Use the **Open Folder** button in the header to view downloaded files immediately in Windows Explorer.

---

### Option 2: Python Command-Line Automation

If you prefer running headless scripts, automated cron jobs, or terminal workflows:

1. **Install Python dependencies:**
   ```bash
   pip install requests beautifulsoup4
   ```

2. **Run interactively:**
   ```bash
   python pdf_downloader.py
   ```
   *(You will be prompted to enter the webpage URL)*

3. **Or pass the URL directly:**
   ```bash
   python pdf_downloader.py https://arxiv.org/abs/2301.00001
   ```

4. **Selective Download Options in Terminal:**
   ```text
   Selective Download Options:
     - Press Enter or 'Y' to download ALL
     - Filter by URL pattern (e.g. url:/reports/ or /2024/)
     - Filter by keyword (e.g. annual or invoice)
     - Enter specific numbers (e.g. 1, 3, 7)
     - Enter ranges (e.g. 1-5, 8-10)
   ```

---

### Option 3: Instant Browser Bookmarklet (Zero Install)

Download all PDFs directly from any webpage you are currently reading without copying/pasting URLs:

1. In your browser (Chrome, Edge, Firefox, Brave), create a new Bookmark.
2. Set the Name to: `📥 Download All PDFs`
3. Paste the following snippet into the **URL / Location** field:
   ```javascript
   javascript:(function(){const links=Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).filter(h=>/\.pdf(\?.*)?$/i.test(h));if(!links.length){alert('No PDF links found on this page!');return;}const unique=[...new Set(links)];if(confirm(`Found ${unique.length} PDF files! Download all now?`)){unique.forEach((url,i)=>{setTimeout(()=>{const a=document.createElement('a');a.href=url;a.download=url.split('/').pop().split('?')[0]||`file_${i}.pdf`;document.body.appendChild(a);a.click();a.remove();},i*400);});}})();
   ```
4. Whenever you are on a webpage with PDFs, click that bookmark in your bookmarks bar!

---

## 📂 Project Architecture

```
pdf-harvester/
├── downloads/             # Auto-created; stores local batch downloads
├── public/                # Web Dashboard frontend assets
│   ├── index.html         # Modern responsive glassmorphism UI
│   ├── style.css          # Design system, glowing accents & middle truncation
│   └── app.js             # Client-side scanner, filter & batch manager
├── pdf_downloader.py      # Standalone multi-threaded Python automation script
├── server.js              # Express API server for scraping, redirects & ZIP streaming
├── bookmarklet.js         # Browser bookmarklet source and minified snippet
├── package.json           # Node.js project manifest & scripts
├── LICENSE                # MIT License
└── README.md              # Project documentation
```

---

## ⚙️ How PDF Discovery Works

Many websites disguise PDF links behind redirecting endpoints, dynamic paths, or buttons. PDF Harvester uses multi-layered detection:

1. **Standard Anchor Links:** Detects `<a href="...pdf">` tags.
2. **Path & Route Detection:** Identifies endpoints like `/pdf/2301.00001` or `/download?file=...` that deliver PDFs without explicit extensions.
3. **HTML Embeds & Iframes:** Scans `<embed>`, `<object>`, and `<iframe>` PDF viewers.
4. **Script Regex Fallback:** Scans dynamic JavaScript strings in page sources for raw PDF URLs.
5. **RFC 5987 / 6266 Header Sanitization:** Automatically cleans unicode, dashes, and invalid characters in HTTP headers so downloads never fail on special characters.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/dinesh-gurusamy/pdf-harvester/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
Built with ❤️ by <a href="https://github.com/dinesh-gurusamy">Dinesh Gurusamy</a>
</div>
