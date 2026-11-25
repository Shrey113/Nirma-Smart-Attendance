/**
 * Nirma Smart Attendance - Simplified Popup Script
 * Focused on core student query: Course Name, Code, and "How many leaves can I take?"
 */

document.addEventListener('DOMContentLoaded', async () => {
  const inactiveState = document.getElementById('inactiveState');
  const activeState = document.getElementById('activeState');
  const btnOpenAttendancePage = document.getElementById('btnOpenAttendancePage');
  const btnOpenCachedDashboard = document.getElementById('btnOpenCachedDashboard');
  const cachedOptionBox = document.getElementById('cachedOptionBox');
  const btnOpenFullDashboard = document.getElementById('btnOpenFullDashboard');
  const subjectScrollList = document.getElementById('subjectScrollList');
  const targetButtons = document.querySelectorAll('.nsa-target-btn');

  let currentTarget = 85;
  if (window.AttendanceStorage) {
    currentTarget = await window.AttendanceStorage.getTargetPercentage();
  }

  // Synchronize target toggle buttons
  updateTargetButtonsUI(currentTarget);

  targetButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentTarget = Number(btn.getAttribute('data-target'));
      updateTargetButtonsUI(currentTarget);
      if (window.AttendanceStorage) {
        await window.AttendanceStorage.setTargetPercentage(currentTarget);
      }
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: 'SET_TARGET', target: currentTarget }, () => {
          fetchAndRenderAttendance(activeTabId);
        });
      }
    });
  });

  function updateTargetButtonsUI(target) {
    targetButtons.forEach(btn => {
      if (Number(btn.getAttribute('data-target')) === target) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 1. Immediately render cached data if available (zero wait)
  if (window.AttendanceStorage) {
    const cache = await window.AttendanceStorage.getAttendanceData();
    if (cache && cache.records && cache.records.length > 0) {
      renderPopupView(cache.records);
    }
  }

  // 2. Query active tab
  let activeTab = null;
  let activeTabId = null;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs && tabs[0] ? tabs[0] : null;
    activeTabId = activeTab ? activeTab.id : null;
  } catch (err) {
    console.error('[NSA] Error querying active tab:', err);
  }

  const activeUrl = activeTab && activeTab.url ? activeTab.url.toLowerCase() : '';
  const isAttendanceUrl = activeUrl.includes('studentattendancereport') || activeUrl.includes('nirmauni.ac.in');

  if (!isAttendanceUrl) {
    inactiveState.style.display = 'flex';
    activeState.style.display = 'none';

    btnOpenAttendancePage.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx' });
      window.close();
    });

    if (window.AttendanceStorage) {
      const cache = await window.AttendanceStorage.getAttendanceData();
      if (cache && cache.records && cache.records.length > 0) {
        cachedOptionBox.style.display = 'block';
        btnOpenCachedDashboard.addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
          window.close();
        });
      }
    }
  } else {
    inactiveState.style.display = 'none';
    activeState.style.display = 'flex';

    if (btnOpenFullDashboard) {
      btnOpenFullDashboard.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
        window.close();
      });
    }

    fetchAndRenderAttendance(activeTabId);
  }

  function fetchAndRenderAttendance(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'GET_ATTENDANCE_DATA' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.records || response.records.length === 0) {
        injectAndExtract(tabId);
        return;
      }
      renderPopupView(response.records);
    });
  }

  async function injectAndExtract(tabId) {
    if (!chrome.scripting) {
      renderFromStorageFallback();
      return;
    }

    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId, allFrames: true },
        files: ['content/styles.css']
      });

      await chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: [
          'utils/calculations.js',
          'utils/storage.js',
          'content/attendance-detector.js',
          'content/attendance-calculator.js',
          'content/page-integration.js'
        ]
      });

      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'GET_ATTENDANCE_DATA' }, (resp) => {
          if (resp && resp.records && resp.records.length > 0) {
            renderPopupView(resp.records);
          } else {
            renderFromStorageFallback();
          }
        });
      }, 400);
    } catch (e) {
      renderFromStorageFallback();
    }
  }

  async function renderFromStorageFallback() {
    if (window.AttendanceStorage) {
      const cache = await window.AttendanceStorage.getAttendanceData();
      if (cache && cache.records && cache.records.length > 0) {
        renderPopupView(cache.records);
        return;
      }
    }
    subjectScrollList.innerHTML = `
      <div class="nsa-loading">
        No attendance records found yet.<br>
        <span style="font-size:10.5px; color:#64748b; margin-top:4px; display:inline-block;">
          Refresh the attendance page (F5) to scan.
        </span>
      </div>
    `;
  }

  function renderPopupView(records) {
    if (!records || records.length === 0) {
      subjectScrollList.innerHTML = `<div class="nsa-loading">No courses detected.</div>`;
      return;
    }

    const calc = window.AttendanceCalculations;
    document.getElementById('subjectCountBadge').textContent = `${records.length} courses`;

    let html = '';
    records.forEach(rec => {
      const p = Number(rec.present) || 0;
      const t = Number(rec.total) || 0;
      const pct = calc ? calc.calculatePercentage(p, t) : Math.round((p / (t || 1)) * 100);
      const isBelow = pct < currentTarget;
      const safeLeaves = calc ? calc.calculateSafeBunks(p, t, currentTarget) : 0;
      const needClasses = calc ? calc.calculateRequiredClasses(p, t, currentTarget) : 0;

      // Projected if student takes leaves:
      const if1Leave = calc ? calc.calculatePercentage(p, t + 1) : 0;
      const if2Leaves = calc ? calc.calculatePercentage(p, t + 2) : 0;
      const if3Leaves = calc ? calc.calculatePercentage(p, t + 3) : 0;

      // Projected if student attends:
      const ifAttend1 = calc ? calc.calculatePercentage(p + 1, t + 1) : 0;
      const ifAttend2 = calc ? calc.calculatePercentage(p + 2, t + 2) : 0;

      const typeBadge = rec.loadType === 'Practical' ? 'nsa-type-prac' : 'nsa-type-lec';

      html += `
        <div class="nsa-card" data-subject-id="${rec.id || ''}">
          <!-- Card Top: Name, Code, % -->
          <div class="nsa-card-top">
            <div class="nsa-card-info">
              <span class="nsa-card-name" title="${rec.courseName}">${rec.courseName}</span>
              <div class="nsa-card-meta">
                <span>${rec.courseCode || ''}</span>
                <span class="nsa-badge-type ${typeBadge}">${rec.loadType}</span>
              </div>
            </div>
            <span class="nsa-card-pct" style="color: ${isBelow ? '#dc2626' : '#059669'};">
              ${pct}%
            </span>
          </div>

          <!-- The Core Answer: How many leaves can I take? -->
          <div class="nsa-leave-pill ${isBelow ? 'nsa-pill-danger' : 'nsa-pill-safe'}">
            <span>
              ${isBelow ? `🔴 Need to attend ${needClasses} more` : (safeLeaves > 0 ? `🟢 ${safeLeaves} Leave${safeLeaves > 1 ? 's' : ''} Allowed` : `🟡 0 Leaves Allowed (Attend all)`)}
            </span>
            <span class="nsa-pill-sessions">${p}/${t} sessions</span>
          </div>

          <!-- Simple 1-Click Simulation Chips -->
          <div class="nsa-sim-chips">
            ${!isBelow ? `
              <span class="nsa-chip" title="If you miss 1 class">
                Take 1 leave: <span class="nsa-chip-val" style="color:${if1Leave < currentTarget ? '#dc2626' : '#059669'}">${if1Leave}%</span>
              </span>
              <span class="nsa-chip" title="If you miss 2 classes">
                2 leaves: <span class="nsa-chip-val" style="color:${if2Leaves < currentTarget ? '#dc2626' : '#059669'}">${if2Leaves}%</span>
              </span>
              <span class="nsa-chip" title="If you miss 3 classes">
                3 leaves: <span class="nsa-chip-val" style="color:${if3Leaves < currentTarget ? '#dc2626' : '#059669'}">${if3Leaves}%</span>
              </span>
            ` : `
              <span class="nsa-chip" title="If you attend 1 class">
                Attend +1: <span class="nsa-chip-val" style="color:${ifAttend1 >= currentTarget ? '#059669' : '#dc2626'}">${ifAttend1}%</span>
              </span>
              <span class="nsa-chip" title="If you attend 2 classes">
                Attend +2: <span class="nsa-chip-val" style="color:${ifAttend2 >= currentTarget ? '#059669' : '#dc2626'}">${ifAttend2}%</span>
              </span>
              <span class="nsa-chip" title="If you miss 1 more class">
                Miss 1: <span class="nsa-chip-val" style="color:#dc2626">${if1Leave}%</span>
              </span>
            `}
          </div>
        </div>
      `;
    });

    subjectScrollList.innerHTML = html;

    document.querySelectorAll('.nsa-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-subject-id');
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { action: 'OPEN_DRAWER', focusSubjectId: id });
          window.close();
        }
      });
    });
  }
});
