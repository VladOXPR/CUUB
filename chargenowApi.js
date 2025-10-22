/**
 * ChargeNow API Service
 * 
 * This module handles all interactions with the ChargeNow API
 * Base URL: https://developer.chargenow.top/cdb-open-api/v1
 */

const fetch = require('node-fetch');

// ChargeNow API Configuration
const CHARGENOW_API_BASE = 'https://developer.chargenow.top/cdb-open-api/v1';
const CHARGENOW_AUTH = 'Basic VmxhZFZhbGNoa292OlZWMTIxMg=='; // Base64 encoded credentials
const DEFAULT_TIMEOUT = 10000; // 10 seconds

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
 * Find a specific battery by its ID in the order list
 * 
 * @param {string} batteryId - The battery ID to search for
 * @returns {Promise<Object|null>} Battery data or null if not found
 */
async function findBatteryById(batteryId) {
    try {
        const ordersResult = await fetchBatteryOrders(1, 100);
        
        if (!ordersResult.success) {
            throw new Error(ordersResult.error);
        }

        const matchingRecord = ordersResult.data.find(
            record => record.pBatteryid === batteryId
        );

        if (matchingRecord) {
            return {
                success: true,
                data: matchingRecord
            };
        } else {
            return {
                success: false,
                error: "Battery not found in API data"
            };
        }

    } catch (error) {
        console.error(`Error finding battery ${batteryId}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Fetch multiple stations data in parallel
 * 
 * @param {string[]} stationIds - Array of station device IDs
 * @returns {Promise<Object[]>} Array of station data objects
 */
async function fetchMultipleStations(stationIds) {
    try {
        const stationPromises = stationIds.map(id => fetchStationData(id));
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

// Export all functions
module.exports = {
    // Single operations
    fetchStationData,
    fetchBatteryOrders,
    findBatteryById,
    
    // Batch operations
    fetchMultipleStations,
    
    // Background polling
    pollStationData,
    pollBatteryOrders,
    
    // Utilities
    checkApiHealth,
    
    // Constants (if needed externally)
    CHARGENOW_API_BASE
};
