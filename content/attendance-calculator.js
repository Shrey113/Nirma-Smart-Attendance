/**
 * Nirma Smart Attendance - Attendance Calculator Module
 * Calculates projections, target analysis, and interactive scenarios for detected subjects.
 */
(function (root) {
  'use strict';

  class AttendanceCalculator {
    constructor() {
      this.targetPercentage = 85;
      this.init();
    }

    async init() {
      if (root.AttendanceStorage) {
        this.targetPercentage = await root.AttendanceStorage.getTargetPercentage();
      }
    }

    setTargetPercentage(target) {
      this.targetPercentage = Number(target) || 75;
      if (root.AttendanceStorage) {
        root.AttendanceStorage.setTargetPercentage(this.targetPercentage);
      }
    }

    /**
     * Compute full projections and target status for a single subject record
     * @param {Object} record - Subject attendance record
     * @param {number} [customTarget]
     * @returns {Object} Comprehensive projection analysis
     */
    analyzeSubject(record, customTarget = null) {
      const target = customTarget !== null ? Number(customTarget) : this.targetPercentage;
      const calc = root.AttendanceCalculations;
      const p = Number(record.present) || 0;
      const t = Number(record.total) || 0;

      const currentPercentage = calc.calculatePercentage(p, t);
      const statusLevel = calc.getStatusLevel(currentPercentage, target);
      const safeBunks = calc.calculateSafeBunks(p, t, target);
      const requiredClasses = calc.calculateRequiredClasses(p, t, target);

      // Scenario A - What if I miss classes?
      const missScenarios = [1, 2, 3, 4].map(abs => {
        return {
          absences: abs,
          ...calc.simulateAbsences(p, t, abs)
        };
      });

      // Scenario B - What if I attend classes?
      const attendScenarios = [1, 2, 3, 4].map(att => {
        return {
          attended: att,
          ...calc.simulateAttended(p, t, att)
        };
      });

      return {
        id: record.id,
        courseCode: record.courseCode,
        courseName: record.courseName,
        courseShortName: record.courseShortName,
        loadType: record.loadType,
        present: p,
        absent: Number(record.absent) || (t - p),
        total: t,
        currentPercentage: currentPercentage,
        target: target,
        statusLevel: statusLevel, // 'safe' | 'warning' | 'danger'
        isBelowTarget: currentPercentage < target,
        safeBunks: safeBunks,
        requiredClasses: requiredClasses,
        missScenarios: missScenarios,
        attendScenarios: attendScenarios
      };
    }

    /**
     * Simulate custom absence or attendance inputs
     */
    simulateCustom(record, { missCount = 0, attendCount = 0 }) {
      const calc = root.AttendanceCalculations;
      const p = Number(record.present) || 0;
      const t = Number(record.total) || 0;
      const miss = Math.max(0, parseInt(missCount, 10) || 0);
      const att = Math.max(0, parseInt(attendCount, 10) || 0);

      const newPresent = p + att;
      const newTotal = t + att + miss;
      const currentPct = calc.calculatePercentage(p, t);
      const newPct = calc.calculatePercentage(newPresent, newTotal);

      return {
        originalPercentage: currentPct,
        newPresent: newPresent,
        newTotal: newTotal,
        newPercentage: newPct,
        diff: Math.round((newPct - currentPct) * 100) / 100,
        statusLevel: calc.getStatusLevel(newPct, this.targetPercentage)
      };
    }

    /**
     * Batch analyze an array of records
     */
    analyzeAll(records, customTarget = null) {
      const target = customTarget !== null ? Number(customTarget) : this.targetPercentage;
      const analyses = records.map(r => this.analyzeSubject(r, target));
      const calc = root.AttendanceCalculations;
      const aggregates = calc.calculateAggregates(records, target);

      return {
        subjects: analyses,
        aggregates: aggregates,
        target: target
      };
    }
  }

  // Export singleton instance
  root.attendanceCalculator = new AttendanceCalculator();
})(typeof self !== 'undefined' ? self : this);
