# Nirma Smart Attendance

A clean, client-side attendance intelligence calculator and leave simulator for Nirma University Student Portal.

---

## 1. How to Use It

1. **Install the Extension:**
   - Open your browser (Chrome, Brave, Edge) and go to `chrome://extensions/`.
   - Turn on **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select this folder (`Nirma Smart Attendance`).

2. **Open Your Attendance Report:**
   - Navigate to the Nirma University attendance portal:
     `https://mis.nirmauni.ac.in/Reports/StudentAttendanceReport.aspx`
   - Log in and open your student attendance report.

3. **Calculate Leaves & Simulate:**
   - Click the **Info** button added next to any course row in the table to open the course deep-dive drawer.
   - Toggle target thresholds (**75%**, **80%**, **85%**, **90%**) to instantly see how many classes you can safely miss or need to attend.
   - Use the **+** and **-** steppers in the Custom Leave Simulator to project upcoming leaves with zero lag.
   - Click the extension icon in the toolbar or click **Full View** for the full analytics dashboard.

---

## 2. Preview

<!-- Add your preview image/screenshot below -->
![Preview](assets/preview.png)

---

## 3. Privacy & Protection (100% Local — No AI / No External Calls)

- **Pure HTML Parsing:** All data is parsed locally from the HTML table already rendered in your browser tab.
- **Zero AI API Calls:** No external AI models, cloud processors, or third-party servers are used.
- **No External Network Requests:** Every calculation, formula, and simulation runs locally via browser JavaScript with zero telemetry or tracking.
- **Safe & Private:** Your login credentials, session cookies, and student records never leave your local device.
