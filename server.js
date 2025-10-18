
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const batteryIdMap = require('./public/batteryIdMap');
const { locationManager } = require('./locations.js');
const compression = require('compression');

const app = express();

// Middleware optimization
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware for better performance
app.use(compression());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// API cache
const apiCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

// Analytics storage
let analyticsData = {
    totalVisits: 0,
    landingPageVisits: 0,
    batteryPageVisits: 0,
    uniqueVisitors: new Set(),
    visitsByBatteryId: new Map(),
    dailyVisits: new Map(),
    hourlyVisits: new Map()
};

// Database file path
const DB_FILE = path.join(__dirname, 'db.json');

// Load analytics data from JSON file
function loadAnalyticsData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            analyticsData = {
                totalVisits: data.analytics.totalVisits || 0,
                landingPageVisits: data.analytics.landingPageVisits || 0,
                batteryPageVisits: data.analytics.batteryPageVisits || 0,
                uniqueVisitors: new Set(data.analytics.uniqueVisitors || []),
                visitsByBatteryId: new Map(Object.entries(data.analytics.visitsByBatteryId || {})),
                dailyVisits: new Map(Object.entries(data.analytics.dailyVisits || {})),
                hourlyVisits: new Map(Object.entries(data.analytics.hourlyVisits || {}))
            };
            console.log('Analytics data loaded from database');
        } else {
            console.log('No existing analytics database found, starting fresh');
        }
    } catch (error) {
        console.error('Error loading analytics data:', error);
        console.log('Starting with fresh analytics data');
    }
}

// Save analytics data to JSON file
function saveAnalyticsData() {
    try {
        const data = {
            analytics: {
                totalVisits: analyticsData.totalVisits,
                landingPageVisits: analyticsData.landingPageVisits,
                batteryPageVisits: analyticsData.batteryPageVisits,
                uniqueVisitors: Array.from(analyticsData.uniqueVisitors),
                visitsByBatteryId: Object.fromEntries(analyticsData.visitsByBatteryId),
                dailyVisits: Object.fromEntries(analyticsData.dailyVisits),
                hourlyVisits: Object.fromEntries(analyticsData.hourlyVisits)
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log('Analytics data saved to database');
    } catch (error) {
        console.error('Error saving analytics data:', error);
    }
}

const getCachedData = (key) => {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    apiCache.delete(key);
    return null;
};

// Analytics tracking middleware - only for specific routes
const trackAnalytics = (req, res, next) => {
    const path = req.path;
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Skip tracking for demo routes
    if (path.startsWith('/demo')) {
        return next();
    }
    
    // Create a simple visitor ID based on IP and User Agent
    const visitorId = `${ip}-${userAgent}`.substring(0, 50);
    
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey = `${dateKey}-${now.getHours()}`; // YYYY-MM-DD-HH
    
    // Track total visits
    analyticsData.totalVisits++;
    
    // Track unique visitors
    analyticsData.uniqueVisitors.add(visitorId);
    
    // Track daily visits
    analyticsData.dailyVisits.set(dateKey, (analyticsData.dailyVisits.get(dateKey) || 0) + 1);
    
    // Track hourly visits
    analyticsData.hourlyVisits.set(hourKey, (analyticsData.hourlyVisits.get(hourKey) || 0) + 1);
    
    // Track specific page types
    if (path === '/') {
        analyticsData.landingPageVisits++;
    } else if (path.length > 1) {
        // This is a battery ID page
        analyticsData.batteryPageVisits++;
        const batteryId = path.substring(1);
        analyticsData.visitsByBatteryId.set(batteryId, (analyticsData.visitsByBatteryId.get(batteryId) || 0) + 1);
    }
    
    // Save data to file after each update
    saveAnalyticsData();
    
    next();
};

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));

// Admin route (must come before the catch-all battery ID route)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/map.html'));
});

// Landing page route with analytics tracking
app.get('/', trackAnalytics, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index-backup.html'));
});

// Battery ID routes with analytics tracking (only for valid battery IDs)
app.get('/:batteryId', (req, res, next) => {
    const batteryId = req.params.batteryId;
    
    // Skip static files and other non-battery ID routes
    if (batteryId.includes('.') || batteryId === 'favicon.ico' || batteryId === 'robots.txt' || batteryId === 'sitemap.xml') {
        return next(); // Let static middleware handle these
    }
    
    // Apply analytics tracking for valid battery IDs
    trackAnalytics(req, res, () => {
        res.sendFile(path.join(__dirname, 'public/index-backup.html'));
    });
});

// Input validation middleware
const validateBatteryId = (req, res, next) => {
    const { batteryId } = req.params;
    if (!batteryId || !batteryIdMap[batteryId]) {
        return res.status(400).json({ error: "Invalid battery ID" });
    }
    next();
};



// Station data endpoint
app.get('/api/stations', async (req, res) => {
    const cacheKey = 'stations';
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
        return res.json(cachedData);
    }

    const stationIds = locationManager.getAllIds();
    const stationPromises = stationIds.map(async (id) => {
        try {
            const response = await fetch(`https://developer.chargenow.top/cdb-open-api/v1/rent/cabinet/query?deviceId=${id}`, {
                method: 'GET',
                headers: {
                    "Authorization": "Basic VmxhZFZhbGNoa292OlZWMTIxMg==",
                    "Content-Type": "application/json"
                },
                timeout: 10000,
                redirect: 'follow'
            });

            if (!response.ok) {
                console.error(`Failed to fetch station ${id}: ${response.status}`);
                return { id, error: true };
            }

            const data = await response.json();
            
            // Get station info from centralized location data
            const stationInfo = locationManager.getById(id);

            return {
                id,
                name: stationInfo?.name || `Station ${id}`,
                coordinates: stationInfo?.coordinates || [0, 0],
                available: data.data?.cabinet?.emptySlots || 0,
                occupied: data.data?.cabinet?.busySlots || 0,
                error: false
            };

        } catch (error) {
            console.error(`Error fetching station ${id}:`, error);
            return { id, error: true };
        }
    });

    try {
        const stations = await Promise.all(stationPromises);
        
        // Cache the result
        apiCache.set(cacheKey, {
            data: stations,
            timestamp: Date.now()
        });
        
        res.json(stations);
    } catch (error) {
        console.error('Error fetching station data:', error);
        res.status(500).json({ error: 'Failed to fetch station data' });
    }
});

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    
    if (apiKey !== 'cuubisgoated123') {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
    next();
};

// Locations data endpoint
app.get('/api/locations', (req, res) => {
    res.json(locationManager.getForMap());
});

// Add new location endpoint
app.post('/api/locations', authenticateApiKey, (req, res) => {
    try {
        const { id, name, address, coordinates } = req.body;
        
        // Validate required fields
        if (!id || !name || !address || !coordinates) {
            return res.status(400).json({ 
                error: 'Missing required fields. Required: id, name, address, coordinates' 
            });
        }
        
        // Validate coordinates format
        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            return res.status(400).json({ 
                error: 'Coordinates must be an array with exactly 2 elements [longitude, latitude]' 
            });
        }
        
        // Check if location already exists
        if (locationManager.getById(id)) {
            return res.status(409).json({ 
                error: `Location with ID '${id}' already exists` 
            });
        }
        
        // Add the new location
        locationManager.add(id, {
            name,
            address,
            coordinates
        });
        
        res.status(201).json({ 
            message: 'Location added successfully',
            location: locationManager.getById(id)
        });
        
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove location endpoint
app.delete('/api/locations/:id', authenticateApiKey, (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if location exists
        if (!locationManager.getById(id)) {
            return res.status(404).json({ 
                error: `Location with ID '${id}' not found` 
            });
        }
        
        // Remove the location
        locationManager.remove(id);
        
        res.json({ 
            message: `Location '${id}' removed successfully` 
        });
        
    } catch (error) {
        console.error('Error removing location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Battery data endpoint
app.get('/api/battery/:batteryId', validateBatteryId, async (req, res) => {
    const customBatteryId = req.params.batteryId;
    const realBatteryId = batteryIdMap[customBatteryId];
    
    const cacheKey = `battery_${realBatteryId}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await fetch("https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100", {
            method: 'GET',
            headers: {
                "Authorization": "Basic VmxhZFZhbGNoa292OlZWMTIxMg==",
                "Content-Type": "application/json"
            },
            timeout: 10000,
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.page || !result.page.records) {
            throw new Error("Invalid API response structure");
        }

        // Find record matching real battery ID
        const matchingRecord = result.page.records.find(record => record.pBatteryid === realBatteryId);
        if (matchingRecord) {
            // Cache the result
            apiCache.set(cacheKey, {
                data: matchingRecord,
                timestamp: Date.now()
            });
            res.json(matchingRecord);
        } else {
            res.status(404).json({ error: "Battery not found in API data" });
        }
    } catch (error) {
        console.error("Error fetching battery data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});






// Analytics API endpoints
app.get('/api/analytics', (req, res) => {
    try {
        const analytics = {
            totalVisits: analyticsData.totalVisits,
            landingPageVisits: analyticsData.landingPageVisits,
            batteryPageVisits: analyticsData.batteryPageVisits,
            uniqueVisitors: analyticsData.uniqueVisitors.size,
            visitsByBatteryId: Object.fromEntries(analyticsData.visitsByBatteryId),
            dailyVisits: Object.fromEntries(analyticsData.dailyVisits),
            hourlyVisits: Object.fromEntries(analyticsData.hourlyVisits),
            lastUpdated: new Date().toISOString()
        };
        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        const summary = {
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
        res.json(summary);
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});


// Logging middleware for development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    saveAnalyticsData();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    saveAnalyticsData();
    process.exit(0);
});

// Load analytics data on startup
loadAnalyticsData();

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});

module.exports = app;
