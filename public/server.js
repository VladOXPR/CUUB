const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const batteryIdMap = require('./batteryIdMap');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage for phone numbers (you may want to use a database in production)
const phoneNumberStorage = new Map();

app.get('/map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'map.html'));
});

app.get('/:batteryId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to submit phone number
app.post('/api/phone/:batteryId', async (req, res) => {
    const customBatteryId = req.params.batteryId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    // Translate custom ID to real ID
    const realBatteryId = batteryIdMap[customBatteryId];
    if (!realBatteryId) {
        return res.status(404).json({ error: "Battery ID not found" });
    }

    try {
        // Get the order details from the API first
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
        
        // Store phone number regardless of whether battery is found in API
        const phoneData = {
            phoneNumber: phoneNumber,
            orderId: matchingRecord ? (matchingRecord.id || matchingRecord.pOrderid) : 'Not Found',
            batteryId: customBatteryId,
            realBatteryId: realBatteryId,
            timestamp: new Date().toISOString(),
            batteryFoundInAPI: !!matchingRecord
        };

        phoneNumberStorage.set(customBatteryId, phoneData);
        
        console.log(`Phone number collected: ${phoneNumber} for battery ${customBatteryId}, order ${phoneData.orderId}, found in API: ${!!matchingRecord}`);
        
        res.json({ 
            success: true, 
            message: "Phone number stored successfully",
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

app.get('/api/battery/:batteryId', async (req, res) => {
    const customBatteryId = req.params.batteryId;

    // Translate custom ID to real ID
    const realBatteryId = batteryIdMap[customBatteryId];
    if (!realBatteryId) {
        return res.status(404).json({ error: "Battery ID not found" });
    }

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
        if (matchingRecord) {
            res.json(matchingRecord);
        } else {
            res.status(404).json({ error: "Battery not found in API data" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
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

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

