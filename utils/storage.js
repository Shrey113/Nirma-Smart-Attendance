/**
 * Nirma Smart Attendance - Storage Utility
 * Handles persistence for targets, preferences, and offline cache using chrome.storage.local
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AttendanceStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEYS = {
    TARGET_PERCENTAGE: 'nsa_target_percentage',
    ATTENDANCE_CACHE: 'nsa_attendance_cache',
    LAST_UPDATED: 'nsa_last_updated',
    SETTINGS: 'nsa_settings'
  };

  const DEFAULT_SETTINGS = {
    targetPercentage: 85,
    autoOpenDrawer: false,
    showBadgesInTable: true,
    compactView: false
  };

  const isChromeStorageAvailable = () => {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  };

  const Storage = {
    /**
     * Get user target percentage (default: 85)
     */
    async getTargetPercentage() {
      if (isChromeStorageAvailable()) {
        const res = await chrome.storage.local.get([STORAGE_KEYS.TARGET_PERCENTAGE]);
        return Number(res[STORAGE_KEYS.TARGET_PERCENTAGE]) || DEFAULT_SETTINGS.targetPercentage;
      }
      const val = localStorage.getItem(STORAGE_KEYS.TARGET_PERCENTAGE);
      return Number(val) || DEFAULT_SETTINGS.targetPercentage;
    },

    /**
     * Set user target percentage
     */
    async setTargetPercentage(target) {
      const num = Number(target) || 75;
      if (isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.TARGET_PERCENTAGE]: num });
      } else {
        localStorage.setItem(STORAGE_KEYS.TARGET_PERCENTAGE, String(num));
      }
      return num;
    },

    /**
     * Cache extracted attendance records
     */
    async saveAttendanceData(records) {
      const payload = {
        [STORAGE_KEYS.ATTENDANCE_CACHE]: records,
        [STORAGE_KEYS.LAST_UPDATED]: new Date().toISOString()
      };
      if (isChromeStorageAvailable()) {
        await chrome.storage.local.set(payload);
      } else {
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE_CACHE, JSON.stringify(records));
        localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, payload[STORAGE_KEYS.LAST_UPDATED]);
      }
    },

    /**
     * Get cached attendance data
     */
    async getAttendanceData() {
      if (isChromeStorageAvailable()) {
        const res = await chrome.storage.local.get([
          STORAGE_KEYS.ATTENDANCE_CACHE,
          STORAGE_KEYS.LAST_UPDATED
        ]);
        return {
          records: res[STORAGE_KEYS.ATTENDANCE_CACHE] || [],
          lastUpdated: res[STORAGE_KEYS.LAST_UPDATED] || null
        };
      }
      const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_CACHE);
      const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
      return {
        records: raw ? JSON.parse(raw) : [],
        lastUpdated
      };
    },

    /**
     * Get settings
     */
    async getSettings() {
      if (isChromeStorageAvailable()) {
        const res = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
        return Object.assign({}, DEFAULT_SETTINGS, res[STORAGE_KEYS.SETTINGS] || {});
      }
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, raw ? JSON.parse(raw) : {});
    },

    /**
     * Save settings
     */
    async saveSettings(newSettings) {
      const current = await this.getSettings();
      const merged = Object.assign({}, current, newSettings);
      if (isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
      } else {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      }
      return merged;
    }
  };

  return Storage;
});
