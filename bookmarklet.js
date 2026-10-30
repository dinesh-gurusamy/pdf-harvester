/**
 * PDF One-Click Browser Bookmarklet
 * 
 * HOW TO USE:
 * 1. Create a new bookmark in your browser (Chrome / Edge / Firefox / Brave).
 * 2. Name it: "📥 Download All PDFs"
 * 3. In the URL/Location field, paste the minified code below:
 */

// Minified bookmarklet:
// javascript:(function(){const links=Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).filter(h=>/\.pdf(\?.*)?$/i.test(h));if(!links.length){alert('No PDF links found on this page!');return;}const unique=[...new Set(links)];if(confirm(`Found ${unique.length} PDF files! Download all now?`)){unique.forEach((url,i)=>{setTimeout(()=>{const a=document.createElement('a');a.href=url;a.download=url.split('/').pop().split('?')[0]||`file_${i}.pdf`;document.body.appendChild(a);a.click();a.remove();},i*400);});}})();

/* Readable Source Code: */
(function() {
  // Find all links ending with .pdf
  const pdfLinks = Array.from(document.querySelectorAll('a[href]'))
    .map(a => a.href)
    .filter(href => /\.pdf(\?.*)?$/i.test(href));

  // Deduplicate
  const uniqueLinks = [...new Set(pdfLinks)];

  if (uniqueLinks.length === 0) {
    alert('No PDF links detected on this webpage.');
    return;
  }

  const proceed = confirm(`Detected ${uniqueLinks.length} PDF documents on this page.\n\nDo you want to download them all now?`);
  if (!proceed) return;

  // Stagger downloads to prevent browser popup block
  uniqueLinks.forEach((url, index) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = url.split('/').pop().split('?')[0] || `document_${index + 1}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, index * 400);
  });
})();
