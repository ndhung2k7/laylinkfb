// Service worker for Chrome Extension
let checkInterval = null;

chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.set({ 
    isRunning: false,
    collectedUrls: [],
    lastUrl: {}
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'newUrl') {
    saveUrl(request.url, request.platform, sender.tab.id);
    sendResponse({ success: true });
  }
  return true;
});

function saveUrl(url, platform, tabId) {
  chrome.storage.local.get(['isRunning', 'collectedUrls'], (result) => {
    if (!result.isRunning) return;
    
    let urls = result.collectedUrls || [];
    const timestamp = new Date().toISOString();
    const formattedLink = `[${timestamp}] - [${platform}] - ${url}`;
    
    // Check for duplicates
    const isDuplicate = urls.some(existing => 
      existing.includes(url) || url.includes(existing.split(' - ')[2])
    );
    
    if (!isDuplicate) {
      urls.push(formattedLink);
      chrome.storage.local.set({ collectedUrls: urls }, () => {
        console.log(`[Saved] ${formattedLink}`);
        
        // Notify popup to update stats
        chrome.runtime.sendMessage({ action: 'updateStats' });
        
        // Optional: Show notification
        chrome.action.setBadgeText({ text: urls.length.toString(), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#4caf50', tabId });
      });
    } else {
      console.log(`[Duplicate skipped] ${url}`);
    }
  });
}
