if (!window.legalGuardianInjected) {
  window.legalGuardianInjected = true;

  const BTN_ID = 'legal-guardian-floating-btn';
  const MODAL_ID = 'legal-guardian-modal-overlay';

  let selectedText = "";
  let floatingBtn = null;

  function getPageContent() {

    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
      return { text: selection, type: 'selection' };
    }

    if (window.location.hostname.includes('mail.google.com')) {

      const emailBodies = document.querySelectorAll('.a3s');
      if (emailBodies.length > 0) {

        const latestBody = emailBodies[emailBodies.length - 1];
        return { text: latestBody.innerText, type: 'gmail' };
      }
    }

    return { text: document.body.innerText, type: 'page' };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageContent") {
      sendResponse(getPageContent());
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (floatingBtn && floatingBtn.contains(e.target)) return;
    if (document.getElementById(MODAL_ID)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length === 0) {
        if (floatingBtn) {
          floatingBtn.remove();
          floatingBtn = null;
        }
        return;
      }

      if (text.length < 15) return;

      selectedText = text;

      if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = BTN_ID;
        floatingBtn.innerHTML = '⚖️ Explain';
        floatingBtn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Prevent text deselection
        });
        floatingBtn.addEventListener('click', handleExplainClick);
        document.body.appendChild(floatingBtn);
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      floatingBtn.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 45}px`;
      floatingBtn.style.top = `${rect.top + window.scrollY - 40}px`;

    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatingBtn && !floatingBtn.contains(e.target)) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  });

  function openModalAndScan(textToScan) {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }

    if (document.getElementById(MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const modalContainer = document.createElement('div');
    modalContainer.style.position = 'relative';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '12px';
    closeBtn.style.right = '12px';
    closeBtn.style.width = '28px';
    closeBtn.style.height = '28px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.transition = 'background 0.2s';
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.addEventListener('click', () => overlay.remove());

    const iframe = document.createElement('iframe');
    iframe.id = 'legal-guardian-modal-iframe';
    iframe.src = chrome.runtime.getURL('popup.html?mode=iframe');

    modalContainer.appendChild(iframe);
    modalContainer.appendChild(closeBtn);
    overlay.appendChild(modalContainer);
    document.body.appendChild(overlay);

    iframe.onload = () => {
      iframe.contentWindow.postMessage({
        action: 'analyzeSelection',
        text: textToScan
      }, '*');
    };
  }

  function handleExplainClick(e) {
    e?.preventDefault();
    e?.stopPropagation(); 
    openModalAndScan(selectedText);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanContextMenuText") {
      openModalAndScan(request.text);
    }
  });

  function scanForAgreements() {

    if (sessionStorage.getItem('legalGuardianAlertShown')) return true;

    const ignoredDomains = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'ecosia.org', 'mail.google.com'];
    if (ignoredDomains.some(domain => window.location.hostname.includes(domain))) {
      return true; // Pretend we found it so polling stops
    }

    const exactKeywords = ['terms', 'privacy', 'legal'];
    const includesKeywords = ['terms of service', 'terms and conditions', 'privacy policy', 'terms of use', 'cookies policy', 'cookie policy'];

    const links = Array.from(document.querySelectorAll('a'));

    let targetLink = null;
    let isPdf = false;

    for (const link of links) {
      if (!link.href) continue;

      if (link.href.toLowerCase().split('?')[0].endsWith('.pdf')) {
        targetLink = link;
        isPdf = true;
        break;
      }

      const text = link.innerText.toLowerCase().trim();
      if (!text) continue;

      if (exactKeywords.includes(text) || includesKeywords.some(kw => text.includes(kw))) {
        targetLink = link;
        break;
      }
    }

    if (targetLink) {
      showToast(targetLink, isPdf);
      return true;
    }
    return false;
  }

  function showToast(linkElement, isPdf = false) {

    sessionStorage.setItem('legalGuardianAlertShown', 'true');

    const toast = document.createElement('div');
    toast.id = 'legal-guardian-toast';
    const docName = isPdf ? "PDF Document" : `legal agreement ("${linkElement.innerText.trim()}")`;
    toast.innerHTML = `
      <div class="lg-toast-header">
        <span class="lg-toast-icon">⚖️</span>
        <span>Legal Guardian</span>
      </div>
      <div class="lg-toast-body">
        We detected a ${docName}. Would you like to scan it for hidden risks?
      </div>
      <div class="lg-toast-actions">
        <button id="lg-toast-scan" class="lg-toast-btn primary">Scan Page</button>
        <button id="lg-toast-dismiss" class="lg-toast-btn secondary">Dismiss</button>
      </div>
    `;

    document.body.appendChild(toast);

    document.getElementById('lg-toast-dismiss').addEventListener('click', () => {
      toast.remove();
    });

    document.getElementById('lg-toast-scan').addEventListener('click', () => {
      toast.remove();

      const href = linkElement.href;

      if (href && href.startsWith('http')) {
        const loadingToast = document.createElement('div');
        loadingToast.id = 'legal-guardian-toast';
        loadingToast.innerHTML = `<div class="lg-toast-body">Fetching ${isPdf ? 'and parsing PDF' : 'document'}... This might take a moment.</div>`;
        document.body.appendChild(loadingToast);

        const action = isPdf ? "fetchUrlAndUploadPdf" : "fetchUrlContent";

        chrome.runtime.sendMessage({ action: action, url: href }, (response) => {
          loadingToast.remove();

          if (response && response.success && response.text && response.text.length > 50) {

            openModalAndScan(response.text);
          } else {
            console.error("⚖️ Legal Guardian Fetch Error:", response?.error || "Text too short or missing.");
            showErrorToast(`Legal Guardian couldn't read that ${isPdf ? 'PDF' : 'page'} automatically. Please open the link and analyze it manually.`);
          }
        });
      } else {

        console.error("⚖️ Legal Guardian Link Error: Invalid href", href);
        showErrorToast("This link is hidden behind a script. Please manually open the link and click the Legal Guardian extension to scan it.");
      }
    });
  }

  function showErrorToast(message) {

    const existing = document.getElementById('legal-guardian-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'legal-guardian-toast';
    toast.style.border = '1px solid #ef4444'; // Red border for error
    toast.innerHTML = `
      <div class="lg-toast-header" style="color: #ef4444;">
        <span class="lg-toast-icon">⚠️</span>
        <span>Legal Guardian Error</span>
      </div>
      <div class="lg-toast-body">
        ${message}
      </div>
      <div class="lg-toast-actions">
        <button id="lg-error-dismiss" class="lg-toast-btn secondary">Dismiss</button>
      </div>
    `;

    document.body.appendChild(toast);
    document.getElementById('lg-error-dismiss').addEventListener('click', () => toast.remove());

    setTimeout(() => {
      if (document.body.contains(toast)) toast.remove();
    }, 6000);
  }

  let scanAttempts = 0;
  const maxAttempts = 5;
  const scanInterval = setInterval(() => {
    scanAttempts++;
    const found = scanForAgreements();
    if (found || scanAttempts >= maxAttempts) {
      clearInterval(scanInterval);
    }
  }, 2000);
}
