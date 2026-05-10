const API_BASE_URL = "https://legal-gurdian.onrender.com";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeText") {
    const text = request.text;

    fetch(`${API_BASE_URL}/api/ai/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contractText: text,
        filename: "Website Privacy Policy",
        userType: request.userType || "general",
        language: request.language || "English"
      })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.action === "chatWithAI") {
    fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contractText: request.contractText,
        question: request.question,
        history: request.history || [],
        language: request.language || "English"
      })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.action === "fetchUrlContent") {
    fetch(request.url)
      .then(response => response.text())
      .then(html => {

        const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        sendResponse({ success: true, text: text });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === "fetchUrlAndUploadPdf") {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        const formData = new FormData();
        formData.append("contract", blob, "document.pdf");

        return fetch(`${API_BASE_URL}/api/upload`, {
          method: "POST",
          body: formData
        });
      })
      .then(response => response.json())
      .then(data => {
        if (data.text) {
          sendResponse({ success: true, text: data.text });
        } else {
          sendResponse({ success: false, error: "Failed to extract text from PDF." });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scanWithLegalGuardian",
    title: "Scan with Legal Guardian",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scanWithLegalGuardian" && info.selectionText) {
    const sendMsg = () => {
      chrome.tabs.sendMessage(tab.id, {
        action: "scanContextMenuText",
        text: info.selectionText
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Script not injected, try to inject it
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content.css']
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: "scanContextMenuText",
                text: info.selectionText
              });
            }, 100);
          }).catch(err => console.error("Could not inject Legal Guardian:", err));
        }
      });
    };
    sendMsg();
  }
});
