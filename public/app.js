document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const scanForm = document.getElementById('scanForm');
  const urlInput = document.getElementById('urlInput');
  const scanBtn = document.getElementById('scanBtn');
  const btnText = scanBtn.querySelector('.btn-text');
  const loader = scanBtn.querySelector('.loader');
  const statusBanner = document.getElementById('statusBanner');
  
  const resultsSection = document.getElementById('resultsSection');
  const tipsSection = document.getElementById('tipsSection');
  const totalFoundCount = document.getElementById('totalFoundCount');
  const selectedCount = document.getElementById('selectedCount');
  const filterInput = document.getElementById('filterInput');
  const toggleSelectAllBtn = document.getElementById('toggleSelectAllBtn');
  const headerCheckbox = document.getElementById('headerCheckbox');
  const pdfListContainer = document.getElementById('pdfListContainer');
  
  const downloadBatchBtn = document.getElementById('downloadBatchBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  
  const progressWrapper = document.getElementById('progressWrapper');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');

  let currentPdfs = [];
  let selectedPdfIds = new Set();

  function showStatus(message, type = 'success') {
    statusBanner.className = `status-banner ${type}`;
    statusBanner.textContent = message;
    statusBanner.classList.remove('hidden');
  }

  function hideStatus() {
    statusBanner.classList.add('hidden');
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  function getFilteredPdfs() {
    const rawTerm = filterInput.value.trim().toLowerCase();
    if (!rawTerm) return currentPdfs;

    const term = rawTerm.startsWith('url:') ? rawTerm.slice(4).trim() : rawTerm;

    return currentPdfs.filter(item => {
      const urlRaw = (item.url || '').toLowerCase();
      let urlDecoded = '';
      try {
        urlDecoded = decodeURIComponent(urlRaw);
      } catch (e) {
        urlDecoded = urlRaw;
      }
      const filename = (item.filename || '').toLowerCase();
      const title = (item.title || '').toLowerCase();

      // Check if matches URL, decoded URL, filename, or title
      return urlRaw.includes(term) ||
             urlDecoded.includes(term) ||
             filename.includes(term) ||
             title.includes(term);
    });
  }

  function updateCounts() {
    const visible = getFilteredPdfs();
    const visibleSelectedCount = visible.filter(p => selectedPdfIds.has(p.id)).length;
    
    totalFoundCount.textContent = currentPdfs.length;
    selectedCount.textContent = visibleSelectedCount;
    
    downloadBatchBtn.disabled = visibleSelectedCount === 0;
    downloadZipBtn.disabled = visibleSelectedCount === 0;
    headerCheckbox.checked = visible.length > 0 && visibleSelectedCount === visible.length;
  }

  // Middle truncation helper: displays start + ... + ending characters
  function formatMiddleTruncate(str, maxLength = 65, frontChars = 30, backChars = 26) {
    if (!str || str.length <= maxLength) {
      return { full: str, front: str, tail: '', isTruncated: false };
    }
    const front = str.substring(0, frontChars);
    const tail = str.substring(str.length - backChars);
    return { full: str, front, tail, isTruncated: true };
  }

  function renderList() {
    const filtered = getFilteredPdfs();
    pdfListContainer.innerHTML = '';

    if (filtered.length === 0) {
      pdfListContainer.innerHTML = `
        <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
          No matching PDFs found for filter "<strong>${filterInput.value}</strong>"
        </div>
      `;
      return;
    }

    filtered.forEach((item) => {
      const isChecked = selectedPdfIds.has(item.id);
      const row = document.createElement('div');
      row.className = 'pdf-item';
      row.id = `row-${item.id}`;

      // Format middle truncation for Title and URL
      const titleInfo = formatMiddleTruncate(item.title || item.filename, 56, 30, 22);
      const titleDisplay = titleInfo.isTruncated
        ? `${titleInfo.front}<span class="middle-dots">...</span><span class="text-tail">${titleInfo.tail}</span>`
        : titleInfo.full;

      const urlInfo = formatMiddleTruncate(item.url, 66, 32, 28);
      const urlDisplay = urlInfo.isTruncated
        ? `${urlInfo.front}<span class="middle-dots">...</span><span class="url-tail">${urlInfo.tail}</span>`
        : urlInfo.full;

      row.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div class="pdf-info">
          <div class="pdf-title-row">
            <span class="badge-pdf">PDF</span>
            <span class="pdf-title" title="${item.title || item.filename}">${titleDisplay}</span>
          </div>
          <div class="pdf-meta">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="pdf-url" title="${item.url}">
              ${urlDisplay}
            </a>
          </div>
        </div>
        <div class="item-action">
          <span id="status-${item.id}" class="item-status hidden"></span>
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" title="Preview PDF in New Tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
          <a href="/api/download-single?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.filename)}" class="btn btn-primary btn-sm" title="Download File directly to Computer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>
      `;

      // Checkbox event
      const checkbox = row.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedPdfIds.add(item.id);
        } else {
          selectedPdfIds.delete(item.id);
        }
        updateCounts();
      });

      pdfListContainer.appendChild(row);
    });
  }

  // Scan Form Submit
  scanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    hideStatus();
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    scanBtn.disabled = true;

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan webpage');
      }

      currentPdfs = (data.pdfs || []).sort((a, b) => 
        a.url.localeCompare(b.url, undefined, { numeric: true, sensitivity: 'base' })
      );
      selectedPdfIds = new Set(currentPdfs.map(p => p.id));

      if (currentPdfs.length === 0) {
        showStatus('No direct PDF links were detected on this page.', 'error');
        resultsSection.classList.add('hidden');
        tipsSection.classList.remove('hidden');
      } else {
        showStatus(`Successfully found ${currentPdfs.length} PDF documents on "${data.pageTitle || url}"!`, 'success');
        resultsSection.classList.remove('hidden');
        tipsSection.classList.add('hidden');
        renderList();
        updateCounts();
      }
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      btnText.classList.remove('hidden');
      loader.classList.add('hidden');
      scanBtn.disabled = false;
    }
  });

  // Filter input: auto-selects matching items and updates view in real-time
  filterInput.addEventListener('input', () => {
    const visible = getFilteredPdfs();
    if (filterInput.value.trim().length > 0) {
      selectedPdfIds = new Set(visible.map(p => p.id));
    } else {
      selectedPdfIds = new Set(currentPdfs.map(p => p.id));
    }
    renderList();
    updateCounts();
  });

  // Select / Deselect All (acts on current visible/filtered items)
  function toggleAll(select) {
    const visible = getFilteredPdfs();
    if (select) {
      visible.forEach(p => selectedPdfIds.add(p.id));
    } else {
      visible.forEach(p => selectedPdfIds.delete(p.id));
    }
    renderList();
    updateCounts();
  }

  toggleSelectAllBtn.addEventListener('click', () => {
    const visible = getFilteredPdfs();
    const visibleSelectedCount = visible.filter(p => selectedPdfIds.has(p.id)).length;
    const shouldSelectAll = visibleSelectedCount < visible.length;
    toggleAll(shouldSelectAll);
    toggleSelectAllBtn.textContent = shouldSelectAll ? 'Deselect All' : 'Select All';
  });

  headerCheckbox.addEventListener('change', (e) => {
    toggleAll(e.target.checked);
  });

  // Batch Download to Server/Disk (downloads only the visible selected items)
  downloadBatchBtn.addEventListener('click', async () => {
    const visible = getFilteredPdfs();
    const selectedItems = visible.filter(p => selectedPdfIds.has(p.id));
    if (selectedItems.length === 0) {
      showStatus('No documents selected for download.', 'error');
      return;
    }

    progressWrapper.classList.remove('hidden');
    progressBar.style.width = '10%';
    progressText.textContent = `Downloading ${selectedItems.length} documents...`;
    progressPercent.textContent = '10%';
    downloadBatchBtn.disabled = true;

    try {
      const response = await fetch('/api/download-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Batch download failed');
      }

      progressBar.style.width = '100%';
      progressPercent.textContent = '100%';
      progressText.textContent = `Download complete! Saved to ${data.folder}`;

      // Update badge states
      data.results.forEach(res => {
        const badge = document.getElementById(`status-${res.id}`);
        if (badge) {
          badge.classList.remove('hidden');
          if (res.success) {
            badge.className = 'item-status success';
            badge.textContent = `✓ ${formatBytes(res.size)}`;
          } else {
            badge.className = 'item-status failed';
            badge.textContent = '✗ Error';
          }
        }
      });

      showStatus(`Successfully downloaded ${data.results.filter(r => r.success).length} PDFs to disk! Click "Open Folder" to view.`, 'success');
    } catch (err) {
      showStatus(`Error during batch download: ${err.message}`, 'error');
    } finally {
      downloadBatchBtn.disabled = false;
    }
  });

  // Download ZIP directly to browser (downloads only the visible selected items)
  downloadZipBtn.addEventListener('click', async () => {
    const visible = getFilteredPdfs();
    const selectedItems = visible.filter(p => selectedPdfIds.has(p.id));
    if (selectedItems.length === 0) {
      showStatus('No documents selected for ZIP.', 'error');
      return;
    }

    downloadZipBtn.disabled = true;
    showStatus('Preparing ZIP archive in your browser...', 'success');

    try {
      const response = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems,
          zipName: `pdfs_${Date.now()}.zip`
        })
      });

      if (!response.ok) throw new Error('ZIP generation failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `harvested_pdfs_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showStatus('ZIP archive downloaded successfully!', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      downloadZipBtn.disabled = false;
    }
  });

  // Open destination folder
  openFolderBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/open-folder');
      const data = await response.json();
      if (data.success) {
        showStatus(`Opened downloads folder: ${data.folder}`, 'success');
      }
    } catch (err) {
      showStatus('Unable to open folder automatically.', 'error');
    }
  });
});
