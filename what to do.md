# Project: Nirma Smart Attendance – Chrome Extension

Act as a senior Chrome Extension developer and UI/UX engineer.

Build a production-quality Chrome Extension called **Nirma Smart Attendance** using Chrome Manifest V3.

## 1. Main Objective

Create an intelligent attendance calculator for the Nirma University student portal.

**Target Page Scope:**
The extension must be active **ONLY** on the specific attendance page:
`https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx` (and match pattern `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx*`). On any other website, page, or portal URL, the extension must remain completely inactive.

The extension must automatically detect attendance information from the currently opened attendance page and calculate future attendance scenarios without requiring manual data entry.

The student should be able to see what happens if they:
- Miss 1 upcoming class.
- Miss 2, 3, 4 or more classes.
- Attend the next 1, 2, 3 or more classes.

All calculations must update instantly.

## 2. Automatic Attendance Detection

Read attendance information directly from the currently visible Nirma University attendance page (`https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`).

Extract:
- Course Code
- Course Name
- Course Short Name
- Load Type (Lecture / Practical)
- Present Sessions
- Absent Sessions
- Total Sessions
- Present Percentage
- Absent Percentage

Important:
- Detect subjects automatically.
- Handle multiple rows for the same subject.
- Keep Lecture and Practical attendance separate.
- Do not combine Lecture and Practical records.
- Recalculate percentages using actual present and total session counts.
- Do not depend only on the displayed percentage.
- Support dynamically loaded tables and page updates.
- Use MutationObserver where necessary.
- Avoid duplicate records when the page updates.

If attendance data cannot be detected, display a clear message instead of showing incorrect calculations.

## 3. What-If Attendance Calculator

For every subject and load type, provide two independent controls:

**Scenario A – What if I miss classes?**
- 1 additional absence
- 2 additional absences
- 3 additional absences
- Custom number of absences

Formula:

New Percentage = Present Sessions / (Total Sessions + Additional Absences) × 100

**Scenario B – What if I attend classes?**
- Attend 1 additional class
- Attend 2 additional classes
- Attend 3 additional classes
- Custom number of attended classes

Formula:

New Percentage = (Present Sessions + Additional Attended Classes) / (Total Sessions + Additional Attended Classes) × 100

Display the current and projected percentages side by side.

## 4. Attendance Target Calculator

Provide selectable attendance targets:
- 75%
- 80%
- 85%
- 90%

Calculate:
- Maximum additional classes the student can miss while maintaining the target.
- Number of consecutive classes required to attend to reach the target.
- Whether the student is currently below the selected target.

Never show misleading safe-absence values.

## 5. UI/UX Design

Create a modern, minimal and professional interface.

Design principles:
- Clean white/light theme.
- Rounded cards.
- Subtle borders and shadows.
- Clear typography.
- Minimal colors.
- Green for safe attendance.
- Orange for warning.
- Red for below-target attendance.
- Responsive design.
- Smooth but subtle animations.

Do not clutter the original Nirma University website.

### Integration with the attendance page

Keep the original attendance table unchanged.

Inject UI elements **strictly and exclusively** when the user is on `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`.
Add only:
- A small Smart Attendance floating button.
- A compact calculator action beside each subject's Details button, if it can be added without breaking the layout.
- A clean slide-out panel or modal for projections.

The extension must not replace or redesign the university portal.

### Extension Popup

Create a polished popup with context-aware states:
- **Active State** (when current tab is `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`):
  - Overall attendance summary.
  - Total subjects detected.
  - Subjects below the selected target.
  - Subject-wise attendance overview.
  - Quick access to the What-If Calculator.
- **Inactive State** (when on any other URL or domain):
  - Clear message indicating the extension is inactive.
  - Direct prompt and one-click button to navigate to `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`.

## 6. Technical Architecture

Use:
- Chrome Extension Manifest V3.
- HTML, CSS and JavaScript or TypeScript.
- Scope and URL Rules:
  - `content_scripts.matches` strictly configured to: `["https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx*"]`.
  - Content scripts must NEVER inject or execute on any other pages or domains.
  - Host permissions restricted strictly to `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx*`.
- Content Scripts for attendance detection and UI injection.
- Background Service Worker where necessary (to manage page-action states or tab URL checks).
- Chrome Storage API for user preferences.
- MutationObserver for dynamic page updates.

Keep the project modular.

Suggested structure:

nirma-smart-attendance/
  manifest.json
  background/
    service-worker.js
  content/
    attendance-detector.js
    attendance-calculator.js
    page-integration.js
  popup/
    popup.html
    popup.css
    popup.js
  dashboard/
    dashboard.html
    dashboard.css
    dashboard.js
  assets/
    icons/
  utils/
    calculations.js
    storage.js

You may improve this structure if needed.

## 7. Security and Privacy

- Restrict extension execution strictly to `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`.
- Do not collect student passwords.
- Do not store login credentials.
- Do not send attendance information to external servers.
- Do not interfere with university login sessions.
- Process attendance locally inside the browser.
- Use minimum required extension permissions.
- Do not bypass authentication or access restricted APIs.

## 8. Error Handling

Handle:
- Active tab is not `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx` (show inactive guidance UI).
- Attendance page not opened.
- User not logged in.
- Attendance table not found.
- Missing or invalid session counts.
- Duplicate attendance rows.
- Page navigation and refresh.
- Dynamic table changes.

Show understandable messages instead of errors.

## 9. Development Instructions

Before implementation:

1. Inspect the actual Nirma University attendance page structure at `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`.
2. Identify its table selectors and DOM structure.
3. Understand how Lecture and Practical rows are represented.
4. Design a reliable attendance extraction system.
5. Implement the calculator independently and test its formulas.
6. Integrate the UI without disturbing the original website.

Do not invent DOM selectors before inspecting the page.

Build the complete working extension, not just a UI prototype.

Provide:
- Complete source code.
- Manifest configuration.
- Installation instructions.
- Testing instructions.
- A README.md.

The final result should feel like a polished commercial Chrome Extension, not a basic student project.