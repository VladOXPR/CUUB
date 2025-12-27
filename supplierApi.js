/**
 * Supplier API Service
 * 
 * This module handles all interactions with supplier APIs including:
 * - ChargeNow API (Base URL: https://developer.chargenow.top/cdb-open-api/v1)
 * - Energo API (Base URL: https://backend.energo.vip/api)
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ChargeNow API Configuration
const CHARGENOW_API_BASE = 'https://developer.chargenow.top/cdb-open-api/v1';
const CHARGENOW_AUTH = 'Basic VmxhZFZhbGNoa292OlZWMTIxMg=='; // Base64 encoded credentials
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Energo API Configuration
const ENERGO_API_BASE = 'https://backend.energo.vip/api';
const ENERGO_TOKEN_FILE = path.join(__dirname, 'energoToken.json');

/**
 * Get Energo auth token from config file
 * @returns {string} The auth token
 */
function getEnergoToken() {
    try {
        if (fs.existsSync(ENERGO_TOKEN_FILE)) {
            const data = JSON.parse(fs.readFileSync(ENERGO_TOKEN_FILE, 'utf8'));
            return data.token || '';
        }
    } catch (error) {
        console.error('Error reading Energo token:', error);
    }
    return '';
}

/**
 * Update Energo auth token in config file
 * @param {string} token - The new auth token
 * @returns {Promise<boolean>} True if successful
 */
function updateEnergoToken(token) {
    try {
        const data = { token: token.trim() };
        fs.writeFileSync(ENERGO_TOKEN_FILE, JSON.stringify(data, null, 2));
        console.log('Energo token updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating Energo token:', error);
        return false;
    }
}

const ENERGO_OID = '3526';

/**
 * Common headers for all ChargeNow API requests
 */
const getHeaders = () => ({
    "Authorization": CHARGENOW_AUTH,
    "Content-Type": "application/json"
});

/**
 * Fetch station/cabinet information by device ID
 * 
 * @param {string} deviceId - The station device ID (e.g., 'DTN00872')
 * @returns {Promise<Object>} Station data including available and occupied slots
 */
async function fetchStationData(deviceId) {
    try {
        const url = `${CHARGENOW_API_BASE}/rent/cabinet/query?deviceId=${deviceId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            timeout: DEFAULT_TIMEOUT,
            redirect: 'follow'
        });

        if (!response.ok) {
            console.error(`Failed to fetch station ${deviceId}: ${response.status}`);
            return { 
                id: deviceId, 
                error: true,
                status: response.status 
            };
        }

        const data = await response.json();
        
        return {
            id: deviceId,
            available: data.data?.cabinet?.emptySlots || 0,
            occupied: data.data?.cabinet?.busySlots || 0,
            rawData: data.data,
            error: false
        };

    } catch (error) {
        console.error(`Error fetching station ${deviceId}:`, error.message);
        return { 
            id: deviceId, 
            error: true,
            message: error.message 
        };
    }
}

/**
 * Fetch all battery orders/rental data
 * 
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Results per page (default: 100)
 * @returns {Promise<Object>} Order list with pagination info
 */
async function fetchBatteryOrders(page = 1, limit = 100) {
    try {
        const url = `${CHARGENOW_API_BASE}/order/list?page=${page}&limit=${limit}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            timeout: DEFAULT_TIMEOUT,
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.page || !result.page.records) {
            throw new Error("Invalid API response structure");
        }

        return {
            success: true,
            data: result.page.records,
            pagination: {
                current: result.page.current,
                size: result.page.size,
                total: result.page.total,
                pages: result.page.pages
            }
        };

    } catch (error) {
        console.error("Error fetching battery orders:", error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Find a specific battery by its ID using the Energo API
 * 
 * @param {string} batteryId - The battery ID to search for (e.g., 'RL3D52000012')
 * @returns {Promise<Object>} Battery data with pBorrowtime and pGhtime fields
 */
async function findBatteryById(batteryId) {
    try {
        // Build the Energo API URL
        const url = `${ENERGO_API_BASE}/order?size=0&sort=id%2Cdesc&deviceid=${encodeURIComponent(batteryId)}`;
        
        console.log(`Calling Energo API for battery: ${batteryId}`);
        console.log(`URL: ${url}`);
        
        // Make the API request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getEnergoToken()}`,
                'Referer': 'https://backend.energo.vip/order/lease-order',
                'oid': ENERGO_OID,
                'Content-Type': 'application/json'
            },
            timeout: DEFAULT_TIMEOUT,
            redirect: 'follow'
        });

        console.log(`Energo API response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Energo API error response: ${errorText}`);
            throw new Error(`Energo API request failed with status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`Energo API response:`, JSON.stringify(result, null, 2));

        // Check if we have any orders
        if (!result.content || result.content.length === 0) {
            console.log(`No orders found for battery ${batteryId}`);
            return {
                success: false,
                error: "Battery not found in API data"
            };
        }

        // Get the most recent order (first in the sorted list)
        const order = result.content[0];
        
        // Extract starttime and returnTime
        const starttime = order.starttime; // Epoch timestamp in milliseconds
        const returnTime = order.returnTime; // Epoch timestamp in milliseconds, 0 if not returned

        console.log(`Battery ${batteryId} - starttime: ${starttime}, returnTime: ${returnTime}`);

        // Convert epoch timestamps to ISO format strings
        // The frontend expects ISO strings that it will interpret as China timezone
        // Epoch timestamps are timezone-agnostic, so we convert to ISO and let frontend handle timezone
        const pBorrowtime = starttime ? new Date(starttime).toISOString() : null;
        
        // Check if battery is returned: returnTime must exist AND not be 0
        // If returnTime is 0, battery hasn't been returned yet (still rented)
        const isReturned = returnTime !== undefined && returnTime !== null && returnTime !== 0;
        const pGhtime = isReturned ? new Date(returnTime).toISOString() : null;
        
        console.log(`Battery ${batteryId} - isReturned: ${isReturned}, pGhtime: ${pGhtime}`);

        // Return data in the format expected by the frontend
        return {
            success: true,
            data: {
                pBatteryid: batteryId,
                pBorrowtime: pBorrowtime,
                pGhtime: pGhtime,
                // Include additional order data for reference
                orderNo: order.orderNo,
                status: order.status,
                deviceid: order.deviceid
            }
        };

    } catch (error) {
        console.error(`Error finding battery ${batteryId}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Fetch station/cabinet information by cabinet ID using the Energo API
 * 
 * @param {string} cabinetId - The cabinet ID (e.g., 'RL3T062411030004')
 * @returns {Promise<Object>} Station data including available and occupied slots
 */
async function fetchEnergoStationData(cabinetId) {
    try {
        const url = `${ENERGO_API_BASE}/cabinet?cabinetId=${encodeURIComponent(cabinetId)}`;
        
        console.log(`Calling Energo API for station: ${cabinetId}`);
        console.log(`URL: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getEnergoToken()}`,
                'Referer': 'https://backend.energo.vip/device/list',
                'oid': ENERGO_OID,
                'Content-Type': 'application/json'
            },
            timeout: DEFAULT_TIMEOUT,
            redirect: 'follow'
        });

        console.log(`Energo API response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Energo API error response: ${errorText}`);
            return {
                id: cabinetId,
                error: true,
                status: response.status,
                message: `API request failed with status: ${response.status}`
            };
        }

        const result = await response.json();
        console.log(`Energo API response:`, JSON.stringify(result, null, 2));

        // Check if we have any cabinet data
        if (!result.content || result.content.length === 0) {
            console.log(`No cabinet data found for ${cabinetId}`);
            return {
                id: cabinetId,
                error: true,
                message: "Cabinet not found in API data"
            };
        }

        // Get the first cabinet (should only be one)
        const cabinet = result.content[0];
        const positionInfo = cabinet.positionInfo || {};
        
        // Extract returnNum (empty slots) and borrowNum (occupied slots)
        const available = positionInfo.returnNum || 0; // Empty slots - available to return
        const occupied = positionInfo.borrowNum || 0;  // Occupied slots - batteries available to take

        return {
            id: cabinetId,
            available: available,
            occupied: occupied,
            rawData: cabinet,
            error: false
        };

    } catch (error) {
        console.error(`Error fetching Energo station ${cabinetId}:`, error.message);
        return {
            id: cabinetId,
            error: true,
            message: error.message
        };
    }
}

/**
 * Fetch multiple stations data in parallel
 * Detects Energo stations (IDs starting with "CUBT") and uses appropriate API
 * 
 * @param {string[]} stationIds - Array of station device IDs
 * @returns {Promise<Object[]>} Array of station data objects
 */
async function fetchMultipleStations(stationIds) {
    try {
        const stationPromises = stationIds.map(id => {
            // Energo stations have IDs starting with "CUBT"
            if (id.startsWith('CUBT')) {
                return fetchEnergoStationData(id);
            } else {
                // ChargeNow stations (DTN, BJH, etc.)
                return fetchStationData(id);
            }
        });
        const results = await Promise.all(stationPromises);
        return results;
    } catch (error) {
        console.error('Error fetching multiple stations:', error.message);
        throw error;
    }
}

/**
 * Background polling function for station data
 * Continuously fetches station data at specified intervals
 * 
 * @param {string[]} stationIds - Array of station IDs to poll
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {Function} callback - Callback function to receive data updates
 * @returns {Function} Stop function to halt polling
 */
function pollStationData(stationIds, intervalMs, callback) {
    console.log(`Starting station polling every ${intervalMs}ms for ${stationIds.length} stations`);
    
    // Initial fetch
    fetchMultipleStations(stationIds)
        .then(data => callback(null, data))
        .catch(err => callback(err, null));
    
    // Set up interval
    const intervalId = setInterval(async () => {
        try {
            const data = await fetchMultipleStations(stationIds);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    }, intervalMs);
    
    // Return function to stop polling
    return () => {
        console.log('Stopping station polling');
        clearInterval(intervalId);
    };
}

/**
 * Background polling function for battery orders
 * Continuously fetches battery order data at specified intervals
 * 
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {Function} callback - Callback function to receive data updates
 * @returns {Function} Stop function to halt polling
 */
function pollBatteryOrders(intervalMs, callback) {
    console.log(`Starting battery orders polling every ${intervalMs}ms`);
    
    // Initial fetch
    fetchBatteryOrders()
        .then(data => callback(null, data))
        .catch(err => callback(err, null));
    
    // Set up interval
    const intervalId = setInterval(async () => {
        try {
            const data = await fetchBatteryOrders();
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    }, intervalMs);
    
    // Return function to stop polling
    return () => {
        console.log('Stopping battery orders polling');
        clearInterval(intervalId);
    };
}

/**
 * Health check for ChargeNow API
 * 
 * @returns {Promise<boolean>} True if API is accessible
 */
async function checkApiHealth() {
    try {
        // Try fetching a simple endpoint with a short timeout
        const response = await fetch(`${CHARGENOW_API_BASE}/order/list?page=1&limit=1`, {
            method: 'GET',
            headers: getHeaders(),
            timeout: 5000
        });
        
        return response.ok;
    } catch (error) {
        console.error('ChargeNow API health check failed:', error.message);
        return false;
    }
}

/**
 * Start background polling to keep Energo API token alive
 * Sends a request every minute to prevent token expiration
 * 
 * @param {string} batteryId - The battery ID to use for keep-alive requests (default: 'RL3D52000012')
 * @param {number} intervalMs - Polling interval in milliseconds (default: 60000 = 1 minute)
 * @returns {Function} Stop function to halt polling
 */
function startEnergoTokenKeepAlive(batteryId = 'RL3D52000012', intervalMs = 60000) {
    console.log(`[Token Keep-Alive] Starting Energo API token keep-alive for battery ${batteryId} (interval: ${intervalMs}ms)`);
    
    // Function to send keep-alive request
    const sendKeepAliveRequest = async () => {
        try {
            const url = `${ENERGO_API_BASE}/order?size=0&sort=id%2Cdesc&deviceid=${encodeURIComponent(batteryId)}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getEnergoToken()}`,
                    'Referer': 'https://backend.energo.vip/order/lease-order',
                    'oid': ENERGO_OID,
                    'Content-Type': 'application/json'
                },
                timeout: DEFAULT_TIMEOUT,
                redirect: 'follow'
            });

            if (response.ok) {
                console.log(`[Token Keep-Alive] Energo API token is active (status: ${response.status})`);
            } else {
                console.warn(`[Token Keep-Alive] Energo API request returned status: ${response.status}`);
            }
        } catch (error) {
            console.error(`[Token Keep-Alive] Error keeping Energo token alive:`, error.message);
        }
    };
    
    // Initial request
    sendKeepAliveRequest();
    
    // Set up interval
    const intervalId = setInterval(sendKeepAliveRequest, intervalMs);
    
    // Return function to stop polling
    return () => {
        console.log('[Token Keep-Alive] Stopping Energo API token keep-alive');
        clearInterval(intervalId);
    };
}

// Export all functions
module.exports = {
    // Single operations
    fetchStationData,
    fetchEnergoStationData,
    fetchBatteryOrders,
    findBatteryById,
    
    // Batch operations
    fetchMultipleStations,
    
    // Background polling
    pollStationData,
    pollBatteryOrders,
    
    // Utilities
    checkApiHealth,
    startEnergoTokenKeepAlive,
    getEnergoToken,
    updateEnergoToken,
    
    // Constants (if needed externally)
    CHARGENOW_API_BASE
};

