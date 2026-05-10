document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyze-btn');
  const backBtn = document.getElementById('back-btn');
  const retryBtn = document.getElementById('retry-btn');

  const initialState = document.getElementById('initial-state');
  const loadingState = document.getElementById('loading-state');
  const resultsState = document.getElementById('results-state');
  const errorState = document.getElementById('error-state');
  const chatState = document.getElementById('chat-state');

  const openChatBtn = document.getElementById('open-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');

  let currentContractText = "";
  let chatHistory = [];
  let currentTabUrl = ""; // For caching

  const logoContainer = document.getElementById('logo-container');
  if (logoContainer) {
    const img = new Image();
    img.onload = () => {
      img.className = 'app-logo';
      img.alt = 'Legal Guardian Logo';
      logoContainer.innerHTML = '';
      logoContainer.appendChild(img);
    };
    img.src = 'logo.png';
  }

  const globalHeaderImg = document.getElementById('global-header-img');
  const globalHeaderFallback = document.getElementById('global-header-fallback');
  if (globalHeaderImg) {
    const globalImg = new Image();
    globalImg.onload = () => {
      globalHeaderImg.src = 'logo.png';
      globalHeaderImg.style.display = 'block';
      if (globalHeaderFallback) globalHeaderFallback.style.display = 'none';
    };
    globalImg.onerror = () => {
      globalHeaderImg.style.display = 'none';
      if (globalHeaderFallback) globalHeaderFallback.style.display = 'block';
    };
    globalImg.src = 'logo.png';
  }

  const langPills = document.querySelectorAll('.lang-pill');
  let currentLanguage = 'English';

  chrome.storage.local.get(['language'], (result) => {
    if (result.language) {
      currentLanguage = result.language;
      langPills.forEach(p => {
        if (p.dataset.lang === currentLanguage) p.classList.add('active');
        else p.classList.remove('active');
      });
    }
  });

  langPills.forEach(pill => {
    pill.addEventListener('click', () => {
      langPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentLanguage = pill.dataset.lang;
      chrome.storage.local.set({ language: currentLanguage });
    });
  });

  const globalHeader = document.getElementById('global-header');

  function showState(stateElement) {
    document.querySelectorAll('.state-panel').forEach(panel => panel.classList.remove('active'));
    stateElement.classList.add('active');

    if (globalHeader) {
      if (stateElement.id === 'initial-state') {
        globalHeader.style.display = 'none';
      } else {
        globalHeader.style.display = 'flex';
      }
    }
  }

  openChatBtn.addEventListener('click', () => {
    showState(chatState);
    chatInput.focus();
  });

  closeChatBtn.addEventListener('click', () => {
    showState(resultsState);
  });

  function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    msgDiv.innerHTML = `<div class="message-content">${text}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    appendMessage(question, 'user');
    chatInput.value = '';

    chatInput.disabled = true;

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.textContent = 'Legal Guardian is typing...';
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    chrome.runtime.sendMessage({
      action: "chatWithAI",
      contractText: currentContractText,
      question: question,
      history: chatHistory,
      language: currentLanguage
    }, (response) => {

      const ind = document.getElementById('typing-indicator');
      if (ind) ind.remove();

      chatInput.disabled = false;
      chatInput.focus();

      if (chrome.runtime.lastError || !response.success) {
        appendMessage(response?.error || "Error connecting to AI.", 'ai');
        return;
      }

      const answer = response.data.answer;
      appendMessage(answer, 'ai');

      chatHistory.push({ role: 'user', content: question });
      chatHistory.push({ role: 'model', content: answer });
    });
  });

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  const exportPdfBtn = document.getElementById('export-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      if (currentTabUrl) {
        chrome.tabs.create({ url: `popup.html?print=true&url=${encodeURIComponent(currentTabUrl)}` });
      } else {
        window.print();
      }
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = `tab-${btn.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');
    });
  });

  function renderResults(data) {

    const riskScoreData = data.riskScore || {};
    const scoreVal = riskScoreData.score || 0;

    const label = riskScoreData.label || riskScoreData.level?.label || 'Low';

    let riskLevel = 'low';
    if (label === 'Moderate' || label === 'Medium') riskLevel = 'medium';
    else if (label === 'High') riskLevel = 'high';

    const circle = document.getElementById('score-progress-circle');
    const scoreText = document.getElementById('risk-score');

    if (circle) circle.classList.remove('score-low', 'score-medium', 'score-high');
    if (scoreText) scoreText.classList.remove('score-low', 'score-medium', 'score-high');

    if (circle) circle.classList.add(`score-${riskLevel}`);
    if (scoreText) scoreText.classList.add(`score-${riskLevel}`);

    const percentage = scoreVal * 10;
    const offset = 264 - (264 * Math.min(100, Math.max(0, percentage))) / 100;
    setTimeout(() => {
      if (circle) circle.style.strokeDashoffset = offset;
    }, 100);

    if (scoreText) scoreText.textContent = `${scoreVal}`;

    const kiParties = document.getElementById('ki-parties');
    const kiType = document.getElementById('ki-type');
    const kiDates = document.getElementById('ki-dates');
    if (kiParties) kiParties.textContent = data.parties?.length ? data.parties.join(', ') : 'Not specified';
    if (kiType) kiType.textContent = data.contractType || 'General';
    if (kiDates) kiDates.textContent = data.keyDates?.length ? `${data.keyDates.length} found` : 'None identified';

    const summaryContent = document.getElementById('summary-text');
    if (summaryContent) {
      if (Array.isArray(data.summary)) {
        summaryContent.innerHTML = data.summary.map(s => `<p>${s}</p>`).join('<br>');
      } else if (data.summary && typeof data.summary === 'object') {
        summaryContent.innerHTML = `
          <p>${data.summary.what || 'No summary available.'}</p>
          <p>${data.summary.biggest_risk ? `<br><strong>Biggest Risk:</strong> ${data.summary.biggest_risk}` : ''}</p>
        `;
      } else if (typeof data.summary === 'string') {
        summaryContent.innerHTML = `<p>${data.summary}</p>`;
      } else {
        summaryContent.innerHTML = '<p>Could not generate summary.</p>';
      }
    }

    const prosList = document.getElementById('pros-list');
    prosList.innerHTML = '';
    if (data.pros && data.pros.length > 0) {
      data.pros.forEach(pro => {
        const card = document.createElement('div');
        card.className = 'point-card';
        card.innerHTML = `
          <div class="point-header">
            <div class="point-title pro-title">${pro.clause || 'Benefit'}</div>
          </div>
          <div class="point-body">${pro.explanation || pro}</div>
        `;
        prosList.appendChild(card);
      });
    } else {
      prosList.innerHTML = '<div class="point-card"><div class="point-body">No significant advantages identified.</div></div>';
    }

    const consList = document.getElementById('cons-list');
    consList.innerHTML = '';
    if (data.cons && data.cons.length > 0) {
      data.cons.forEach(con => {
        const card = document.createElement('div');
        card.className = 'point-card';
        const severityStr = con.severity ? `<span class="severity-badge ${con.severity.toLowerCase()}">${con.severity}</span>` : '';
        card.innerHTML = `
          <div class="point-header">
            <div class="point-title con-title">${con.clause || 'Risk'}</div>
            ${severityStr}
          </div>
          <div class="point-body">${con.explanation || con}</div>
        `;
        consList.appendChild(card);
      });
    } else {
      consList.innerHTML = '<div class="point-card"><div class="point-body">No significant concerns identified.</div></div>';
    }

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="summary"]').classList.add('active');
    document.getElementById('tab-summary').classList.add('active');

    showState(resultsState);
  }

  function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.textContent = message || "An unknown error occurred.";
    showState(errorState);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isIframe = urlParams.get('mode') === 'iframe';
  const isPrintMode = urlParams.get('print') === 'true';
  const passedUrl = urlParams.get('url');

  if (isPrintMode && passedUrl) {
    currentTabUrl = passedUrl;
    
    // Check Cache
    chrome.storage.local.get(['lg_cache_' + currentTabUrl], (result) => {
      const cache = result['lg_cache_' + currentTabUrl];
      if (cache && cache.data && cache.text) {
        currentContractText = cache.text;
        renderResults(cache.data);
        
        // Hide unnecessary UI elements
        const header = document.querySelector('header');
        if (header) header.style.display = 'none';
        backBtn.style.display = 'none';
        const actions = document.querySelector('.results-actions');
        if (actions) actions.style.display = 'none';
        
        const scoreCard = document.querySelector('.score-card');
        if (scoreCard) scoreCard.style.display = 'none';

        // Force all tabs to be visible
        document.querySelectorAll('.tab-content').forEach(c => {
          c.classList.add('active');
          c.style.display = 'block';
        });
        
        // Optimize body for printing
        document.body.style.width = '100%';
        document.body.style.height = 'auto';
        document.body.style.overflow = 'visible';
        document.querySelector('.container').style.height = 'auto';
        document.querySelector('.container').style.overflow = 'visible';

        // Trigger print after render
        setTimeout(() => {
          window.print();
        }, 800);
      } else {
        showError("Could not find data to print.");
      }
    });
  } else if (isIframe) {

    document.querySelector('header').style.display = 'none';
    backBtn.style.display = 'none';

    window.addEventListener('message', (event) => {
      if (event.data && event.data.action === 'analyzeSelection') {
        runAnalysis(event.data.text);
      }
    });
  } else {

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) return;
      currentTabUrl = tab.url; // Save url globally

      chrome.storage.local.get(['lg_cache_' + currentTabUrl], async (result) => {
        const cache = result['lg_cache_' + currentTabUrl];
        if (cache && cache.data && cache.text) {
          currentContractText = cache.text;
          renderResults(cache.data);
          return; // Skip normal initialization
        }

        try {

          let contentObj = await getPageContentFromTab(tab.id);

          if (contentObj.type === 'selection') {
            analyzeBtn.textContent = '⚖️ Explain Selection';
            document.querySelector('.description').textContent = 'Analyze your highlighted text.';
          } else if (contentObj.type === 'gmail') {
            analyzeBtn.textContent = 'Analyze Email';
            document.querySelector('.description').textContent = 'Extract and analyze this email for sponsorship risks.';
          }
        } catch (e) {

        }
      });
    });
  }

  async function getPageContentFromTab(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "getPageContent" }, (response) => {
        if (chrome.runtime.lastError) {

          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {

            chrome.tabs.sendMessage(tabId, { action: "getPageContent" }, (res) => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(res);
            });
          }).catch(reject);
        } else {
          resolve(response);
        }
      });
    });
  }

  async function handleAnalyzeClick() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("No active tab found.");

      const isPdf = tab.url && tab.url.toLowerCase().split('?')[0].endsWith('.pdf');

      if (isPdf) {
        showState(loadingState);
        chrome.runtime.sendMessage({ action: "fetchUrlAndUploadPdf", url: tab.url }, (response) => {
          if (response && response.success && response.text && response.text.length > 50) {
            runAnalysis(response.text);
          } else {
            showError("Legal Guardian couldn't extract text from this PDF. It might be scanned or protected.");
          }
        });
        return;
      }

      const contentObj = await getPageContentFromTab(tab.id);

      if (!contentObj || !contentObj.text || contentObj.text.trim().length < 15) {
        throw new Error("Could not find enough text. Please highlight some text or open an email.");
      }

      runAnalysis(contentObj.text);
    } catch (error) {
      showError(error.message);
    }
  }

  function runAnalysis(extractedText) {

    currentContractText = extractedText;
    chatHistory = [];
    chatMessages.innerHTML = `
      <div class="message ai-message">
        <div class="message-content">Hello! I've analyzed the document. What would you like to know?</div>
      </div>
    `;

    showState(loadingState);

    const steps = [
      document.getElementById('step-1'),
      document.getElementById('step-2'),
      document.getElementById('step-3')
    ];

    steps.forEach(step => {
      step.classList.remove('active-step', 'done-step');
      const icon = step.querySelector('.step-icon');
      icon.className = 'step-icon step-pending';
      icon.textContent = '○';
    });

    steps[0].classList.add('active-step');
    steps[0].querySelector('.step-icon').className = 'step-icon step-active';

    setTimeout(() => {
      steps[0].classList.replace('active-step', 'done-step');
      const icon1 = steps[0].querySelector('.step-icon');
      icon1.className = 'step-icon step-done';
      icon1.textContent = '✓';

      steps[1].classList.add('active-step');
      steps[1].querySelector('.step-icon').className = 'step-icon step-active';
    }, 600);

    chrome.runtime.sendMessage(
      {
        action: "analyzeText",
        text: extractedText,
        userType: 'general',
        language: currentLanguage
      },
      (response) => {
        setTimeout(() => {
          if (chrome.runtime.lastError) {
            showError("Extension error: " + chrome.runtime.lastError.message);
            return;
          }

          if (response && response.success) {

            if (currentTabUrl) {
              const cacheData = {};
              cacheData['lg_cache_' + currentTabUrl] = {
                data: response.data,
                text: extractedText,
                timestamp: Date.now()
              };
              chrome.storage.local.set(cacheData);
            }
            renderResults(response.data);
          } else {
            showError(response?.error || "Failed to analyze the document.");
          }
        }, 400);
      }
    );
  }

  analyzeBtn.addEventListener('click', handleAnalyzeClick);
  backBtn.addEventListener('click', () => {

    if (currentTabUrl) {
      chrome.storage.local.remove(['lg_cache_' + currentTabUrl]);
    }

    if (isIframe) {
      showState(initialState);
    } else {
      showState(initialState);
    }
  });
  retryBtn.addEventListener('click', () => showState(initialState));
});
