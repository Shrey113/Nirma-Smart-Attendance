/**
 * Nirma Smart Attendance - Focused Single-Subject Deep Dive UI
 * Opens rich detailed attendance intelligence and leave simulations for the selected course.
 */
(function (root) {
  'use strict';

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
      this.viewMode = 'single'; // 'single' | 'all'
      this.selectedSubjectId = null;
      this.currentFilter = 'all'; // 'all' | 'low' | 'lecture' | 'practical'
      this.simState = {}; // { [subjectId]: { miss: 0, attend: 0 } }
      this.isDrawerOpen = false;
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
          this.viewMode = 'single';
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
      if (window.innerWidth < 400 && window !== window.top) return;
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
              <div class="nsa-header-icon">A+</div>
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

          <!-- Subject Navigation Bar (Prev / Dropdown / Next / View All) -->
          <div class="nsa-subject-nav" id="nsa-subject-nav">
            <button class="nsa-nav-btn" id="nsa-btn-prev" title="Previous Subject">&lt;</button>
            <select class="nsa-subject-select" id="nsa-subject-select"></select>
            <button class="nsa-nav-btn" id="nsa-btn-next" title="Next Subject">&gt;</button>
            <button class="nsa-btn-all-courses" id="nsa-btn-toggle-view">
              <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              All Courses
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
            <span>Synchronized with portal</span>
            <button class="nsa-refresh-btn" id="nsa-refresh-btn">
              <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh Data
            </button>
          </div>
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
          const rec = records.find(r => r.id === this.selectedSubjectId) || records[0];
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
          root.attendanceDetector.extractAttendance();
        }
      });

      // Target Chips
      const targetChips = document.querySelectorAll('.nsa-target-chip');
      targetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          targetChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const newTarget = Number(chip.getAttribute('data-target'));
          if (root.attendanceCalculator) {
            root.attendanceCalculator.setTargetPercentage(newTarget);
          }
          this.renderDrawerContent();
        });
      });

      // Subject Dropdown
      document.getElementById('nsa-subject-select').addEventListener('change', (e) => {
        this.selectedSubjectId = e.target.value;
        this.viewMode = 'single';
        this.renderDrawerContent();
      });

      // Prev / Next Subject
      document.getElementById('nsa-btn-prev').addEventListener('click', () => {
        this.navigateSubject(-1);
      });
      document.getElementById('nsa-btn-next').addEventListener('click', () => {
        this.navigateSubject(1);
      });

      // Toggle View (Single vs All)
      document.getElementById('nsa-btn-toggle-view').addEventListener('click', () => {
        this.viewMode = this.viewMode === 'single' ? 'all' : 'single';
        this.renderDrawerContent();
      });
    }

    navigateSubject(direction) {
      const records = root.attendanceDetector ? root.attendanceDetector.records : [];
      if (!records.length) return;
      const currentIndex = records.findIndex(r => r.id === this.selectedSubjectId);
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = records.length - 1;
      if (nextIndex >= records.length) nextIndex = 0;
      this.selectedSubjectId = records[nextIndex].id;
      this.viewMode = 'single';
      this.renderDrawerContent();
    }

    openDrawer(focusSubjectId = null) {
      const drawer = document.getElementById('nsa-drawer');
      const overlay = document.getElementById('nsa-drawer-overlay');
      if (drawer && overlay) {
        drawer.classList.add('nsa-open');
        overlay.classList.add('nsa-open');
        this.isDrawerOpen = true;

        if (focusSubjectId) {
          this.selectedSubjectId = focusSubjectId;
          this.viewMode = 'single';
        }

        this.renderDrawerContent();
      }
    }

    closeDrawer() {
      const drawer = document.getElementById('nsa-drawer');
      const overlay = document.getElementById('nsa-drawer-overlay');
      if (drawer && overlay) {
        drawer.classList.remove('nsa-open');
        overlay.classList.remove('nsa-open');
        this.isDrawerOpen = false;
      }
    }

    handleDataUpdated(records) {
      this.injectInlineTableButtons(records);
      this.updateSubjectDropdown(records);
      if (this.isDrawerOpen) {
        this.renderDrawerContent();
      }
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
      const toggleBtn = document.getElementById('nsa-btn-toggle-view');
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

      if (this.viewMode === 'single') {
        // =====================================================================
        // SINGLE-SUBJECT DEEP-DIVE VIEW
        // =====================================================================
        if (navBar) navBar.style.display = 'flex';
        if (toggleBtn) toggleBtn.innerHTML = `
          <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          All Courses
        `;
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

            <!-- 5. Interactive Custom Leave Simulator for this Course -->
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
        `;

      } else {
        // =====================================================================
        // ALL COURSES LIST VIEW
        // =====================================================================
        if (toggleBtn) toggleBtn.innerHTML = `
          <svg class="nsa-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          Focus Course
        `;
        if (drawerSub) drawerSub.textContent = 'All Courses Summary';

        const agg = calc.calculateAggregates(records, target);
        let totalLeaves = 0;
        records.forEach(r => {
          const p = Number(r.present) || 0;
          const t = Number(r.total) || 0;
          totalLeaves += calc.calculateSafeBunks(p, t, target);
        });

        let filtered = records.filter(r => {
          const p = Number(r.present) || 0;
          const t = Number(r.total) || 0;
          const pct = calc.calculatePercentage(p, t);
          if (this.currentFilter === 'low') return pct < target;
          if (this.currentFilter === 'lecture') return r.loadType === 'Lecture';
          if (this.currentFilter === 'practical') return r.loadType === 'Practical';
          return true;
        });

        content.innerHTML = `
          <!-- Filter tabs -->
          <div class="nsa-filter-bar">
            <button class="nsa-filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${records.length})</button>
            <button class="nsa-filter-btn ${this.currentFilter === 'low' ? 'active' : ''}" data-filter="low">Below Target (${agg.belowTargetCount})</button>
            <button class="nsa-filter-btn ${this.currentFilter === 'lecture' ? 'active' : ''}" data-filter="lecture">Lectures</button>
            <button class="nsa-filter-btn ${this.currentFilter === 'practical' ? 'active' : ''}" data-filter="practical">Practicals</button>
          </div>

          <!-- Course Cards List -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${filtered.map(rec => {
              const p = Number(rec.present) || 0;
              const t = Number(rec.total) || 0;
              const pct = calc.calculatePercentage(p, t);
              const isBelow = pct < target;
              const safeLeaves = calc.calculateSafeBunks(p, t, target);
              const needClasses = calc.calculateRequiredClasses(p, t, target);
              const typeClass = rec.loadType === 'Practical' ? 'nsa-type-practical' : 'nsa-type-lecture';

              return `
                <div class="nsa-subject-card" data-card-id="${rec.id}">
                  <div class="nsa-card-header">
                    <div class="nsa-course-info">
                      <span class="nsa-course-title">${rec.courseName}</span>
                      <div class="nsa-course-meta">
                        <span>${rec.courseCode || ''}</span>
                        <span class="nsa-type-pill ${typeClass}">${rec.loadType}</span>
                      </div>
                    </div>
                    <span class="nsa-card-pct" style="color: ${isBelow ? '#dc2626' : '#059669'};">
                      ${pct}%
                    </span>
                  </div>
                  <div class="nsa-leave-hero ${isBelow ? 'nsa-badge-danger' : 'nsa-badge-safe'}" style="padding: 6px 10px; font-size: 12px;">
                    ${isBelow ? `<span class="nsa-dot nsa-dot-danger"></span>Need to attend ${needClasses} more` : (safeLeaves > 0 ? `<span class="nsa-dot nsa-dot-safe"></span>${safeLeaves} Leaves Allowed` : `<span class="nsa-dot nsa-dot-warning"></span>0 Leaves Allowed`)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        // Card clicks switch to single subject view
        content.querySelectorAll('[data-card-id]').forEach(card => {
          card.addEventListener('click', () => {
            this.selectedSubjectId = card.getAttribute('data-card-id');
            this.viewMode = 'single';
            this.renderDrawerContent();
          });
        });

        // Filter button clicks
        content.querySelectorAll('.nsa-filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.currentFilter = btn.getAttribute('data-filter');
            this.renderDrawerContent();
          });
        });
      }
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
