/**
 * Nirma Smart Attendance - Background Service Worker (Manifest V3)
 * Manages tab tracking, badge notifications, and lifecycle events.
 */

const TARGET_URL_PATTERN = 'https://mis.nirmauni.ac.in/reports/studentattendancereport.aspx';

// Handle extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[NSA] Extension installed/updated:', details.reason);
  // Set default initial settings
  chrome.storage.local.get(['nsa_target_percentage'], (res) => {
    if (!res.nsa_target_percentage) {
      chrome.storage.local.set({ nsa_target_percentage: 85 });
    }
  });
});

// Helper to determine if a URL is the Nirma attendance page
function isAttendanceUrl(url) {
  if (!url) return false;
  return url.toLowerCase().includes('studentattendancereport.aspx') &&
         url.toLowerCase().includes('nirmauni.ac.in');
}

// Update extension icon badge based on active tab URL
async function updateTabBadge(tabId, url) {
  if (isAttendanceUrl(url)) {
    chrome.action.setBadgeText({ tabId, text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' }); // Emerald Green
    chrome.action.setTitle({ tabId, title: 'Nirma Smart Attendance: Active on Attendance Page' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'Nirma Smart Attendance (Inactive - open Attendance Report)' });
  }
}

// Listen to tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBadge(tabId, tab.url || changeInfo.url);
  }
});

// Listen to tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      updateTabBadge(activeInfo.tabId, tab.url);
    }
  } catch (err) {
    // Tab might have closed
  }
});

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CHECK_IS_ATTENDANCE_PAGE') {
    sendResponse({ isAttendancePage: isAttendanceUrl(request.url) });
    return true;
  }
  if (request.action === 'OPEN_ATTENDANCE_TAB') {
    chrome.tabs.create({ url: 'https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx' });
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'OPEN_DASHBOARD_TAB') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    sendResponse({ success: true });
    return true;
  }
});
