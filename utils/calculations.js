/**
 * Nirma Smart Attendance - Calculation Engine
 * Core formulas for attendance percentages, what-if projections, and target thresholds.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AttendanceCalculations = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const Calculations = {
    /**
     * Compute attendance percentage safely from session counts.
     * @param {number} present 
     * @param {number} total 
     * @returns {number} Percentage with 2 decimals
     */
    calculatePercentage(present, total) {
      const p = Number(present) || 0;
      const t = Number(total) || 0;
      if (t <= 0) return 0;
      return Math.round((p / t) * 10000) / 100;
    },

    /**
     * Scenario A: What if the student misses X additional classes?
     * Formula: present / (total + additionalAbsences) * 100
     * @param {number} present 
     * @param {number} total 
     * @param {number} additionalAbsences 
     * @returns {{ newPresent: number, newTotal: number, newPercentage: number, diff: number }}
     */
    simulateAbsences(present, total, additionalAbsences) {
      const p = Number(present) || 0;
      const t = Number(total) || 0;
      const addAbs = Math.max(0, parseInt(additionalAbsences, 10) || 0);

      const newTotal = t + addAbs;
      const currentPct = this.calculatePercentage(p, t);
      const newPct = this.calculatePercentage(p, newTotal);

      return {
        newPresent: p,
        newTotal: newTotal,
        newPercentage: newPct,
        diff: Math.round((newPct - currentPct) * 100) / 100
      };
    },

    /**
     * Scenario B: What if the student attends X consecutive classes?
     * Formula: (present + additionalAttended) / (total + additionalAttended) * 100
     * @param {number} present 
     * @param {number} total 
     * @param {number} additionalAttended 
     * @returns {{ newPresent: number, newTotal: number, newPercentage: number, diff: number }}
     */
    simulateAttended(present, total, additionalAttended) {
      const p = Number(present) || 0;
      const t = Number(total) || 0;
      const addAtt = Math.max(0, parseInt(additionalAttended, 10) || 0);

      const newPresent = p + addAtt;
      const newTotal = t + addAtt;
      const currentPct = this.calculatePercentage(p, t);
      const newPct = this.calculatePercentage(newPresent, newTotal);

      return {
        newPresent: newPresent,
        newTotal: newTotal,
        newPercentage: newPct,
        diff: Math.round((newPct - currentPct) * 100) / 100
      };
    },

    /**
     * Target Calculator: Max safe absences student can take while staying at or above target.
     * Formula: floor(present / target - total)
     * @param {number} present 
     * @param {number} total 
     * @param {number} targetPercent (e.g. 75, 80, 85, 90)
     * @returns {number} Maximum safe misses (0 if already below target)
     */
    calculateSafeBunks(present, total, targetPercent) {
      const p = Number(present) || 0;
      const t = Number(total) || 0;
      const target = (Number(targetPercent) || 75) / 100;

      if (t === 0 || target <= 0) return 0;
      const currentRatio = p / t;
      if (currentRatio < target) {
        return 0; // Already below target
      }

      // target <= p / (t + M) => t + M <= p / target => M <= (p / target) - t
      const maxMisses = Math.floor((p / target) - t);
      return Math.max(0, maxMisses);
    },

    /**
     * Target Calculator: Number of consecutive classes required to attend to reach target.
     * Formula: ceil((target * total - present) / (1 - target))
     * @param {number} present 
     * @param {number} total 
     * @param {number} targetPercent (e.g. 75, 80, 85, 90)
     * @returns {number|string} Required classes or 'Infinity' if target impossible
     */
    calculateRequiredClasses(present, total, targetPercent) {
      const p = Number(present) || 0;
      const t = Number(total) || 0;
      const target = (Number(targetPercent) || 75) / 100;

      if (t === 0) return 0;
      const currentRatio = p / t;
      if (currentRatio >= target) {
        return 0; // Already satisfied
      }

      if (target >= 1) {
        // Can only reach 100% if no absences ever occurred
        return (t - p === 0) ? 0 : Infinity;
      }

      // (p + C) / (t + C) >= target => C >= (target * t - p) / (1 - target)
      const needed = Math.ceil((target * t - p) / (1 - target));
      return Math.max(0, needed);
    },

    /**
     * Determine status level based on percentage vs target.
     * @param {number} percentage 
     * @param {number} target 
     * @returns {'safe'|'warning'|'danger'}
     */
    getStatusLevel(percentage, target = 75) {
      const pct = Number(percentage) || 0;
      const tgt = Number(target) || 75;

      if (pct >= tgt + 5) {
        return 'safe'; // green
      } else if (pct >= tgt) {
        return 'warning'; // orange/amber
      } else {
        return 'danger'; // red
      }
    },

    /**
     * Calculate summary aggregates across a list of subject records.
     * @param {Array} records 
     * @param {number} target 
     * @returns {Object}
     */
    calculateAggregates(records = [], target = 75) {
      let totalPresent = 0;
      let totalSessions = 0;
      let belowTargetCount = 0;
      let warningCount = 0;
      let safeCount = 0;

      records.forEach(r => {
        const p = Number(r.present) || 0;
        const t = Number(r.total) || 0;
        totalPresent += p;
        totalSessions += t;

        const pct = this.calculatePercentage(p, t);
        const level = this.getStatusLevel(pct, target);
        if (level === 'danger') belowTargetCount++;
        else if (level === 'warning') warningCount++;
        else safeCount++;
      });

      const overallPct = this.calculatePercentage(totalPresent, totalSessions);

      return {
        totalSubjects: records.length,
        totalPresent,
        totalSessions,
        overallPercentage: overallPct,
        belowTargetCount,
        warningCount,
        safeCount,
        statusLevel: this.getStatusLevel(overallPct, target)
      };
    }
  };

  return Calculations;
});
