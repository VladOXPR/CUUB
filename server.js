
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const batteryIdMap = require('./public/batteryIdMap');
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
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));



// API cache
const apiCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

const getCachedData = (key) => {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    apiCache.delete(key);
    return null;
};

app.get('/map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/map.html'));
});

app.get('/:batteryId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
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

    const stationIds = ['DTN00872', 'DTN00971', 'DTN00970', 'BJH09881', 'BJH09883'];
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
            
            // Map station names and coordinates
            const stationInfo = {
                'DTN00872': {
                    name: 'DePaul LP Student Center',
                    coordinates: [-87.65415, 41.92335]
                },
                'DTN00971': {
                    name: 'DePaul University Loop',
                    coordinates: [-87.6298, 41.8776]
                },
                'DTN00970': {
                    name: 'DePaul Theater School',
                    coordinates: [-87.65875687443715, 41.92483761368347]
                },
                'BJH09881': {
                    name: 'Parlay Lincoln Park',
                    coordinates: [-87.65328, 41.92927]
                },
                'BJH09883': {
                    name: "Kelly's Pub",
                    coordinates: [-87.65298, 41.92158]
                }
            };

            return {
                id,
                name: stationInfo[id]?.name || `Station ${id}`,
                coordinates: stationInfo[id]?.coordinates || [0, 0],
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






// Admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
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
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

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
