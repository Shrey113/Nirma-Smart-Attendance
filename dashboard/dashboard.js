/**
 * Nirma Smart Attendance - Full Dashboard Script
 * Manages full-screen analytics, batch simulations, filtering, and printing.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const dashTargetSelect = document.getElementById('dashTargetSelect');
  const btnPrintReport = document.getElementById('btnPrintReport');
  const btnNavPortal = document.getElementById('btnNavPortal');
  const courseSearchInput = document.getElementById('courseSearchInput');
  const attendanceTableBody = document.getElementById('attendanceTableBody');
  const btnResetBatch = document.getElementById('btnResetBatch');

  let currentTarget = 85;
  let records = [];
  let currentTab = 'all';
  let searchQuery = '';
  let rowSimulations = {}; // { [id]: { miss: 0, attend: 0 } }

  // Load target preference
  if (window.AttendanceStorage) {
    currentTarget = await window.AttendanceStorage.getTargetPercentage();
  }
  if (dashTargetSelect) {
    dashTargetSelect.value = String(currentTarget);
    dashTargetSelect.addEventListener('change', async (e) => {
      currentTarget = Number(e.target.value);
      if (window.AttendanceStorage) {
        await window.AttendanceStorage.setTargetPercentage(currentTarget);
      }
      renderDashboard();
    });
  }

  // Navigation and Print
  btnPrintReport.addEventListener('click', () => window.print());
  btnNavPortal.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx' });
    } else {
      window.open('https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx', '_blank');
    }
  });

  // Load attendance data
  await loadAttendanceData();

  async function loadAttendanceData() {
    if (window.AttendanceStorage) {
      const cache = await window.AttendanceStorage.getAttendanceData();
      if (cache && cache.records && cache.records.length > 0) {
        records = cache.records;
        if (cache.lastUpdated) {
          const dt = new Date(cache.lastUpdated);
          document.getElementById('footerTimestamp').textContent = `Last synchronized: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
        }
      }
    }

    // Try requesting live data if an attendance tab is currently active/open
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ url: '*://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_ATTENDANCE_DATA' }, (res) => {
            if (res && res.records && res.records.length > 0) {
              records = res.records;
              renderDashboard();
            }
          });
        }
      });
    }

    renderDashboard();
  }

  // Filter Tabs
  document.querySelectorAll('.nsa-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nsa-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.getAttribute('data-tab');
      renderTableRows();
    });
  });

  // Search input
  courseSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTableRows();
  });

  // Batch Simulators
  document.querySelectorAll('[data-batch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-batch');
      records.forEach(r => {
        const id = r.id || `${r.courseCode}_${r.loadType}`;
        rowSimulations[id] = rowSimulations[id] || { miss: 0, attend: 0 };
        if (mode === 'miss-1') rowSimulations[id].miss += 1;
        if (mode === 'miss-2') rowSimulations[id].miss += 2;
        if (mode === 'att-3') rowSimulations[id].attend += 3;
        if (mode === 'att-5') rowSimulations[id].attend += 5;
      });
      renderDashboard();
    });
  });

  btnResetBatch.addEventListener('click', () => {
    rowSimulations = {};
    renderDashboard();
  });

  function renderDashboard() {
    renderTopMetrics();
    renderTableRows();
  }

  function renderTopMetrics() {
    const calc = window.AttendanceCalculations;
    if (!calc) return;

    if (!records || records.length === 0) {
      return;
    }

    let totalSafeBunks = 0;
    let lowCount = 0;

    records.forEach(r => {
      const id = r.id || `${r.courseCode}_${r.loadType}`;
      const sim = rowSimulations[id] || { miss: 0, attend: 0 };
      const p = Number(r.present) || 0;
      const t = Number(r.total) || 0;

      const sp = p + sim.attend;
      const st = t + sim.attend + sim.miss;

      const curPct = calc.calculatePercentage(sp, st);
      if (curPct < currentTarget) {
        lowCount++;
      } else {
        totalSafeBunks += calc.calculateSafeBunks(sp, st, currentTarget);
      }
    });

    const mTotal = document.getElementById('metricTotalCourses');
    const mLow = document.getElementById('metricLowCourses');
    const mSafe = document.getElementById('metricTotalSafeBunks');

    if (mTotal) mTotal.textContent = String(records.length);
    if (mLow) mLow.textContent = String(lowCount);
    if (mSafe) mSafe.textContent = String(totalSafeBunks);
  }

  function renderTableRows() {
    const calc = window.AttendanceCalculations;
    if (!calc || !records || records.length === 0) {
      attendanceTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="nsa-table-empty">
            No attendance records found. Open the Nirma Student Attendance Report page to sync data.
          </td>
        </tr>
      `;
      return;
    }

    // Filtering
    let filtered = records.filter(r => {
      // Tab filter
      const p = Number(r.present) || 0;
      const t = Number(r.total) || 0;
      const pct = calc.calculatePercentage(p, t);

      if (currentTab === 'low' && pct >= currentTarget) return false;
      if (currentTab === 'lecture' && r.loadType !== 'Lecture') return false;
      if (currentTab === 'practical' && r.loadType !== 'Practical') return false;

      // Search filter
      if (searchQuery) {
        const text = `${r.courseName} ${r.courseCode} ${r.loadType}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      attendanceTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="nsa-table-empty">
            No courses match the active filter or search query.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(r => {
      const id = r.id || `${r.courseCode}_${r.loadType}`;
      const sim = rowSimulations[id] || { miss: 0, attend: 0 };
      const p = Number(r.present) || 0;
      const t = Number(r.total) || 0;
      const abs = Number(r.absent) || (t - p);

      const basePct = calc.calculatePercentage(p, t);
      const safeBunks = calc.calculateSafeBunks(p, t, currentTarget);
      const reqClasses = calc.calculateRequiredClasses(p, t, currentTarget);

      // What-if simulated stats
      const sp = p + sim.attend;
      const st = t + sim.attend + sim.miss;
      const projPct = calc.calculatePercentage(sp, st);
      const diff = Math.round((projPct - basePct) * 100) / 100;
      const isBelow = projPct < currentTarget;

      const typeTag = r.loadType === 'Practical' ? 'nsa-tag-prac' : 'nsa-tag-lec';

      rowsHtml += `
        <tr data-row-id="${id}">
          <td>
            <div style="font-weight: 700; color: #0f172a;">${r.courseName}</div>
            <div style="font-size: 11px; color: #64748b;">${r.courseCode}</div>
          </td>
          <td>
            <span class="nsa-type-tag ${typeTag}">${r.loadType}</span>
          </td>
          <td><strong>${p}</strong></td>
          <td>${abs}</td>
          <td>${t}</td>
          <td>
            <span style="font-weight: 700; color: ${basePct >= currentTarget ? '#10b981' : '#ef4444'}">
              ${basePct}%
            </span>
          </td>
          <td>
            ${basePct >= currentTarget ? `
              <span class="nsa-badge nsa-badge-safe" title="Can miss ${safeBunks} classes">
                🟢 ${safeBunks} Leave${safeBunks !== 1 ? 's' : ''} Safe
              </span>
            ` : `
              <span class="nsa-badge nsa-badge-danger" title="Attend ${reqClasses} consecutive classes">
                🔴 Need +${reqClasses}
              </span>
            `}
          </td>
          <td>
            <div class="nsa-stepper-inline">
              <span style="font-size: 11px; color:#64748b;">Leaves:</span>
              <div class="nsa-stepper-item">
                <button type="button" data-act="d-miss-dec" data-id="${id}">-</button>
                <span class="nsa-row-miss">${sim.miss}</span>
                <button type="button" data-act="d-miss-inc" data-id="${id}">+</button>
              </div>
              <span style="font-size: 11px; color:#64748b; margin-left: 6px;">Attend:</span>
              <div class="nsa-stepper-item">
                <button type="button" data-act="d-att-dec" data-id="${id}">-</button>
                <span class="nsa-row-att">${sim.attend}</span>
                <button type="button" data-act="d-att-inc" data-id="${id}">+</button>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <span class="nsa-row-proj-pct" style="font-size: 15px; font-weight: 800; color: ${isBelow ? '#ef4444' : '#10b981'}">
                ${projPct}%
              </span>
              <span class="nsa-row-proj-diff" style="font-size: 10.5px; color: ${diff >= 0 ? '#10b981' : '#ef4444'}">
                (${diff >= 0 ? '+' : ''}${diff}%)
              </span>
            </div>
          </td>
        </tr>
      `;
    });

    attendanceTableBody.innerHTML = rowsHtml;
  }

  // Instant in-place row simulator update (0ms latency, zero table rebuild)
  function updateRowSimulatorUI(id) {
    const calc = window.AttendanceCalculations;
    if (!calc) return;
    const r = records.find(rec => (rec.id || `${rec.courseCode}_${rec.loadType}`) === id);
    if (!r) return;

    const sim = rowSimulations[id] || { miss: 0, attend: 0 };
    const p = Number(r.present) || 0;
    const t = Number(r.total) || 0;
    const basePct = calc.calculatePercentage(p, t);
    const sp = p + sim.attend;
    const st = t + sim.attend + sim.miss;
    const projPct = calc.calculatePercentage(sp, st);
    const diff = Math.round((projPct - basePct) * 100) / 100;
    const isBelow = projPct < currentTarget;

    const row = attendanceTableBody.querySelector(`tr[data-row-id="${CSS.escape ? CSS.escape(id) : id}"]`);
    if (row) {
      const missEl = row.querySelector('.nsa-row-miss');
      const attEl = row.querySelector('.nsa-row-att');
      const projEl = row.querySelector('.nsa-row-proj-pct');
      const diffEl = row.querySelector('.nsa-row-proj-diff');

      if (missEl) missEl.textContent = String(sim.miss);
      if (attEl) attEl.textContent = String(sim.attend);
      if (projEl) {
        projEl.textContent = `${projPct}%`;
        projEl.style.color = isBelow ? '#ef4444' : '#10b981';
      }
      if (diffEl) {
        diffEl.textContent = `(${diff >= 0 ? '+' : ''}${diff}%)`;
        diffEl.style.color = diff >= 0 ? '#10b981' : '#ef4444';
      }
    }

    renderTopMetrics();
  }

  // Single delegated listener on table body (never detached, responds instantly to rapid clicks)
  attendanceTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    rowSimulations[id] = rowSimulations[id] || { miss: 0, attend: 0 };

    if (act === 'd-miss-inc') rowSimulations[id].miss++;
    if (act === 'd-miss-dec') rowSimulations[id].miss = Math.max(0, rowSimulations[id].miss - 1);
    if (act === 'd-att-inc') rowSimulations[id].attend++;
    if (act === 'd-att-dec') rowSimulations[id].attend = Math.max(0, rowSimulations[id].attend - 1);

    updateRowSimulatorUI(id);
  });
});
