/**
 * QR Stats Module
 * Handles all QR code visit tracking and analytics
 */

const fs = require('fs');
const path = require('path');

// Database file path
const STATS_FILE = path.join(__dirname, 'qrStats.json');

// Analytics storage
let analyticsData = {
    totalVisits: 0,
    landingPageVisits: 0,
    batteryPageVisits: 0,
    uniqueVisitors: new Set(),
    visitsByBatteryId: new Map(),
    dailyVisits: new Map(),
    hourlyVisits: new Map(),
    visitLog: [] // Array of { date, batteryId, timestamp }
};

/**
 * Load analytics data from JSON file
 */
function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
            analyticsData = {
                totalVisits: data.analytics.totalVisits || 0,
                landingPageVisits: data.analytics.landingPageVisits || 0,
                batteryPageVisits: data.analytics.batteryPageVisits || 0,
                uniqueVisitors: new Set(data.analytics.uniqueVisitors || []),
                visitsByBatteryId: new Map(Object.entries(data.analytics.visitsByBatteryId || {})),
                dailyVisits: new Map(Object.entries(data.analytics.dailyVisits || {})),
                hourlyVisits: new Map(Object.entries(data.analytics.hourlyVisits || {})),
                visitLog: data.analytics.visitLog || []
            };
            console.log('QR Stats loaded from database');
        } else {
            console.log('No existing QR stats database found, starting fresh');
        }
    } catch (error) {
        console.error('Error loading QR stats:', error);
        console.log('Starting with fresh QR stats data');
    }
}

/**
 * Save analytics data to JSON file
 */
function saveStats() {
    try {
        const data = {
            analytics: {
                totalVisits: analyticsData.totalVisits,
                landingPageVisits: analyticsData.landingPageVisits,
                batteryPageVisits: analyticsData.batteryPageVisits,
                uniqueVisitors: Array.from(analyticsData.uniqueVisitors),
                visitsByBatteryId: Object.fromEntries(analyticsData.visitsByBatteryId),
                dailyVisits: Object.fromEntries(analyticsData.dailyVisits),
                hourlyVisits: Object.fromEntries(analyticsData.hourlyVisits),
                visitLog: analyticsData.visitLog
            }
        };
        fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
        console.log('QR Stats saved to database');
    } catch (error) {
        console.error('Error saving QR stats:', error);
    }
}

/**
 * Track a page visit
 * @param {string} pagePath - The path being visited
 * @param {string} ip - Visitor IP address
 * @param {string} userAgent - Visitor user agent
 */
function trackVisit(pagePath, ip, userAgent) {
    // Skip tracking for demo, home, and admin routes
    const skipPaths = ['/', '/demo', '/admin', '/admin.html', '/qrStats.html', '/stats'];
    if (skipPaths.includes(pagePath) || pagePath.startsWith('/demo')) {
        return;
    }
    
    // Create a simple visitor ID based on IP and User Agent
    const visitorId = `${ip}-${userAgent}`.substring(0, 50);
    
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey = `${dateKey}-${now.getHours()}`; // YYYY-MM-DD-HH
    
    // Only track battery ID pages (QR code scans)
    if (pagePath.length > 1) {
        const batteryId = pagePath.substring(1);
        
        // Track total visits
        analyticsData.totalVisits++;
        
        // Track unique visitors
        analyticsData.uniqueVisitors.add(visitorId);
        
        // Track daily visits
        analyticsData.dailyVisits.set(dateKey, (analyticsData.dailyVisits.get(dateKey) || 0) + 1);
        
        // Track hourly visits
        analyticsData.hourlyVisits.set(hourKey, (analyticsData.hourlyVisits.get(hourKey) || 0) + 1);
        
        // Track battery page visits
        analyticsData.batteryPageVisits++;
        analyticsData.visitsByBatteryId.set(batteryId, (analyticsData.visitsByBatteryId.get(batteryId) || 0) + 1);
        
        // Log battery page visit
        analyticsData.visitLog.push({
            date: dateKey,
            batteryId: batteryId,
            timestamp: now.toISOString()
        });
        
        // Save data to file after each update
        saveStats();
    }
}

/**
 * Express middleware for tracking analytics
 */
function trackingMiddleware(req, res, next) {
    const pagePath = req.path;
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    trackVisit(pagePath, ip, userAgent);
    next();
}

/**
 * Get full analytics data
 * @returns {Object} Full analytics object
 */
function getStats() {
    return {
        totalVisits: analyticsData.totalVisits,
        landingPageVisits: analyticsData.landingPageVisits,
        batteryPageVisits: analyticsData.batteryPageVisits,
        uniqueVisitors: analyticsData.uniqueVisitors.size,
        visitsByBatteryId: Object.fromEntries(analyticsData.visitsByBatteryId),
        dailyVisits: Object.fromEntries(analyticsData.dailyVisits),
        hourlyVisits: Object.fromEntries(analyticsData.hourlyVisits),
        visitLog: analyticsData.visitLog,
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Get analytics summary with top battery IDs
 * @returns {Object} Summary analytics object
 */
function getStatsSummary() {
    return {
        totalVisits: analyticsData.totalVisits,
        landingPageVisits: analyticsData.landingPageVisits,
        batteryPageVisits: analyticsData.batteryPageVisits,
        uniqueVisitors: analyticsData.uniqueVisitors.size,
        topBatteryIds: Array.from(analyticsData.visitsByBatteryId.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id, visits]) => ({ batteryId: id, visits })),
        lastUpdated: new Date().toISOString()
    };
}

module.exports = {
    loadStats,
    saveStats,
    trackVisit,
    trackingMiddleware,
    getStats,
    getStatsSummary
};

