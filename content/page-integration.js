/**
 * Nirma Smart Attendance - Focused Single-Subject Deep Dive UI
 * Opens rich detailed attendance intelligence and leave simulations for the selected course.
 */
(function (root) {
  'use strict';

  if (root.__nsa_page_integration_initialized) {
    return;
  }
  root.__nsa_page_integration_initialized = true;

  const isTargetPage = () => {
    const url = window.location.href.toLowerCase();
    if (url.includes('studentattendancereport') || url.includes('attendancereport')) return true;
    const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
    return bodyText.includes('present session') || (bodyText.includes('present') && bodyText.includes('absent'));
  };

  if (!isTargetPage()) {
    return;
  }

  class PageIntegration {
    constructor() {
      root.pageIntegration = this;
      this.selectedSubjectId = null;
      this.simState = {}; // { [subjectId]: { miss: 0, attend: 0 } }
      this.isDrawerOpen = false;
      this.drawerRenderedOnce = false;
      this.isFloatingPopupOpen = false;
      this.init();
    }

    async init() {
      if (root.attendanceCalculator) {
        await root.attendanceCalculator.init();
      }

      if (root.attendanceDetector) {
        root.attendanceDetector.startObserving();
        root.attendanceDetector.onDataDetected(records => {
          this.handleDataUpdated(records);
        });
      }

      this.injectDOMContainers();
      this.bindMessageListeners();

      // Delegated click listener for inline Info table buttons (capturing phase to intercept before ASP.NET table handlers)
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.nsa-inline-btn');
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const subjectId = btn.getAttribute('data-subject-id');
          this.selectedSubjectId = subjectId;
          this.openDrawer(subjectId);
        }
      }, true);

      const initialRecords = root.attendanceDetector ? root.attendanceDetector.records : [];
      if (initialRecords.length > 0) {
        this.handleDataUpdated(initialRecords);
      }
    }

    injectDOMContainers() {
      if (document.getElementById('nsa-root-wrapper')) return;

      const wrapper = document.createElement('div');
      wrapper.id = 'nsa-root-wrapper';

      wrapper.innerHTML = `
        <!-- Slide-out Drawer Backdrop -->
        <div id="nsa-drawer-overlay"></div>

        <!-- Slide-out Drawer -->
        <div id="nsa-drawer">
          <!-- Header -->
          <div class="nsa-drawer-header">
            <div class="nsa-header-left">
              <img src="${chrome.runtime.getURL('assets/icons/icon48.png')}" class="nsa-header-icon" alt="Logo">
              <div>
                <h3 class="nsa-header-title" id="nsa-drawer-title">Smart Attendance</h3>
                <div class="nsa-header-sub" id="nsa-drawer-sub">Single Subject Deep-Dive</div>
              </div>
            </div>
            <button class="nsa-close-btn" id="nsa-close-drawer" title="Close">&times;</button>
          </div>

          <!-- Target Bar -->
          <div class="nsa-target-bar">
            <span class="nsa-target-title">Target Attendance:</span>
            <div class="nsa-target-chips" id="nsa-target-chips">
              <button class="nsa-target-chip" data-target="75">75%</button>
              <button class="nsa-target-chip" data-target="80">80%</button>
              <button class="nsa-target-chip active" data-target="85">85%</button>
              <button class="nsa-target-chip" data-target="90">90%</button>
            </div>
          </div>

          <!-- Subject Navigation Bar (Prev / Dropdown / Next / Full View) -->
          <div class="nsa-subject-nav" id="nsa-subject-nav">
            <button class="nsa-nav-btn" id="nsa-btn-prev" title="Previous Subject">&lt;</button>
            <select class="nsa-subject-select" id="nsa-subject-select"></select>
            <button class="nsa-nav-btn" id="nsa-btn-next" title="Next Subject">&gt;</button>
            <button class="nsa-btn-full-view" id="nsa-btn-open-full" title="Open Full View Dashboard">
              <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              Full View
            </button>
          </div>

          <!-- Drawer Body Content -->
          <div class="nsa-drawer-body" id="nsa-drawer-content">
            <div style="text-align:center; padding: 40px; color: #94a3b8;">
              Loading course details...
            </div>
          </div>

          <!-- Footer -->
          <div class="nsa-drawer-footer">
            <div class="unified-footer-pill">
              <span class="footer-made-by-text">Made with <svg viewBox="0 0 24 24" width="13" height="13" fill="#ef4444" stroke="#ef4444" style="vertical-align: -1px; display: inline-block;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> by</span>
              <a href="https://github.com/shrey113" target="_blank" rel="noopener" class="github-log-badge" title="GitHub: shrey113">
                <span class="github-log-icon-circle">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </span>
                <span class="github-log-text">shrey113</span>
              </a>
            </div>
            <button class="nsa-refresh-btn" id="nsa-refresh-btn">
              <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh Data
            </button>
          </div>
        </div>

        <!-- Floating Trigger Pill (Bottom-Right) -->
        <button id="nsa-floating-trigger" class="nsa-floating-pill" type="button" title="Smart Attendance - Leave &amp; Target Calculator">
          <img src="${chrome.runtime.getURL('assets/icons/icon48.png')}" class="nsa-floating-logo" alt="Logo">
          <div class="nsa-floating-text">
            <span class="nsa-floating-title">Smart Attendance</span>
            <span class="nsa-floating-sub">Leave &amp; Target Calculator</span>
          </div>
        </button>

        <!-- Floating Popup Backdrop Overlay -->
        <div id="nsa-floating-overlay" class="nsa-floating-overlay"></div>

        <!-- Floating Popup Container (renders extension popup UI) -->
        <div id="nsa-floating-popup" class="nsa-floating-popup-box">
          <!-- Header -->
          <header class="nsa-fpopup-header">
            <div class="nsa-fpopup-brand">
              <img src="${chrome.runtime.getURL('assets/icons/icon48.png')}" class="nsa-fpopup-logo" alt="Logo">
              <div>
                <h4 class="nsa-fpopup-title">Smart Attendance</h4>
                <span class="nsa-fpopup-sub">Leave &amp; Target Calculator</span>
              </div>
            </div>
            <div class="nsa-fpopup-header-right">
              <div class="nsa-target-toggle" id="nsaFloatingTargetToggle">
                <button class="nsa-target-btn" data-target="75">75%</button>
                <button class="nsa-target-btn" data-target="80">80%</button>
                <button class="nsa-target-btn active" data-target="85">85%</button>
                <button class="nsa-target-btn" data-target="90">90%</button>
              </div>
              <button class="nsa-close-btn" id="nsaCloseFloatingPopup" title="Close">&times;</button>
            </div>
          </header>

          <!-- Action Row: Full View & Simulator -->
          <div class="nsa-fpopup-action-row">
            <button id="nsaBtnFloatingFullView" class="nsa-btn nsa-btn-primary">
              <svg class="nsa-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              Full View &amp; Leave Simulator
            </button>
          </div>

          <!-- Section Title -->
          <div class="nsa-fpopup-section-title">
            <span>Courses</span>
            <span id="nsaFloatingCourseCount" class="nsa-counter">0 courses</span>
          </div>

          <!-- Course List -->
          <div class="nsa-fpopup-course-list" id="nsaFloatingCourseList">
            <div class="nsa-loading">Loading courses...</div>
          </div>

          <!-- Footer -->
          <footer class="nsa-fpopup-footer">
            <div class="unified-footer-pill">
              <span class="footer-made-by-text">Made with <svg viewBox="0 0 24 24" width="12" height="12" fill="#ef4444" stroke="#ef4444" style="vertical-align: -1px; display: inline-block;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> by</span>
              <a href="https://github.com/shrey113" target="_blank" rel="noopener" class="github-log-badge" title="GitHub: shrey113">
                <span class="github-log-icon-circle">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </span>
                <span class="github-log-text">shrey113</span>
              </a>
            </div>
            <button id="nsaBtnFloatingRefresh" class="nsa-refresh-btn" title="Refresh Attendance Data">
              <svg class="nsa-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh
            </button>
          </footer>
        </div>
      `;

      document.body.appendChild(wrapper);

      // Instant delegated listener for simulator + / - steppers (zero lag, zero re-render, zero ASP.NET postback)
      wrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const act = btn.getAttribute('data-act');
          const records = root.attendanceDetector ? root.attendanceDetector.records : [];
          const rec = records.find(r => r.id === this.selectedSubjectId) ||
                      records.find(r => r.id.toLowerCase() === (this.selectedSubjectId || '').toLowerCase()) ||
                      records[0];
          if (!rec) return;

          this.simState[rec.id] = this.simState[rec.id] || { miss: 0, attend: 0 };
          if (act === 'sim-miss-inc') this.simState[rec.id].miss++;
          if (act === 'sim-miss-dec') this.simState[rec.id].miss = Math.max(0, this.simState[rec.id].miss - 1);
          if (act === 'sim-att-inc') this.simState[rec.id].attend++;
          if (act === 'sim-att-dec') this.simState[rec.id].attend = Math.max(0, this.simState[rec.id].attend - 1);

          const target = root.attendanceCalculator ? root.attendanceCalculator.targetPercentage : 85;
          const calc = root.AttendanceCalculations;
          if (calc) {
            this.updateSimulatorDOM(rec, target, calc);
          }
        }
      }, true);

      document.getElementById('nsa-close-drawer').addEventListener('click', () => this.closeDrawer());
      document.getElementById('nsa-drawer-overlay').addEventListener('click', () => this.closeDrawer());
      document.getElementById('nsa-refresh-btn').addEventListener('click', () => {
        if (root.attendanceDetector) {
          root.attendanceDetector.lastDataSignature = '';
          const recs = root.attendanceDetector.extractAttendance();
          if (recs && recs.length > 0) {
            this.handleDataUpdated(recs);
            this.renderDrawerContent();
          }
        }
      });

      // Target Chips
      const targetChips = document.querySelectorAll('.nsa-target-chip');
      targetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const newTarget = Number(chip.getAttribute('data-target'));
          if (root.attendanceCalculator) {
            root.attendanceCalculator.setTargetPercentage(newTarget);
          }
          this.syncTargetUI(newTarget);
          this.renderDrawerContent();
          if (this.isFloatingPopupOpen) {
            this.renderFloatingPopupContent();
          }
        });
      });

      // Floating Popup Target Toggle
      const fTargetButtons = document.querySelectorAll('#nsaFloatingTargetToggle .nsa-target-btn');
      fTargetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const newTarget = Number(btn.getAttribute('data-target'));
          if (root.attendanceCalculator) {
            root.attendanceCalculator.setTargetPercentage(newTarget);
          }
          this.syncTargetUI(newTarget);
          this.renderFloatingPopupContent();
          if (this.isDrawerOpen) {
            this.renderDrawerContent();
          }
        });
      });

      // Floating Trigger Pill Click -> Toggle Floating Popup
      const floatingTrigger = document.getElementById('nsa-floating-trigger');
      if (floatingTrigger) {
        floatingTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleFloatingPopup();
        });
      }

      // Close Floating Popup (Overlay & Close button)
      const floatingOverlay = document.getElementById('nsa-floating-overlay');
      if (floatingOverlay) {
        floatingOverlay.addEventListener('click', () => this.closeFloatingPopup());
      }
      const closeFloatingPopupBtn = document.getElementById('nsaCloseFloatingPopup');
      if (closeFloatingPopupBtn) {
        closeFloatingPopupBtn.addEventListener('click', () => this.closeFloatingPopup());
      }

      // Floating Popup: Open Full View Dashboard
      const btnFloatingFull = document.getElementById('nsaBtnFloatingFullView');
      if (btnFloatingFull) {
        btnFloatingFull.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD_TAB' });
          } else {
            window.open(chrome.runtime.getURL('dashboard/dashboard.html'), '_blank');
          }
        });
      }

      // Floating Popup: Refresh Data
      const btnFloatingRefresh = document.getElementById('nsaBtnFloatingRefresh');
      if (btnFloatingRefresh) {
        btnFloatingRefresh.addEventListener('click', () => {
          if (root.attendanceDetector) {
            root.attendanceDetector.lastDataSignature = '';
            const recs = root.attendanceDetector.extractAttendance();
            if (recs && recs.length > 0) {
              this.handleDataUpdated(recs);
              this.renderFloatingPopupContent();
            }
          }
        });
      }

      // Subject Dropdown
      document.getElementById('nsa-subject-select').addEventListener('change', (e) => {
        this.selectedSubjectId = e.target.value;
        this.renderDrawerContent();
      });

      // Prev / Next Subject
      document.getElementById('nsa-btn-prev').addEventListener('click', () => {
        this.navigateSubject(-1);
      });
      document.getElementById('nsa-btn-next').addEventListener('click', () => {
        this.navigateSubject(1);
      });

      // Open Full View Dashboard
      document.getElementById('nsa-btn-open-full').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD_TAB' });
        } else {
          window.open(chrome.runtime.getURL('dashboard/dashboard.html'), '_blank');
        }
      });

      // Forward wheel scrolling inside drawer header/nav/footer to the scrollable drawer body
      const drawer = document.getElementById('nsa-drawer');
      const drawerContent = document.getElementById('nsa-drawer-content');
      if (drawer && drawerContent) {
        drawer.addEventListener('wheel', (e) => {
          if (!e.target.closest('#nsa-drawer-content')) {
            drawerContent.scrollTop += e.deltaY;
            e.preventDefault();
          }
        }, { passive: false });
      }
    }

    navigateSubject(direction) {
      const records = root.attendanceDetector ? root.attendanceDetector.records : [];
      if (!records.length) return;
      const currentIndex = records.findIndex(r => r.id === this.selectedSubjectId);
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = records.length - 1;
      if (nextIndex >= records.length) nextIndex = 0;
      this.selectedSubjectId = records[nextIndex].id;
      this.renderDrawerContent();
    }

    openDrawer(focusSubjectId = null) {
      if (this.isFloatingPopupOpen) {
        this.closeFloatingPopup();
      }
      const drawer = document.getElementById('nsa-drawer');
      const overlay = document.getElementById('nsa-drawer-overlay');
      if (drawer && overlay) {
        drawer.classList.add('nsa-open');
        overlay.classList.add('nsa-open');
        this.isDrawerOpen = true;

        if (focusSubjectId) {
          this.selectedSubjectId = focusSubjectId;
        }

        this.drawerRenderedOnce = true;
        this.renderDrawerContent();
        const content = document.getElementById('nsa-drawer-content');
        if (content) {
          content.scrollTop = 0;
        }
      }
    }

    closeDrawer() {
      const drawer = document.getElementById('nsa-drawer');
      const overlay = document.getElementById('nsa-drawer-overlay');
      if (drawer && overlay) {
        drawer.classList.remove('nsa-open');
        overlay.classList.remove('nsa-open');
        this.isDrawerOpen = false;
        this.drawerRenderedOnce = false;
      }
    }

    openFloatingPopup() {
      const popup = document.getElementById('nsa-floating-popup');
      const overlay = document.getElementById('nsa-floating-overlay');
      if (popup && overlay) {
        popup.classList.add('nsa-open');
        overlay.classList.add('nsa-open');
        this.isFloatingPopupOpen = true;
        const target = root.attendanceCalculator ? root.attendanceCalculator.targetPercentage : 85;
        this.syncTargetUI(target);
        this.renderFloatingPopupContent();
      }
    }

    closeFloatingPopup() {
      const popup = document.getElementById('nsa-floating-popup');
      const overlay = document.getElementById('nsa-floating-overlay');
      if (popup && overlay) {
        popup.classList.remove('nsa-open');
        overlay.classList.remove('nsa-open');
        this.isFloatingPopupOpen = false;
      }
    }

    toggleFloatingPopup() {
      if (this.isFloatingPopupOpen) {
        this.closeFloatingPopup();
      } else {
        this.openFloatingPopup();
      }
    }

    syncTargetUI(target) {
      document.querySelectorAll('.nsa-target-chip').forEach(c => {
        if (Number(c.getAttribute('data-target')) === target) c.classList.add('active');
        else c.classList.remove('active');
      });
      document.querySelectorAll('#nsaFloatingTargetToggle .nsa-target-btn').forEach(btn => {
        if (Number(btn.getAttribute('data-target')) === target) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    renderFloatingPopupContent() {
      const list = document.getElementById('nsaFloatingCourseList');
      const countBadge = document.getElementById('nsaFloatingCourseCount');
      if (!list) return;

      const records = root.attendanceDetector ? root.attendanceDetector.records : [];
      if (!records || records.length === 0) {
        list.innerHTML = `
          <div class="nsa-loading">
            No courses detected yet.<br>
            <span style="font-size:11px; color:#64748b; margin-top:4px; display:inline-block;">
              Please ensure attendance report has loaded.
            </span>
          </div>
        `;
        if (countBadge) countBadge.textContent = '0 courses';
        return;
      }

      if (countBadge) countBadge.textContent = `${records.length} courses`;

      const target = root.attendanceCalculator ? root.attendanceCalculator.targetPercentage : 85;
      const calc = root.AttendanceCalculations;

      let html = '';
      records.forEach(rec => {
        const p = Number(rec.present) || 0;
        const t = Number(rec.total) || 0;
        const pct = calc ? calc.calculatePercentage(p, t) : Math.round((p / (t || 1)) * 100);
        const isBelow = pct < target;
        const safeLeaves = calc ? calc.calculateSafeBunks(p, t, target) : 0;
        const needClasses = calc ? calc.calculateRequiredClasses(p, t, target) : 0;

        let statusTagHtml = '';
        if (isBelow) {
          statusTagHtml = `
            <span class="nsa-card-badge nsa-badge-danger">
              <span class="nsa-dot nsa-dot-danger"></span>Need ${needClasses} class${needClasses > 1 ? 'es' : ''}
            </span>
          `;
        } else if (safeLeaves > 0) {
          statusTagHtml = `
            <span class="nsa-card-badge nsa-badge-safe">
              <span class="nsa-dot nsa-dot-safe"></span>${safeLeaves} leave${safeLeaves > 1 ? 's' : ''} safe
            </span>
          `;
        } else {
          statusTagHtml = `
            <span class="nsa-card-badge nsa-badge-warning">
              <span class="nsa-dot nsa-dot-warning"></span>0 leaves safe
            </span>
          `;
        }

        const typeBadge = rec.loadType === 'Practical' ? 'nsa-type-prac' : 'nsa-type-lec';

        html += `
          <div class="nsa-card" data-fsubject-id="${rec.id || ''}" title="Click to view detailed leave simulator for ${rec.courseName}">
            <div class="nsa-card-left">
              <div class="nsa-card-name-row">
                <span class="nsa-card-name" title="${rec.courseName}">${rec.courseName}</span>
                <span class="nsa-badge-type ${typeBadge}">${rec.loadType === 'Practical' ? 'Lab' : 'Lec'}</span>
              </div>
              <div class="nsa-card-meta">
                <span>${rec.courseCode || ''}</span>
                <span class="nsa-meta-dot">•</span>
                <span>${p}/${t} sessions</span>
              </div>
            </div>
            <div class="nsa-card-right">
              <span class="nsa-card-pct" style="color: ${isBelow ? '#dc2626' : '#059669'};">
                ${pct}%
              </span>
              ${statusTagHtml}
            </div>
          </div>
        `;
      });

      list.innerHTML = html;

      // Clicking any course card opens the deep-dive drawer for that course
      const cards = list.querySelectorAll('.nsa-card');
      cards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const subjectId = card.getAttribute('data-fsubject-id');
          this.closeFloatingPopup();
          this.openDrawer(subjectId);
        });
      });
    }

    handleDataUpdated(records) {
      this.injectInlineTableButtons(records);
      this.updateSubjectDropdown(records);
      if (this.isFloatingPopupOpen) {
        this.renderFloatingPopupContent();
      }
      // ONLY re-render drawer if drawer is open AND not yet rendered
      if (this.isDrawerOpen && !this.drawerRenderedOnce) {
        this.drawerRenderedOnce = true;
        this.renderDrawerContent();
        const content = document.getElementById('nsa-drawer-content');
        if (content) {
          content.scrollTop = 0;
        }
      }
    }

    injectInlineTableButtonsQuietly(records) {
      this.injectInlineTableButtons(records);
      this.updateSubjectDropdown(records);
    }

    updateSubjectDropdown(records) {
      const select = document.getElementById('nsa-subject-select');
      if (!select) return;

      select.innerHTML = records.map(r => `
        <option value="${r.id}" ${r.id === this.selectedSubjectId ? 'selected' : ''}>
          ${r.courseCode} - ${r.courseName} (${r.loadType})
        </option>
      `).join('');
    }

    updateSimulatorDOM(rec, target, calc) {
      const sim = this.simState[rec.id] || { miss: 0, attend: 0 };
      const p = Number(rec.present) || 0;
      const t = Number(rec.total) || 0;
      const basePct = calc.calculatePercentage(p, t);
      const simP = p + sim.attend;
      const simT = t + sim.attend + sim.miss;
      const simPct = calc.calculatePercentage(simP, simT);
      const simDiff = Math.round((simPct - basePct) * 100) / 100;
      const isSimBelow = simPct < target;

      const missVal = document.getElementById('nsa-sim-miss-val');
      const attVal = document.getElementById('nsa-sim-att-val');
      const resPct = document.getElementById('nsa-sim-result-pct');
      const resSessions = document.getElementById('nsa-sim-result-sessions');
      const resDiff = document.getElementById('nsa-sim-result-diff');

      if (missVal) missVal.textContent = String(sim.miss);
      if (attVal) attVal.textContent = String(sim.attend);
      if (resPct) {
        resPct.textContent = `${simPct}%`;
        resPct.style.color = isSimBelow ? '#dc2626' : '#059669';
      }
      if (resSessions) resSessions.textContent = `(${simP}/${simT})`;
      if (resDiff) {
        resDiff.textContent = `${simDiff > 0 ? '+' : ''}${simDiff}%`;
        resDiff.style.color = simDiff >= 0 ? '#059669' : '#dc2626';
      }
    }

    injectInlineTableButtons(records) {
      records.forEach(rec => {
        if (!rec.rowElement) return;

        let btn = rec.rowElement.querySelector('.nsa-inline-btn');
        if (!btn) {
          const cells = Array.from(rec.rowElement.querySelectorAll('td'));
          if (!cells.length) return;

          const targetCell = cells[cells.length - 1];
          btn = document.createElement('button');
          btn.className = 'nsa-inline-btn';
          btn.type = 'button';
          targetCell.appendChild(btn);
        }

        btn.setAttribute('data-subject-id', rec.id);
        btn.innerHTML = `
          <svg class="nsa-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Info
        `;
        btn.title = `View leave calculations for ${rec.courseName} (${rec.loadType})`;
      });
    }

    renderDrawerContent() {
      const content = document.getElementById('nsa-drawer-content');
      const navBar = document.getElementById('nsa-subject-nav');
      const drawerSub = document.getElementById('nsa-drawer-sub');
      if (!content) return;

      const records = root.attendanceDetector ? root.attendanceDetector.records : [];
      if (!records || records.length === 0) {
        content.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #64748b;">
            <div style="margin-bottom: 10px;">
              <svg class="nsa-svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <div style="font-weight: 700; color: #0f172a;">Attendance table not found</div>
            <div style="font-size: 12px; margin-top: 4px;">Make sure your attendance report has finished loading.</div>
          </div>
        `;
        return;
      }

      const target = root.attendanceCalculator ? root.attendanceCalculator.targetPercentage : 85;
      const calc = root.AttendanceCalculations;

      // Synchronize Target Chips UI
      document.querySelectorAll('.nsa-target-chip').forEach(c => {
        if (Number(c.getAttribute('data-target')) === target) c.classList.add('active');
        else c.classList.remove('active');
      });

      // Default selected subject with robust case-insensitive lookup
      if (!this.selectedSubjectId || !records.find(r => r.id === this.selectedSubjectId)) {
        const found = records.find(r => r.id.toLowerCase() === (this.selectedSubjectId || '').toLowerCase());
        this.selectedSubjectId = found ? found.id : (records[0] ? records[0].id : null);
      }

      this.updateSubjectDropdown(records);

      if (navBar) navBar.style.display = 'flex';
      if (drawerSub) drawerSub.textContent = 'Single Course Detailed Report';

      const rec = records.find(r => r.id === this.selectedSubjectId) || records[0];
        const p = Number(rec.present) || 0;
        const t = Number(rec.total) || 0;
        const currentPct = calc.calculatePercentage(p, t);
        const isBelow = currentPct < target;
        const safeLeaves = calc.calculateSafeBunks(p, t, target);
        const needClasses = calc.calculateRequiredClasses(p, t, target);

        // Simulation state for this course
        const sim = this.simState[rec.id] || { miss: 0, attend: 0 };
        const simP = p + sim.attend;
        const simT = t + sim.attend + sim.miss;
        const simPct = calc.calculatePercentage(simP, simT);
        const simDiff = Math.round((simPct - currentPct) * 100) / 100;
        const isSimBelow = simPct < target;

        // Leave scenarios
        const leaveScenarios = [1, 2, 3, 4].map(leaves => {
          const newPct = calc.calculatePercentage(p, t + leaves);
          const diff = Math.round((newPct - currentPct) * 100) / 100;
          return { leaves, newPct, diff, isSafe: newPct >= target };
        });

        // Attendance scenarios
        const attendScenarios = [1, 2, 3, 5].map(att => {
          const newPct = calc.calculatePercentage(p + att, t + att);
          const diff = Math.round((newPct - currentPct) * 100) / 100;
          return { att, newPct, diff, isSafe: newPct >= target };
        });

        const typeClass = rec.loadType === 'Practical' ? 'nsa-type-practical' : 'nsa-type-lecture';

        content.innerHTML = `
          <div class="nsa-single-view">
            <!-- 1. Course Header Card -->
            <div class="nsa-single-card">
              <div class="nsa-single-top">
                <div class="nsa-course-info">
                  <h2 class="nsa-single-title">${rec.courseName}</h2>
                  <div class="nsa-single-meta">
                    <strong>${rec.courseCode || 'N/A'}</strong>
                    <span>•</span>
                    <span class="nsa-type-pill ${typeClass}">${rec.loadType}</span>
                  </div>
                </div>
                <div class="nsa-single-pct-box">
                  <div class="nsa-single-pct" style="color: ${isBelow ? '#dc2626' : '#059669'};">
                    ${currentPct}%
                  </div>
                  <div class="nsa-single-sessions">${p} Present / ${t} Total</div>
                </div>
              </div>

              <!-- Visual Progress Bar vs Target -->
              <div class="nsa-track">
                <div class="nsa-fill" style="width: ${Math.min(100, currentPct)}%; background: ${isBelow ? '#dc2626' : '#059669'};"></div>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b;">
                <span>0%</span>
                <span style="font-weight:700; color: ${isBelow ? '#dc2626' : '#2563eb'};">Target: ${target}%</span>
                <span>100%</span>
              </div>
            </div>

            <!-- 2. The Main Answer: Safe Leave Status Banner -->
            <div class="nsa-leave-hero ${isBelow ? 'nsa-badge-danger' : 'nsa-badge-safe'}">
              <div class="nsa-leave-hero-title">
                ${isBelow ? `<span class="nsa-dot nsa-dot-danger"></span>Deficit: Attend ${needClasses} More Classes` : (safeLeaves > 0 ? `<span class="nsa-dot nsa-dot-safe"></span>${safeLeaves} Leaves Allowed` : `<span class="nsa-dot nsa-dot-warning"></span>0 Leaves Allowed (Attend All)`)}
              </div>
              <div class="nsa-leave-hero-desc">
                ${isBelow ? `
                  Your attendance is below the ${target}% threshold. You need to attend the next <strong>${needClasses} consecutive lectures</strong> to get back to ${target}%.
                ` : (safeLeaves > 0 ? `
                  You can safely miss up to <strong>${safeLeaves} upcoming classes</strong> and your attendance will stay at or above ${target}%.
                ` : `
                  You are exactly on the ${target}% boundary. Any missed class will push you below target.
                `)}
              </div>
            </div>

            <!-- 3. What Happens If You Take Leaves? (Detailed Grid) -->
            <div class="nsa-section-card">
              <div class="nsa-section-head">
                <span class="nsa-section-label">
                  <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                  If You Take Leaves (Scenario Analysis)
                </span>
              </div>
              <div class="nsa-scenario-grid">
                ${leaveScenarios.map(sc => `
                  <div class="nsa-scenario-item">
                    <span class="nsa-scenario-title">Take ${sc.leaves} Leave${sc.leaves > 1 ? 's' : ''}</span>
                    <div class="nsa-scenario-value-row">
                      <span class="nsa-scenario-pct" style="color: ${sc.isSafe ? '#059669' : '#dc2626'};">${sc.newPct}%</span>
                      <span class="nsa-scenario-diff" style="color: #dc2626;">${sc.diff}%</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 4. What Happens If You Attend Classes? -->
            <div class="nsa-section-card">
              <div class="nsa-section-head">
                <span class="nsa-section-label">
                  <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  If You Attend Classes (Catch-Up Analysis)
                </span>
              </div>
              <div class="nsa-scenario-grid">
                ${attendScenarios.map(sc => `
                  <div class="nsa-scenario-item">
                    <span class="nsa-scenario-title">Attend +${sc.att} Class${sc.att > 1 ? 'es' : ''}</span>
                    <div class="nsa-scenario-value-row">
                      <span class="nsa-scenario-pct" style="color: ${sc.isSafe ? '#059669' : '#dc2626'};">${sc.newPct}%</span>
                      <span class="nsa-scenario-diff" style="color: #059669;">+${sc.diff}%</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 5. Interactive Custom Leave & Attendance Simulator -->
            <div class="nsa-section-card">
              <div class="nsa-section-head">
                <span class="nsa-section-label">
                  <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="12" y2="14"></line><line x1="8" y1="18" x2="10" y2="18"></line></svg>
                  Custom Leave Simulator (What-If Calculator)
                </span>
              </div>
              <div class="nsa-single-sim-box">
                <div class="nsa-sim-stepper-row">
                  <span class="nsa-sim-stepper-label">Miss Classes (Leaves):</span>
                  <div class="nsa-stepper-ctrl">
                    <button type="button" class="nsa-stepper-btn" data-act="sim-miss-dec" title="Decrease Leaves">-</button>
                    <span class="nsa-stepper-val" id="nsa-sim-miss-val">${sim.miss}</span>
                    <button type="button" class="nsa-stepper-btn" data-act="sim-miss-inc" title="Increase Leaves">+</button>
                  </div>
                </div>

                <div class="nsa-sim-stepper-row">
                  <span class="nsa-sim-stepper-label">Attend Extra Classes:</span>
                  <div class="nsa-stepper-ctrl">
                    <button type="button" class="nsa-stepper-btn" data-act="sim-att-dec" title="Decrease Attended">-</button>
                    <span class="nsa-stepper-val" id="nsa-sim-att-val">${sim.attend}</span>
                    <button type="button" class="nsa-stepper-btn" data-act="sim-att-inc" title="Increase Attended">+</button>
                  </div>
                </div>

                <div class="nsa-sim-result-row">
                  <span class="nsa-sim-result-text">
                    Projected: <strong id="nsa-sim-result-pct" style="color: ${isSimBelow ? '#dc2626' : '#059669'}; font-size: 15px;">${simPct}%</strong> <span id="nsa-sim-result-sessions">(${simP}/${simT})</span>
                  </span>
                  <span id="nsa-sim-result-diff" style="font-weight: 700; font-size: 12px; color: ${simDiff >= 0 ? '#059669' : '#dc2626'};">
                    ${simDiff > 0 ? '+' : ''}${simDiff}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        `;
    }

    bindMessageListeners() {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GET_ATTENDANCE_DATA') {
          const records = root.attendanceDetector ? root.attendanceDetector.extractAttendance() : [];
          const target = root.attendanceCalculator ? root.attendanceCalculator.targetPercentage : 85;
          const analysis = root.attendanceCalculator ? root.attendanceCalculator.analyzeAll(records, target) : null;

          sendResponse({
            success: true,
            isAttendancePage: true,
            url: window.location.href,
            records: records,
            analysis: analysis
          });
          return true;
        }

        if (request.action === 'OPEN_DRAWER') {
          if (request.focusSubjectId) {
            this.selectedSubjectId = request.focusSubjectId;
            this.viewMode = 'single';
          }
          this.openDrawer(this.selectedSubjectId);
          sendResponse({ success: true });
          return true;
        }

        if (request.action === 'SET_TARGET') {
          if (root.attendanceCalculator) {
            root.attendanceCalculator.setTargetPercentage(request.target);
            this.renderDrawerContent();
          }
          sendResponse({ success: true, target: request.target });
          return true;
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PageIntegration());
  } else {
    new PageIntegration();
  }
})(typeof self !== 'undefined' ? self : this);
