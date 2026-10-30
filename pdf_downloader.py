#!/usr/bin/env python3
"""
Automated PDF Batch Downloader
Scrapes any webpage, detects all PDF links (absolute and relative),
and downloads them with progress indicators and deduplication.
"""

import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Try importing requests and beautifulsoup4; fallback to standard library if not installed
try:
    import requests
    from bs4 import BeautifulSoup
    HAS_LIBS = True
except ImportError:
    import urllib.request
    HAS_LIBS = False

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

def sanitize_filename(name: str) -> str:
    """Removes invalid characters for Windows filenames."""
    name = urllib.parse.unquote(name)
    name = re.sub(r'[\\/*?:"<>|]', '_', name)
    name = name.strip()
    return name or "document.pdf"

def extract_pdf_filename(url: str, default_prefix: str = "document") -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path
    base = os.path.basename(path)
    if base and not base.lower().endswith(".pdf") and len(base) > 1:
        base = f"{base}.pdf"
    if not base or base == ".pdf":
        query = urllib.parse.parse_qs(parsed.query)
        for key in ["file", "name", "filename", "doc", "title"]:
            if key in query and query[key][0].lower().endswith(".pdf"):
                base = query[key][0]
                break
    if not base or not base.lower().endswith(".pdf"):
        base = f"{default_prefix}_{int(time.time() * 1000)}.pdf"
    return sanitize_filename(base)

def fetch_html(url: str) -> str:
    if HAS_LIBS:
        headers = {"User-Agent": USER_AGENT}
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        return resp.text
    else:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.read().decode('utf-8', errors='ignore')

def is_pdf_candidate(full_url: str, text: str = "", class_name: str = "") -> bool:
    parsed = urllib.parse.urlparse(full_url)
    path_lower = parsed.path.lower()
    query_lower = parsed.query.lower()
    text_lower = (text or "").lower().strip()
    class_lower = (class_name or "").lower()

    # 1. Direct .pdf extension
    if path_lower.endswith(".pdf") or ".pdf?" in full_url.lower() or query_lower.endswith(".pdf"):
        return True

    # 2. /pdf/ routes (e.g. arxiv, academic portals)
    if "/pdf/" in path_lower or path_lower.endswith("/pdf"):
        return True

    # 3. Query params like ?type=pdf or &download=pdf
    if "=pdf" in query_lower or "format=pdf" in query_lower:
        return True

    # 4. Anchor text or class explicitly designating a PDF
    if text_lower in ["pdf", "download pdf", "view pdf"] or "(pdf)" in text_lower or "[pdf]" in text_lower:
        return True
    if "download-pdf" in class_lower or "pdf-link" in class_lower:
        return True

    return False

def find_pdf_links(page_url: str, html_text: str):
    """Finds all PDF links from HTML anchor tags, iframes, and raw regex matches."""
    pdf_links = []
    seen = set()

    def add_link(href, text="", class_name=""):
        if not href:
            return
        # Resolve relative URLs
        full_url = urllib.parse.urljoin(page_url, href.strip())
        
        if is_pdf_candidate(full_url, text, class_name) and full_url not in seen:
            seen.add(full_url)
            filename = extract_pdf_filename(full_url, default_prefix=f"doc_{len(pdf_links)+1}")
            display_title = text.strip() if text and len(text.strip()) > 2 else filename
            pdf_links.append({
                "url": full_url,
                "filename": filename,
                "title": display_title
            })

    if HAS_LIBS:
        soup = BeautifulSoup(html_text, 'html.parser')
        # Check <a> tags
        for a in soup.find_all('a', href=True):
            add_link(a['href'], a.get_text(), " ".join(a.get('class', [])))
        # Check <embed> and <object> and <iframe>
        for tag in soup.find_all(['embed', 'object', 'iframe'], src=True):
            add_link(tag['src'], "Embedded PDF")
    
    # Also run regex fallback to catch dynamically loaded strings
    matches = re.findall(r'(https?://[^\s"\'<>]+\.pdf(?:\?[^\s"\'<>]*)?)', html_text, re.IGNORECASE)
    for m in matches:
        add_link(m)

    # Sort ascending by URL naturally (e.g. part_2 before part_10)
    pdf_links.sort(key=lambda x: [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', x['url'])])

    return pdf_links

def download_file(item: dict, output_dir: str) -> dict:
    url = item["url"]
    filename = item["filename"]
    save_path = os.path.join(output_dir, filename)

    # Avoid overwriting duplicates
    counter = 1
    base_name, ext = os.path.splitext(filename)
    while os.path.exists(save_path):
        save_path = os.path.join(output_dir, f"{base_name}_{counter}{ext}")
        counter += 1

    try:
        if HAS_LIBS:
            headers = {"User-Agent": USER_AGENT}
            with requests.get(url, headers=headers, stream=True, timeout=30) as r:
                r.raise_for_status()
                with open(save_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
        else:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as response, open(save_path, 'wb') as out_file:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    out_file.write(chunk)

        file_size = os.path.getsize(save_path)
        return {"success": True, "filename": os.path.basename(save_path), "size": file_size, "url": url}
    except Exception as e:
        return {"success": False, "filename": filename, "error": str(e), "url": url}

def format_size(bytes_num: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:.1f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f} TB"

def main():
    print("=" * 60)
    print("           FAST AUTOMATED PDF BATCH DOWNLOADER           ")
    print("=" * 60)

    # Check for help flags
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h", "help"]:
        print("\nUsage:")
        print("  python pdf_downloader.py <URL>")
        print("  python pdf_downloader.py")
        print("\nExamples:")
        print("  python pdf_downloader.py https://example.com/reports")
        print("  python pdf_downloader.py https://arxiv.org/list/cs/recent\n")
        sys.exit(0)

    # Get URL from argument or user input
    if len(sys.argv) > 1:
        target_url = sys.argv[1].strip()
    else:
        target_url = input("\nEnter Webpage URL to scan: ").strip()

    if not target_url:
        print("[!] No URL provided. Exiting.")
        sys.exit(1)

    if not target_url.startswith(('http://', 'https://')):
        target_url = 'https://' + target_url

    print(f"\n[*] Scanning: {target_url}")
    print("[*] Parsing webpage content...")

    try:
        html = fetch_html(target_url)
    except Exception as e:
        print(f"[!] Failed to fetch webpage: {e}")
        sys.exit(1)

    pdf_list = find_pdf_links(target_url, html)

    if not pdf_list:
        print("\n[!] No PDF links found on this webpage.")
        print("Tip: If the page loads PDFs via JavaScript/buttons, use our Web App dashboard.")
        sys.exit(0)

    print(f"\n[+] Found {len(pdf_list)} PDF documents:")
    for idx, item in enumerate(pdf_list, 1):
        print(f"  {idx:2d}. {item['filename']} -> {item['url'][:70]}...")

    output_dir = os.path.join(os.getcwd(), "downloads")
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n[*] Destination Folder: {output_dir}")

def parse_selection(choice_str: str, pdf_list: list) -> list:
    """Parses user input supporting comma-separated numbers, ranges (1-5), URL patterns, and keyword filters."""
    choice_str = choice_str.strip()
    if not choice_str or choice_str.lower() in ['y', 'all']:
        return pdf_list

    # 1. Explicit URL filter (e.g., "url:/docs/2024" or "u:arxiv")
    if choice_str.lower().startswith("url:") or choice_str.lower().startswith("u:"):
        pattern = choice_str.split(":", 1)[1].strip().lower()
        return [p for p in pdf_list if pattern in p['url'].lower()]

    # 2. General filter prefix (e.g., "filter:annual" or "f:report")
    if choice_str.lower().startswith("filter:") or choice_str.lower().startswith("f:"):
        pattern = choice_str.split(":", 1)[1].strip().lower()
        return [p for p in pdf_list if pattern in p['url'].lower() or pattern in p['filename'].lower() or pattern in p['title'].lower()]

    # 3. Detect if input is a URL or URL fragment (e.g. contains '/', '://', '?', '.pdf', or non-numeric)
    is_url_or_text = (
        '/' in choice_str or 
        '://' in choice_str or 
        '?' in choice_str or 
        '.pdf' in choice_str.lower() or 
        not any(c.isdigit() for c in choice_str)
    )
    if is_url_or_text and not re.match(r'^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$', choice_str):
        pattern = choice_str.lower()
        return [p for p in pdf_list if pattern in p['url'].lower() or pattern in p['filename'].lower() or pattern in p['title'].lower()]

    # 4. Numeric indices and ranges (e.g. 1, 3, 5-8)
    selected_indices = set()
    parts = [p.strip() for p in choice_str.split(',') if p.strip()]
    for part in parts:
        if '-' in part:
            sub = part.split('-')
            if len(sub) == 2 and sub[0].strip().isdigit() and sub[1].strip().isdigit():
                start = int(sub[0].strip())
                end = int(sub[1].strip())
                for num in range(min(start, end), max(start, end) + 1):
                    if 1 <= num <= len(pdf_list):
                        selected_indices.add(num - 1)
        elif part.isdigit():
            num = int(part)
            if 1 <= num <= len(pdf_list):
                selected_indices.add(num - 1)

    return [pdf_list[i] for i in sorted(selected_indices)]

def main():
    print("=" * 60)
    print("           FAST AUTOMATED PDF BATCH DOWNLOADER           ")
    print("=" * 60)

    # Check for help flags
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h", "help"]:
        print("\nUsage:")
        print("  python pdf_downloader.py <URL>")
        print("  python pdf_downloader.py")
        print("\nExamples:")
        print("  python pdf_downloader.py https://example.com/reports")
        print("  python pdf_downloader.py https://arxiv.org/list/cs/recent\n")
        sys.exit(0)

    # Get URL from argument or user input
    if len(sys.argv) > 1:
        target_url = sys.argv[1].strip()
    else:
        target_url = input("\nEnter Webpage URL to scan: ").strip()

    if not target_url:
        print("[!] No URL provided. Exiting.")
        sys.exit(1)

    if not target_url.startswith(('http://', 'https://')):
        target_url = 'https://' + target_url

    print(f"\n[*] Scanning: {target_url}")
    print("[*] Parsing webpage content...")

    try:
        html = fetch_html(target_url)
    except Exception as e:
        print(f"[!] Failed to fetch webpage: {e}")
        sys.exit(1)

    pdf_list = find_pdf_links(target_url, html)

    if not pdf_list:
        print("\n[!] No PDF links found on this webpage.")
        print("Tip: If the page loads PDFs via JavaScript/buttons, use our Web App dashboard.")
        sys.exit(0)

    print(f"\n[+] Found {len(pdf_list)} PDF documents:")
    for idx, item in enumerate(pdf_list, 1):
        url_str = item['url']
        if len(url_str) > 68:
            url_display = f"{url_str[:32]} ... {url_str[-28:]}"
        else:
            url_display = url_str
        print(f"  {idx:2d}. {item['filename']} -> {url_display}")

    output_dir = os.path.join(os.getcwd(), "downloads")
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n[*] Destination Folder: {output_dir}")

    print("\nSelective Download Options:")
    print("  - Press Enter or 'Y' to download ALL")
    print("  - Filter by URL pattern (e.g. url:/reports/ or /2024/)")
    print("  - Filter by keyword (e.g. annual or invoice)")
    print("  - Enter specific numbers (e.g. 1, 3, 7)")
    print("  - Enter ranges (e.g. 1-5, 8-10)")
    
    choice = input("\nYour selection (or 'n' to cancel): ").strip()
    if choice.lower() == 'n':
        print("Download canceled.")
        sys.exit(0)

    selected_items = parse_selection(choice, pdf_list)

    if not selected_items:
        print("[!] No documents matched your selection criteria. Exiting.")
        sys.exit(0)

    print(f"\n[*] Selected {len(selected_items)} PDF(s) to download:")
    for item in selected_items:
        print(f"  • {item['filename']} ({item['url']})")

    print(f"\n[*] Starting parallel download of {len(selected_items)} selected PDF(s)...")
    start_time = time.time()
    successful = 0
    total_bytes = 0

    # Download with ThreadPool for fast parallel speeds
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(download_file, item, output_dir): item for item in selected_items}
        for future in as_completed(futures):
            res = future.result()
            if res["success"]:
                successful += 1
                total_bytes += res["size"]
                print(f"  ✓ Downloaded: {res['filename']} ({format_size(res['size'])})")
            else:
                print(f"  ✗ Failed: {res['filename']} - Reason: {res['error']}")

    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"  SUMMARY: {successful}/{len(selected_items)} files downloaded successfully")
    print(f"  Total Data: {format_size(total_bytes)}")
    print(f"  Time Taken: {elapsed:.2f} seconds")
    print(f"  Files saved in: {output_dir}")
    print("=" * 60)

if __name__ == "__main__":
    main()
