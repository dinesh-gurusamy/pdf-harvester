const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const cheerio = require('cheerio');
const archiver = require('archiver');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Prevent browser caching during local development
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloaded-files', express.static(DOWNLOADS_DIR));

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Upgrade-Insecure-Requests': '1'
};

function sanitizeFilename(name) {
  try {
    name = decodeURIComponent(name);
  } catch (e) {}
  name = name.replace(/[\\/*?:"<>|\r\n\t]/g, '_').trim();
  return name || 'document.pdf';
}

function formatContentDisposition(filename) {
  const cleanName = sanitizeFilename(filename || 'document.pdf');
  // Safe ASCII-only fallback for older clients
  const asciiName = cleanName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  // RFC 5987 / RFC 6266 UTF-8 encoded filename for modern browsers
  const utf8Encoded = encodeURIComponent(cleanName);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Encoded}`;
}

function extractFilename(urlStr, fallback = 'document') {
  try {
    const parsed = new URL(urlStr);
    let base = path.basename(parsed.pathname);
    if (base && !base.toLowerCase().endsWith('.pdf') && base.length > 1) {
      base = `${base}.pdf`;
    }
    if (!base || base === '.pdf') {
      for (const [key, val] of parsed.searchParams.entries()) {
        if (val.toLowerCase().endsWith('.pdf')) {
          base = val;
          break;
        }
      }
    }
    if (!base || !base.toLowerCase().endsWith('.pdf')) {
      base = `${fallback}_${Date.now()}.pdf`;
    }
    return sanitizeFilename(base);
  } catch (e) {
    return `${fallback}_${Date.now()}.pdf`;
  }
}

// Fetch helper with redirect following
function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    try {
      const client = targetUrl.startsWith('https:') ? https : http;
      const req = client.get(targetUrl, {
        headers: BROWSER_HEADERS
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          return resolve(fetchUrl(redirectUrl));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP error ${res.statusCode} ${res.statusMessage}`));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error('Request timeout after 20s'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Download a single file to disk or stream
function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const client = fileUrl.startsWith('https:') ? https : http;
      const req = client.get(fileUrl, {
        headers: BROWSER_HEADERS
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, fileUrl).href;
          return resolve(downloadFile(redirectUrl, outputPath));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          const stats = fs.statSync(outputPath);
          resolve(stats.size);
        });
        fileStream.on('error', (err) => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });
      req.on('error', reject);
      req.setTimeout(45000, () => {
        req.destroy();
        reject(new Error('Download timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

// API: Scan webpage for PDF links
app.post('/api/scan', async (req, res) => {
  let { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    const html = await fetchUrl(url);
    const $ = cheerio.load(html);
    const pdfLinks = [];
    const seen = new Set();

    const isPdfUrl = (urlStr, text, className) => {
      try {
        const parsed = new URL(urlStr);
        const pathLower = parsed.pathname.toLowerCase();
        const searchLower = parsed.search.toLowerCase();
        const textLower = (text || '').toLowerCase().trim();
        const classLower = (className || '').toLowerCase();

        // 1. Direct .pdf extension
        if (pathLower.endsWith('.pdf') || searchLower.includes('.pdf')) return true;

        // 2. /pdf/ route (e.g. arxiv /pdf/12345, nature /pdf/..., etc.)
        if (pathLower.includes('/pdf/') || pathLower.endsWith('/pdf')) return true;

        // 3. Query params like ?format=pdf or ?type=pdf or &file=...
        if (searchLower.includes('=pdf') || searchLower.includes('download=pdf')) return true;

        // 4. Anchor text or class explicitly designating a PDF download
        if (textLower === 'pdf' || textLower === 'download pdf' || textLower.includes('(pdf)') || textLower.includes('[pdf]')) return true;
        if (classLower.includes('download-pdf') || classLower.includes('pdf-link')) return true;

        return false;
      } catch (e) {
        return false;
      }
    };

    const addLink = (href, title, className = '') => {
      if (!href) return;
      try {
        const absoluteUrl = new URL(href.trim(), url).href;
        if (isPdfUrl(absoluteUrl, title, className) && !seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          const filename = extractFilename(absoluteUrl, `doc_${pdfLinks.length + 1}`);
          const displayTitle = (title && title.trim().length > 2) ? title.trim() : filename;
          pdfLinks.push({
            id: 'pdf_' + Math.random().toString(36).substring(2, 9),
            url: absoluteUrl,
            filename,
            title: displayTitle
          });
        }
      } catch (e) {}
    };

    // Scan standard <a> tags
    $('a[href]').each((_, el) => {
      addLink($(el).attr('href'), $(el).text(), $(el).attr('class') || '');
    });

    // Scan embed, object, iframe
    $('embed[src], object[data], iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data');
      addLink(src, 'Embedded PDF Document');
    });

    // Regex fallback to catch links embedded in scripts or attributes
    const regexMatches = html.match(/(https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/gi) || [];
    for (const match of regexMatches) {
      addLink(match, '');
    }

    const pageTitle = $('title').text().trim() || new URL(url).hostname;

    // Sort ascending by URL (natural sort: e.g. /doc/2 before /doc/10)
    pdfLinks.sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true, sensitivity: 'base' }));

    res.json({
      success: true,
      pageTitle,
      count: pdfLinks.length,
      pdfs: pdfLinks
    });
  } catch (error) {
    res.status(500).json({
      error: `Could not scan webpage: ${error.message}`
    });
  }
});

// API: Batch download to local downloads folder
app.post('/api/download-batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const results = [];
  for (const item of items) {
    let filename = sanitizeFilename(item.filename || 'document.pdf');
    let savePath = path.join(DOWNLOADS_DIR, filename);

    // Prevent overwriting
    let counter = 1;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    while (fs.existsSync(savePath)) {
      savePath = path.join(DOWNLOADS_DIR, `${base}_${counter}${ext}`);
      counter++;
    }

    try {
      const size = await downloadFile(item.url, savePath);
      results.push({
        id: item.id,
        filename: path.basename(savePath),
        size,
        success: true,
        localPath: savePath
      });
    } catch (err) {
      results.push({
        id: item.id,
        filename,
        success: false,
        error: err.message
      });
    }
  }

  res.json({
    success: true,
    results,
    folder: DOWNLOADS_DIR
  });
});

// Helper to fetch response stream following redirects
function getStreamWithRedirects(fileUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    try {
      const client = fileUrl.startsWith('https:') ? https : http;
      const req = client.get(fileUrl, {
        headers: BROWSER_HEADERS
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, fileUrl).href;
          res.resume();
          return resolve(getStreamWithRedirects(redirectUrl, maxRedirects - 1));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
        resolve(res);
      });
      req.on('error', reject);
      req.setTimeout(45000, () => {
        req.destroy();
        reject(new Error('Download timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

// API: Stream ZIP directly to browser with full redirect support
app.post('/api/download-zip', async (req, res) => {
  const { items, zipName } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const filename = sanitizeFilename(zipName || 'batch_pdfs.zip');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', formatContentDisposition(zipName || 'batch_pdfs.zip'));

  archive.pipe(res);

  for (const item of items) {
    try {
      const stream = await getStreamWithRedirects(item.url);
      const entryName = sanitizeFilename(item.filename || 'document.pdf');
      archive.append(stream, { name: entryName });
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (err) {
      console.error(`ZIP archiver skip for ${item.url}:`, err.message);
    }
  }

  archive.finalize();
});

// API: Direct single file download attachment (prevents browser from navigating to PDF page)
app.get('/api/download-single', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  res.setHeader('Content-Disposition', formatContentDisposition(filename || 'document.pdf'));
  res.setHeader('Content-Type', 'application/pdf');

  try {
    const stream = await getStreamWithRedirects(url);
    stream.pipe(res);
  } catch (err) {
    res.status(500).send(`Download failed: ${err.message}`);
  }
});

// API: Open downloads directory in Windows File Explorer
app.get('/api/open-folder', (req, res) => {
  exec(`explorer.exe "${DOWNLOADS_DIR}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to open directory' });
    }
    res.json({ success: true, folder: DOWNLOADS_DIR });
  });
});

app.listen(PORT, () => {
  console.log(`PDF Downloader server is running at http://localhost:${PORT}`);
});
