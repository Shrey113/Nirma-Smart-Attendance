# Nirma Smart Attendance – Chrome Extension (Manifest V3)

> Production-quality intelligent attendance calculator and what-if projection simulator built specifically for the Nirma University Student Portal.

---

## 🎯 Target Scope & Activation Rule

This extension is configured to be active **STRICTLY AND EXCLUSIVELY** on the official Nirma University Attendance Report page:
```
https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx
```
*(and match pattern `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx*`)*

- On any other domain, website, or portal URL, content scripts will **never inject or execute**.
- Opening the extension popup on any other URL presents an **Inactive State** with a direct one-click button to open the attendance report page.

---

## 🚀 Key Features

1. **Automatic Attendance Detection:**
   - Automatically detects attendance tables on `StudentAttendanceReport.aspx`.
   - Extracts: Course Code, Course Name, Component (Lecture vs. Practical vs. Tutorial), Present Sessions, Absent Sessions, Total Sessions.
   - Separate accounting for Lectures and Practicals (never merged or confused).
   - Dynamically tracks portal updates with `MutationObserver`.
   - Recomputes exact attendance percentages using verified session counts.

2. **What-If Projection Simulator:**
   - **Scenario A (Miss Classes):** Live recalculation for 1, 2, 3, or custom absences using `Present / (Total + Absences) * 100`.
   - **Scenario B (Attend Classes):** Live recalculation for attending 1, 2, 3, or custom consecutive classes using `(Present + Attended) / (Total + Attended) * 100`.
   - Side-by-side display of current vs projected attendance.

3. **Attendance Target Calculator (75%, 80%, 85%, 90%):**
   - **Safe Bunk Allowance:** Exact maximum number of classes you can afford to miss without dropping below your target: $\lfloor \frac{\text{Present}}{\text{Target}} - \text{Total} \rfloor$.
   - **Deficit Recovery:** Exact consecutive classes you must attend to pull attendance back to or above your target: $\lceil \frac{\text{Target} \times \text{Total} - \text{Present}}{1 - \text{Target}} \rceil$.

4. **Non-Intrusive In-Page Integration:**
   - Floating Action Button (FAB) at bottom-right showing live attendance score and subject count.
   - Inline `⚡ Calc` button next to each course row in the university table.
   - Smooth slide-out side drawer containing course cards, target toggles, and live steppers.

5. **Popup & Standalone Dashboard:**
   - **Popup:** Instant overview of total courses, overall percentage, and compliant vs low attendance counts.
   - **Full Dashboard:** Full-screen analytics, batch what-if simulator ("what if I miss 1 class in all subjects?"), search filters, and printable PDF reports.

6. **Privacy & Security:**
   - 100% client-side local execution.
   - Zero external API requests, analytics, or tracking.
   - Does not touch login credentials or authentication cookies.

---

## 📁 Project Architecture

```
Nirma Smart Attendance/
├── manifest.json              # Chrome Manifest V3 configuration
├── background/
│   └── service-worker.js     # Background worker & tab URL state watcher
├── content/
│   ├── attendance-detector.js # Table parsing & MutationObserver
│   ├── attendance-calculator.js # Projection & target math
│   ├── page-integration.js    # FAB, slide-out drawer, & inline triggers
│   └── styles.css             # Scoped modern light-theme stylesheet
├── popup/
│   ├── popup.html             # Context-aware extension popup
│   ├── popup.css              # Popup styling
│   └── popup.js               # Popup logic & active tab verification
├── dashboard/
│   ├── dashboard.html         # Full-screen attendance dashboard
│   ├── dashboard.css          # Dashboard styling & print media styles
│   └── dashboard.js           # Batch simulation & reporting engine
├── utils/
│   ├── calculations.js        # Core verified mathematical formulas
│   └── storage.js             # chrome.storage.local wrapper
├── assets/
│   └── icons/                 # Crisp icons (16px, 32px, 48px, 128px)
├── what to do.md              # Project specifications
└── README.md                  # Documentation
```

---

## 🛠️ Installation Instructions

1. Open **Google Chrome** (or any Chromium browser such as Edge, Brave, etc.).
2. Navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click **Load unpacked** in the top-left corner.
5. Select this directory:
   `a:\All Android\other_project_windows\Nirma Smart Attendance`
6. The extension **Nirma Smart Attendance** will now appear in your extensions list!

---

## 🧪 Testing & Verification Instructions

### 1. Verification Outside the Target Page (Inactive State)
1. Open any regular website (e.g. `https://google.com` or `https://github.com`).
2. Click the **Nirma Smart Attendance** extension icon in your toolbar.
3. Verify that the **Inactive State** UI appears:
   - Status badge shows inactive / locked.
   - Direct link to `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx` is displayed.
   - "Open Attendance Page" button is visible and clickable.

### 2. Verification on Nirma Portal (Active State)
1. Navigate to:
   `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`
2. Log in with your Nirma credentials and load your student attendance report.
3. Observe:
   - The **Smart Attendance FAB** appears at the bottom-right corner displaying your current overall attendance percentage.
   - An inline `⚡ Calc` button appears alongside courses in the attendance table.
   - Clicking the FAB or any row's `⚡ Calc` button smoothly opens the slide-out drawer.
   - Clicking the toolbar popup displays the active course summary and compliance statistics.

### 3. Simulation & Math Verification
- Change the target between 75%, 80%, 85%, and 90% and observe instant recalculation of safe bunks and required recovery classes.
- Use the `+` and `-` steppers on any course card to test projected attendance for upcoming absences or attendances.
