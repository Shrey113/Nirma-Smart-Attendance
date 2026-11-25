/**
 * Nirma Smart Attendance - Robust Attendance Detector
 * Parses Nirma University MIS attendance tables with sorting headers, nested structures, and dynamic updates.
 */
(function (root) {
  'use strict';

  if (root.__nsa_attendance_detector_initialized) {
    return;
  }
  root.__nsa_attendance_detector_initialized = true;

  class AttendanceDetector {
    constructor() {
      this.records = [];
      this.observers = [];
      this.onDataDetectedCallbacks = [];
      this.lastDataSignature = '';
      this.hasExtractedOnce = false;
      console.log('[NSA] AttendanceDetector initialized on:', window.location.href);
    }

    onDataDetected(callback) {
      if (typeof callback === 'function') {
        this.onDataDetectedCallbacks.push(callback);
      }
    }

    notifySubscribers(data) {
      this.onDataDetectedCallbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error('[NSA] Subscriber error:', e); }
      });
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('nsa-attendance-updated', { detail: data }));
      }
    }

    /**
     * Check if current frame/page qualifies as an attendance view
     */
    isAttendancePage() {
      const url = window.location.href.toLowerCase();
      if (url.includes('studentattendancereport.aspx') || url.includes('attendancereport')) {
        return true;
      }
      // Or check if the DOM contains "Present Sessions" header
      const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
      return bodyText.includes('present session') || (bodyText.includes('present') && bodyText.includes('absent'));
    }

    /**
     * Clean header text by stripping sort indicators (↕, ▲, ▼, etc.), newlines, and excess spaces
     */
    normalizeHeader(text) {
      if (!text) return '';
      return text
        .replace(/[↕▲▼↑↓\n\r\t]/g, ' ')
        .replace(/[^\w\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    cleanCell(str) {
      if (!str) return '';
      return str.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, ' ').trim();
    }

    extractInt(str) {
      if (!str) return 0;
      const match = String(str).match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }

    extractFloat(str) {
      if (!str) return 0;
      const match = String(str).match(/\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : 0;
    }

    parseLoadType(text) {
      const lower = String(text || '').toLowerCase();
      if (lower.includes('prac') || lower === 'p' || lower.includes('lab')) return 'Practical';
      if (lower.includes('tut') || lower === 't') return 'Tutorial';
      return 'Lecture';
    }

    /**
     * Check if a table contains attendance columns
     */
    looksLikeAttendanceTable(table) {
      const text = this.normalizeHeader(table.textContent);
      const hasPresent = text.includes('present') || text.includes('attended');
      const hasAbsent = text.includes('absent');
      const hasSessions = text.includes('session');
      return (hasPresent && hasAbsent) || (hasPresent && hasSessions);
    }

    /**
     * Locate all attendance candidate tables
     */
    findAttendanceTables() {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.filter(tbl => this.looksLikeAttendanceTable(tbl));
    }

    /**
     * Parse column mapping by inspecting header rows (<thead> or top <tr>s)
     */
    mapHeaderColumns(table) {
      const colMap = {
        courseCode: -1,
        courseName: -1,
        loadType: -1,
        present: -1,
        absent: -1,
        total: -1,
        percentage: -1,
        detailsAction: -1
      };

      const rows = Array.from(table.querySelectorAll('tr'));
      if (!rows.length) return colMap;

      // Scan up to the first 4 rows for headers (handles multi-header tables)
      for (let r = 0; r < Math.min(4, rows.length); r++) {
        const cells = Array.from(rows[r].querySelectorAll('th, td'));
        cells.forEach((cell, idx) => {
          const txt = this.normalizeHeader(cell.textContent);
          if (!txt) return;

          // Present column
          if (colMap.present === -1 && (txt.includes('present session') || txt === 'present' || txt === 'p' || txt.includes('attended') || txt.includes('total present'))) {
            colMap.present = idx;
          }
          // Absent column
          else if (colMap.absent === -1 && (txt.includes('absent session') || txt === 'absent' || txt === 'a' || txt.includes('total absent'))) {
            colMap.absent = idx;
          }
          // Total column
          else if (colMap.total === -1 && (txt.includes('total session') || txt.includes('conducted') || (txt.includes('total') && !txt.includes('present') && !txt.includes('absent')))) {
            colMap.total = idx;
          }
          // Percentage column
          else if (colMap.percentage === -1 && (txt.includes('percentage') || txt.includes('percent') || txt.includes('%'))) {
            colMap.percentage = idx;
          }
          // Load Type / Component column
          else if (colMap.loadType === -1 && (txt.includes('component') || txt.includes('load type') || txt === 'type' || txt.includes('scheme'))) {
            colMap.loadType = idx;
          }
          // Course Code
          else if (colMap.courseCode === -1 && (txt.includes('course code') || txt.includes('subject code') || txt === 'code')) {
            colMap.courseCode = idx;
          }
          // Course Name
          else if (colMap.courseName === -1 && (txt.includes('course name') || txt.includes('subject name') || txt.includes('course title') || txt === 'course' || txt === 'subject' || txt.includes('paper'))) {
            colMap.courseName = idx;
          }
          // Details / Action
          else if (colMap.detailsAction === -1 && (txt.includes('detail') || txt.includes('action') || txt.includes('view'))) {
            colMap.detailsAction = idx;
          }
        });
      }

      console.log('[NSA] Mapped columns:', colMap);
      return colMap;
    }

    /**
     * Primary extraction logic
     */
    extractAttendance() {
      if (!this.isAttendancePage()) {
        console.log('[NSA] Not on attendance page; skipping extraction.');
        return [];
      }

      const tables = this.findAttendanceTables();
      console.log(`[NSA] Found ${tables.length} potential attendance tables.`);

      const detected = [];
      const seenKeys = new Set();

      tables.forEach((table, tableIndex) => {
        const colMap = this.mapHeaderColumns(table);
        const rows = Array.from(table.querySelectorAll('tr'));

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 3) return; // Skip headers or sub-rows

          // Extract Present & Absent
          let present = 0;
          let absent = 0;
          let total = 0;

          if (colMap.present !== -1 && cells[colMap.present]) {
            present = this.extractInt(cells[colMap.present].textContent);
          }
          if (colMap.absent !== -1 && cells[colMap.absent]) {
            absent = this.extractInt(cells[colMap.absent].textContent);
          }
          if (colMap.total !== -1 && cells[colMap.total]) {
            total = this.extractInt(cells[colMap.total].textContent);
          }

          // If header mapping couldn't find present/absent, infer from row numbers
          if (colMap.present === -1 || colMap.absent === -1) {
            // Find numeric cells
            const numCells = [];
            cells.forEach((c, idx) => {
              const val = this.extractInt(c.textContent);
              if (/^\s*\d+\s*$/.test(c.textContent.trim())) {
                numCells.push({ idx, val });
              }
            });

            // If we have at least 2 integer cells (Present, Absent)
            if (numCells.length >= 2) {
              // Usually the last two integers before any % cell
              present = numCells[numCells.length - 2].val;
              absent = numCells[numCells.length - 1].val;
            }
          }

          // Calculate Total if absent/omitted (Nirma MIS usually omits total sessions)
          if (total === 0 || total < present) {
            total = present + absent;
          }

          // Must have at least 1 session to be a valid course row
          if (total <= 0 && present <= 0 && absent <= 0) {
            return;
          }

          // Extract Course Code and Course Name
          let courseCode = '';
          let courseName = '';
          let loadTypeRaw = '';

          if (colMap.courseCode !== -1 && cells[colMap.courseCode]) {
            courseCode = this.cleanCell(cells[colMap.courseCode].textContent);
          }
          if (colMap.courseName !== -1 && cells[colMap.courseName]) {
            courseName = this.cleanCell(cells[colMap.courseName].textContent);
          }
          if (colMap.loadType !== -1 && cells[colMap.loadType]) {
            loadTypeRaw = this.cleanCell(cells[colMap.loadType].textContent);
          }

          // Direct cell scanning fallback to guarantee Course Code and Name regardless of header names
          if (!courseCode || !courseName || !loadTypeRaw) {
            cells.forEach(cell => {
              const txt = this.cleanCell(cell.textContent);
              if (!txt) return;

              // Match standard university course codes (e.g. 2CS401, 2IT502, CE301, MA101, HS101)
              if (!courseCode && /\b[0-9A-Za-z]{2,4}[0-9]{3,4}[A-Za-z]?\b/.test(txt) && !/^\d+$/.test(txt)) {
                courseCode = txt;
              }
              // Match component / load type
              if (!loadTypeRaw) {
                const low = txt.toLowerCase();
                if (low.includes('practical') || low.includes('lab') || low === 'p') loadTypeRaw = 'Practical';
                else if (low.includes('tutorial') || low === 't') loadTypeRaw = 'Tutorial';
                else if (low.includes('lecture') || low.includes('theory') || low === 'l') loadTypeRaw = 'Lecture';
              }
              // Match descriptive course name
              if (!courseName && /[a-zA-Z]{4,}/.test(txt) && !txt.includes('Info') && !txt.includes('Leaves')) {
                const low = txt.toLowerCase();
                if (!['lecture', 'practical', 'tutorial', 'theory', 'lab', 'present', 'absent', 'view', 'action', 'detail', 'details'].includes(low)) {
                  courseName = txt;
                }
              }
            });
          }

          // Check if Load Type is embedded in course name (e.g. "Computer Networks (Practical)")
          const combined = (courseName + ' ' + (cells.map(c => c.textContent).join(' '))).toLowerCase();
          if (!loadTypeRaw) {
            if (combined.includes('practical') || combined.includes('lab') || combined.includes('(p)')) {
              loadTypeRaw = 'Practical';
            } else if (combined.includes('tutorial') || combined.includes('(t)')) {
              loadTypeRaw = 'Tutorial';
            } else {
              loadTypeRaw = 'Lecture';
            }
          }

          const loadType = this.parseLoadType(loadTypeRaw);
          // Sorting-invariant identifiers (never use rowIndex)
          const finalName = courseName || courseCode || `Course (${present}/${total})`;
          const finalCode = courseCode || (courseName ? courseName.slice(0, 8).trim() : `C_${present}_${absent}`);

          // Unique deduplication key keeping Lecture & Practical distinct
          const dedupeKey = `${finalCode.toLowerCase()}_${finalName.toLowerCase()}_${loadType}`;
          if (seenKeys.has(dedupeKey)) return;
          seenKeys.add(dedupeKey);

          // Calculate Percentage
          const calcEngine = root.AttendanceCalculations;
          const presentPercentage = calcEngine
            ? calcEngine.calculatePercentage(present, total)
            : Math.round((present / (total || 1)) * 10000) / 100;
          const absentPercentage = Math.round((100 - presentPercentage) * 100) / 100;

          // Generate stable semantic ID invariant to table sorting, filtering, and reordering
          const stableId = 'course_' + (finalCode + '_' + loadType).toLowerCase().replace(/[^a-z0-9]/g, '_');

          const record = {
            id: stableId,
            courseCode: finalCode,
            courseName: finalName,
            courseShortName: finalCode.toUpperCase(),
            loadType: loadType,
            present: present,
            absent: absent,
            total: total,
            presentPercentage: presentPercentage,
            absentPercentage: absentPercentage,
            tableIndex: tableIndex,
            rowIndex: rowIndex,
            rowElement: row
          };

          detected.push(record);
        });
      });

      console.log(`[NSA] Successfully extracted ${detected.length} courses:`, detected);
      this.records = detected;

      const dataSignature = detected.map(r => `${r.id}:${r.present}:${r.absent}:${r.total}`).join('|');
      const hasDataChanged = dataSignature !== this.lastDataSignature;

      // Only notify subscribers and persist if data actually changed or initial extraction
      if (hasDataChanged || !this.hasExtractedOnce) {
        this.lastDataSignature = dataSignature;
        this.hasExtractedOnce = true;

        // Save to chrome.storage
        if (root.AttendanceStorage && detected.length > 0) {
          root.AttendanceStorage.saveAttendanceData(detected.map(r => {
            const { rowElement, ...clean } = r;
            return clean;
          }));
        }

        this.notifySubscribers(detected);
      } else {
        // Attendance numbers are identical: only quiet row button updates, NEVER re-render drawer
        if (root.pageIntegration && typeof root.pageIntegration.injectInlineTableButtonsQuietly === 'function') {
          root.pageIntegration.injectInlineTableButtonsQuietly(detected);
        }
      }
      return detected;
    }

    startObserving() {
      // Immediate extraction
      this.extractAttendance();

      // 1. Observer for dynamic table changes, sorting, and ASP.NET postbacks
      const targetNode = document.body || document.documentElement;
      if (targetNode) {
        let timer = null;
        const observer = new MutationObserver((mutations) => {
          // STRICT FILTER: Ignore any mutation inside our extension wrapper or on our buttons!
          let hasExternalMutation = false;
          for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            const t = m.target;
            if (!t) continue;
            // If target is inside #nsa-root-wrapper or has .nsa-inline-btn, ignore it
            const insideNSA = (t.id === 'nsa-root-wrapper') || 
                              (t.closest && t.closest('#nsa-root-wrapper')) ||
                              (t.classList && t.classList.contains('nsa-inline-btn')) ||
                              (t.closest && t.closest('.nsa-inline-btn'));
            if (!insideNSA) {
              hasExternalMutation = true;
              break;
            }
          }
          if (!hasExternalMutation) return;

          clearTimeout(timer);
          timer = setTimeout(() => {
            this.extractAttendance();
          }, 350);
        });

        observer.observe(targetNode, { childList: true, subtree: true });
        this.observers.push(observer);
      }

      // 2. Intercept table sort clicks (e.g. clicking headers with arrows ↕, ASP.NET postbacks, or DataTables)
      document.addEventListener('click', (e) => {
        const isHeaderOrSort = e.target.closest('th, thead, .sorting, [class*="sort"], a[href*="Sort"], a[href*="__doPostBack"]');
        if (isHeaderOrSort) {
          setTimeout(() => this.extractAttendance(), 60);
          setTimeout(() => this.extractAttendance(), 180);
          setTimeout(() => this.extractAttendance(), 500);
        }
      }, true);

      // 3. ASP.NET AJAX PageRequestManager hook if present on Nirma WebForms portal
      try {
        if (typeof window.Sys !== 'undefined' && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager) {
          const prm = window.Sys.WebForms.PageRequestManager.getInstance();
          prm.add_endRequest(() => {
            setTimeout(() => this.extractAttendance(), 100);
          });
        }
      } catch (e) {}
    }

    stopObserving() {
      this.observers.forEach(o => o.disconnect());
      this.observers = [];
    }
  }

  root.attendanceDetector = new AttendanceDetector();
})(typeof self !== 'undefined' ? self : this);
