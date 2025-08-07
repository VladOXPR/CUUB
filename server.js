
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const batteryIdMap = require('./public/batteryIdMap');
const twilio = require('twilio');
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

// Twilio configuration with Verify service
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    console.error('Missing Twilio environment variables. Please check your .env file.');
    process.exit(1);
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
console.log('Twilio initialized with Verify service');

// In-memory storage for phone numbers (you may want to use a database in production)
const phoneNumberStorage = new Map();

// In-memory storage for verification codes
const verificationStorage = new Map();

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

const validatePhoneNumber = (req, res, next) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
    }
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
        return res.status(400).json({ error: "Invalid phone number format" });
    }
    
    req.cleanPhone = cleanPhone;
    next();
};

// Rate limiting for verification endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 3;

const checkRateLimit = (identifier) => {
    const now = Date.now();
    const requests = rateLimitMap.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= MAX_REQUESTS) {
        return false;
    }
    
    validRequests.push(now);
    rateLimitMap.set(identifier, validRequests);
    return true;
};

// Station data endpoint
app.get('/api/stations', async (req, res) => {
    const cacheKey = 'stations';
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
        return res.json(cachedData);
    }

    const stationIds = ['DTN00872', 'DTN00971', 'DTN00970', 'BJH09881', 'BJH09882'];
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
                    name: 'DePaul University LP Student Center', 
                    coordinates: [-87.65415, 41.92335] 
                },
                'DTN00971': { 
                    name: 'DePaul University Loop Student Center', 
                    coordinates: [-87.62726, 41.87799] 
                },
                'DTN00970': { 
                    name: 'DePaul University Theater School', 
                    coordinates: [-87.65875687443715, 41.92483761368347] 
                },
                'BJH09881': { 
                    name: 'Parlay Lincoln Park', 
                    coordinates: [-87.65328, 41.92927] 
                },
                'BJH09882': {
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

// Phone number collection endpoints
app.post('/api/phone/:batteryId/send-code', validateBatteryId, validatePhoneNumber, async (req, res) => {
    const customBatteryId = req.params.batteryId;
    const phoneNumber = req.cleanPhone;
    
    // Check rate limiting
    if (!checkRateLimit(phoneNumber)) {
        return res.status(429).json({ error: "Too many verification attempts. Please try again later." });
    }
    
    try {
        const formattedPhone = `+1${phoneNumber}`;
        
        // Store verification data temporarily
        verificationStorage.set(customBatteryId, {
            phoneNumber: phoneNumber,
            expires: Date.now() + 600000 // 10 minutes
        });

        // Use Twilio Verify to send verification code
        const verification = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
            .verifications
            .create({to: formattedPhone, channel: 'sms'});

        console.log(`Verification sent to ${formattedPhone} for battery ${customBatteryId}, SID: ${verification.sid}`);

        res.json({ 
            success: true, 
            message: "Verification code sent successfully"
        });
    } catch (error) {
        console.error('Error sending verification:', error);
        res.status(500).json({ error: "Failed to send verification code" });
    }
});

// Endpoint to verify code and complete registration
app.post('/api/phone/:batteryId/verify-code', async (req, res) => {
    const customBatteryId = req.params.batteryId;
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Verification code is required" });
    }

    const verificationData = verificationStorage.get(customBatteryId);

    if (!verificationData) {
        return res.status(404).json({ error: "No verification request found" });
    }

    if (Date.now() > verificationData.expires) {
        verificationStorage.delete(customBatteryId);
        return res.status(400).json({ error: "Verification code expired" });
    }

    try {
        const formattedPhone = `+1${verificationData.phoneNumber}`;
        
        // Use Twilio Verify to check verification code
        const verificationCheck = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks
            .create({to: formattedPhone, code: code});

        if (verificationCheck.status === 'approved') {
            // Store the phone number data
            const realBatteryId = batteryIdMap[customBatteryId];
            
            phoneNumberStorage.set(customBatteryId, {
                batteryId: customBatteryId,
                phoneNumber: verificationData.phoneNumber,
                realBatteryId: realBatteryId,
                orderId: `ORDER_${Date.now()}`,
                timestamp: new Date().toISOString()
            });
            
            // Clean up verification storage
            verificationStorage.delete(customBatteryId);
            
            console.log(`Phone verification successful for battery ${customBatteryId}, phone: ${verificationData.phoneNumber}`);
            
            res.json({ 
                success: true, 
                message: "Phone number verified and registered successfully"
            });
        } else {
            res.status(400).json({ error: "Invalid verification code" });
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ error: "Failed to verify code" });
    }
});

// Check if phone number exists for battery
app.get('/api/phone/:batteryId', validateBatteryId, (req, res) => {
    const customBatteryId = req.params.batteryId;
    const phoneData = phoneNumberStorage.get(customBatteryId);
    
    if (phoneData) {
        res.json({ 
            hasPhone: true, 
            phoneNumber: phoneData.phoneNumber,
            orderId: phoneData.orderId 
        });
    } else {
        res.json({ hasPhone: false });
    }
});

// Admin endpoints
app.get('/api/admin/phones', (req, res) => {
    const phoneData = Array.from(phoneNumberStorage.values());
    res.json(phoneData);
});

app.get('/api/admin/export-excel', (req, res) => {
    try {
        const phoneData = Array.from(phoneNumberStorage.values());
        
        if (phoneData.length === 0) {
            return res.status(404).json({ error: 'No data to export' });
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(phoneData);
        
        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Phone Numbers');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=phone_numbers.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);
    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
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
