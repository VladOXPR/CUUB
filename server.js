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

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
console.log('Twilio initialized with Verify service');


// In-memory storage for phone numbers (you may want to use a database in production)
const phoneNumberStorage = new Map();

// In-memory storage for verification codes
const verificationStorage = new Map();

app.get('/map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

app.get('/:batteryId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

const rateLimit = (req, res, next) => {
    const key = req.ip + req.params.batteryId;
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const limit = rateLimitMap.get(key);
    if (now > limit.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    if (limit.count >= MAX_REQUESTS) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    
    limit.count++;
    next();
};

// Endpoint to send verification code
app.post('/api/phone/:batteryId/send-code', 
    validateBatteryId, 
    validatePhoneNumber, 
    rateLimit, 
    async (req, res) => {
        const customBatteryId = req.params.batteryId;
        const { phoneNumber } = req.body;
        const cleanPhone = req.cleanPhone;

    // Store verification request (Twilio Verify handles code generation)
    const verificationRequest = {
        phoneNumber: cleanPhone,
        batteryId: customBatteryId,
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
        verified: false
    };

    verificationStorage.set(customBatteryId, verificationRequest);

    try {
        const formattedPhone = `+1${cleanPhone}`;

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

        // Use Twilio Verify to check the verification code
        const verification_check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks
            .create({to: formattedPhone, code: code});

        if (verification_check.status !== 'approved') {
            return res.status(400).json({ error: "Invalid verification code" });
        }

        console.log(`Verification approved for ${formattedPhone}, battery ${customBatteryId}`);
    } catch (error) {
        console.error('Error verifying code:', error);
        return res.status(400).json({ error: "Invalid verification code" });
    }

    // Translate custom ID to real ID
    const realBatteryId = batteryIdMap[customBatteryId];
    if (!realBatteryId) {
        return res.status(404).json({ error: "Battery ID not found" });
    }

    try {
        // Get the order details from the API
        const myHeaders = {
            "Authorization": "Basic VmxhZFZhbGNoa292OlZWMTIxMg==",
            "Content-Type": "application/json"
        };

        const requestOptions = {
            method: 'GET',
            headers: myHeaders,
            credentials: 'include',
            redirect: 'follow'
        };

        const response = await fetch("https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100", requestOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();

        if (!result.page || !result.page.records) {
            throw new Error("Invalid API response structure");
        }

        // Find record matching real battery ID
        const matchingRecord = result.page.records.find(record => record.pBatteryid === realBatteryId);

        // Store verified phone number
        const phoneData = {
            phoneNumber: verificationData.phoneNumber,
            orderId: matchingRecord ? (matchingRecord.id || matchingRecord.pOrderid) : 'Not Found',
            batteryId: customBatteryId,
            realBatteryId: realBatteryId,
            timestamp: new Date().toISOString(),
            batteryFoundInAPI: !!matchingRecord,
            verified: true
        };

        phoneNumberStorage.set(customBatteryId, phoneData);

        // Mark verification as complete
        verificationData.verified = true;
        verificationStorage.set(customBatteryId, verificationData);

        console.log(`Phone number verified: ${verificationData.phoneNumber} for battery ${customBatteryId}, order ${phoneData.orderId}, found in API: ${!!matchingRecord}`);

        res.json({ 
            success: true, 
            message: "Phone number verified successfully",
            batteryFoundInAPI: !!matchingRecord
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to check if phone number is already submitted
app.get('/api/phone/:batteryId', (req, res) => {
    const customBatteryId = req.params.batteryId;
    const phoneData = phoneNumberStorage.get(customBatteryId);

    res.json({ hasPhone: !!phoneData });
});

// Simple in-memory cache
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

const setCachedData = (key, data) => {
    apiCache.set(key, { data, timestamp: Date.now() });
};

// Optimized battery data endpoint with caching
app.get('/api/battery/:batteryId', validateBatteryId, async (req, res) => {
    const customBatteryId = req.params.batteryId;
    const realBatteryId = batteryIdMap[customBatteryId];
    
    // Check cache first
    const cacheKey = `battery_data_${realBatteryId}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
    }

    const myHeaders = {
        "Authorization": "Basic VmxhZFZhbGNoa292OlZWMTIxMg==",
        "Content-Type": "application/json"
    };

    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        timeout: 10000, // 10 second timeout
        redirect: 'follow'
    };

    try {
        const response = await fetch("https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100", requestOptions);
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
            setCachedData(cacheKey, matchingRecord);
            res.json(matchingRecord);
        } else {
            res.status(404).json({ error: "Battery not found in API data" });
        }
    } catch (error) {
        console.error(`Battery API error for ${customBatteryId}:`, error.message);
        res.status(500).json({ error: "Failed to fetch battery data" });
    }
});

// In-memory storage for Sizl webhook tracking
const sizlWebhookStorage = new Map();

// Debug endpoint to view collected phone numbers (remove in production)
app.get('/api/admin/phones', (req, res) => {
    const phones = Array.from(phoneNumberStorage.entries()).map(([batteryId, data]) => ({
        batteryId,
        ...data
    }));
    res.json(phones);
});

// Endpoint to get phone data for a specific battery ID
app.get('/api/phone/data/:batteryId', (req, res) => {
    const batteryId = req.params.batteryId;
    const phoneData = phoneNumberStorage.get(batteryId);

    if (phoneData) {
        res.json(phoneData);
    } else {
        res.status(404).json({ error: 'Phone data not found' });
    }
});

// Webhook endpoint to send user data to Sizl
app.post('/api/sizl/webhook', async (req, res) => {
    const { batteryId, phoneNumber, orderId } = req.body;

    if (!batteryId || !phoneNumber) {
        return res.status(400).json({ error: 'Battery ID and phone number are required' });
    }

    try {
        // Store the webhook request for tracking
        const webhookData = {
            batteryId,
            phoneNumber,
            orderId,
            timestamp: new Date().toISOString(),
            status: 'sent',
            refunded: false
        };

        sizlWebhookStorage.set(batteryId, webhookData);

        // TODO: Replace this URL with the actual Sizl webhook endpoint
        const sizlWebhookUrl = 'https://api.sizl.com/webhook/user-registration'; // Replace with actual URL

        // Send webhook to Sizl (uncomment when you have the real endpoint)
        /*
        const sizlResponse = await fetch(sizlWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_SIZL_API_KEY' // Add your Sizl API key
            },
            body: JSON.stringify({
                rentId: orderId,
                phoneNumber: phoneNumber,
                batteryId: batteryId,
                callbackUrl: `${req.protocol}://${req.get('host')}/api/sizl/confirmation`
            })
        });

        if (!sizlResponse.ok) {
            throw new Error(`Sizl webhook failed: ${sizlResponse.status}`);
        }
        */

        console.log(`Sizl webhook sent for battery ${batteryId}, phone ${phoneNumber}, order ${orderId}`);
        res.json({ success: true, message: 'Webhook sent to Sizl' });

    } catch (error) {
        console.error('Error sending webhook to Sizl:', error);
        res.status(500).json({ error: 'Failed to send webhook to Sizl' });
    }
});

// Endpoint to receive confirmation from Sizl when user completes registration
app.post('/api/sizl/confirmation', async (req, res) => {
    const { rentId, phoneNumber, batteryId, status, userId } = req.body;

    console.log('Received Sizl confirmation:', { rentId, phoneNumber, batteryId, status, userId });

    if (status === 'completed' || status === 'registered') {
        // Find the corresponding webhook data
        const webhookData = sizlWebhookStorage.get(batteryId);

        if (webhookData && !webhookData.refunded) {
            // Mark as completed and trigger refund process
            webhookData.status = 'completed';
            webhookData.refunded = true;
            webhookData.completedTimestamp = new Date().toISOString();
            webhookData.sizlUserId = userId;

            sizlWebhookStorage.set(batteryId, webhookData);

            // Trigger automatic refund
            try {
                await processAutomaticRefund(batteryId, webhookData);
                console.log(`Automatic refund processed for battery ${batteryId}`);
            } catch (error) {
                console.error(`Failed to process automatic refund for battery ${batteryId}:`, error);
            }
        }
    }

    res.json({ success: true, message: 'Confirmation received' });
});

// Function to process automatic refund
async function processAutomaticRefund(batteryId, webhookData) {
    // TODO: Integrate with your payment system to issue refund
    // This is where you would call your payment processor's refund API

    console.log(`Processing $3.00 refund for:`, {
        batteryId: batteryId,
        phoneNumber: webhookData.phoneNumber,
        orderId: webhookData.orderId,
        rentId: webhookData.orderId
    });

    // Example of what the refund call might look like:
    /*
    const refundResponse = await fetch('https://api.your-payment-processor.com/refunds', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_PAYMENT_API_KEY'
        },
        body: JSON.stringify({
            orderId: webhookData.orderId,
            amount: 3.00,
            reason: 'Sizl app registration completed'
        })
    });

    if (!refundResponse.ok) {
        throw new Error(`Refund failed: ${refundResponse.status}`);
    }
    */

    // You could also send an email notification to the user
    // or update your database with the refund status

    return true;
}

// Admin endpoint to view Sizl webhook status
app.get('/api/admin/sizl-webhooks', (req, res) => {
    const webhooks = Array.from(sizlWebhookStorage.entries()).map(([batteryId, data]) => ({
        batteryId,
        ...data
    }));
    res.json(webhooks);
});

// Station data endpoint
app.get('/api/stations', async (req, res) => {
    const stations = [
        { id: 'DTN00872', name: 'DePaul University LP Student Center' },
        { id: 'DTN00971', name: 'DePaul University Loop Student Center' },
        { id: 'DTN00970', name: 'DePaul University Theater School' },
        { id: 'BJH09881', name: 'DePaul University Coleman Entrepreneurship Center' }
    ];

    const myHeaders = {
        "Authorization": "Basic VmxhZFZhbGNoa292OlZWMTIxMg==",
        "Content-Type": "application/json"
    };

    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        credentials: 'include',
        redirect: 'follow'
    };

    try {
        const stationData = await Promise.all(stations.map(async (station) => {
            try {
                const response = await fetch(`https://developer.chargenow.top/cdb-open-api/v1/rent/cabinet/query?deviceId=${station.id}`, requestOptions);
                if (!response.ok) {
                    console.error(`Failed to fetch data for station ${station.id}: ${response.status}`);
                    return {
                        id: station.id,
                        name: station.name,
                        available: 0,
                        occupied: 0,
                        error: true
                    };
                }

                const data = await response.json();
                console.log(`Station ${station.id} data:`, data);

                // Get available and occupied slots from cabinet data
                let available = 0;
                let occupied = 0;

                if (data.data && data.data.cabinet) {
                    available = data.data.cabinet.emptySlots || 0;
                    occupied = data.data.cabinet.busySlots || 0;
                }

                return {
                    id: station.id,
                    name: station.name,
                    available: available,
                    occupied: occupied,
                    error: false
                };
            } catch (error) {
                console.error(`Error fetching data for station ${station.id}:`, error);
                return {
                    id: station.id,
                    name: station.name,
                    available: 0,
                    occupied: 0,
                    error: true
                };
            }
        }));

        res.json(stationData);
    } catch (error) {
        console.error('Error fetching station data:', error);
        res.status(500).json({ error: 'Failed to fetch station data' });
    }
});

// Excel export endpoint
app.get('/api/admin/export-excel', (req, res) => {
    try {
        // Convert stored data to Excel format
        const excelData = Array.from(phoneNumberStorage.entries()).map(([batteryId, data]) => ({
            'Battery ID': batteryId,
            'Phone Number': data.phoneNumber,
            'Order ID': data.orderId,
            'Real Battery ID': data.realBatteryId,
            'Rental Time': data.timestamp
        }));

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Phone Numbers');

        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=phone_numbers.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Send the Excel file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

// Request logging middleware (development only)
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