// Test API file for CUUB Location Management
// Run with: node api.js

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' ? 'https://battery.cuub.tech' : 'http://localhost:3000';
const API_KEY = 'cuubisgoated123';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            }
        };

        const req = client.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        data: parsedData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test functions
async function testGetAllLocations() {
    console.log('\n🔍 Testing GET /api/locations (Get all locations)');
    console.log('=' .repeat(50));
    
    try {
        const response = await makeRequest('GET', '/api/locations');
        console.log(`Status: ${response.status}`);
        console.log(`Found ${response.data.length} locations:`);
        
        response.data.forEach(location => {
            console.log(`  - ${location.id}: ${location.name} (${location.address})`);
        });
        
        return response.data;
    } catch (error) {
        console.error('Error:', error.message);
        return [];
    }
}

async function testAddLocation(locationData) {
    console.log('\n➕ Testing POST /api/locations (Add new location)');
    console.log('=' .repeat(50));
    
    try {
        const response = await makeRequest('POST', '/api/locations', locationData);
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 201) {
            console.log('✅ Location added successfully!');
        } else {
            console.log('❌ Failed to add location');
        }
        
        return response;
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

async function testDeleteLocation(locationId) {
    console.log('\n🗑️  Testing DELETE /api/locations/:id (Delete location)');
    console.log('=' .repeat(50));
    
    try {
        const response = await makeRequest('DELETE', `/api/locations/${locationId}`);
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
            console.log('✅ Location deleted successfully!');
        } else {
            console.log('❌ Failed to delete location');
        }
        
        return response;
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

async function testInvalidApiKey() {
    console.log('\n🔒 Testing with invalid API key');
    console.log('=' .repeat(50));
    
    try {
        // Make request with invalid API key
        const url = new URL(BASE_URL + '/api/locations');
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'wrongkey123'  // Invalid API key
            }
        };

        const response = await new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        resolve({
                            status: res.statusCode,
                            data: parsedData
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            data: responseData
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(JSON.stringify({
                id: 'TEST_INVALID',
                name: 'Test Station',
                address: 'Test Address',
                coordinates: [-87.6, 41.9]
            }));
            
            req.end();
        });
        
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 403) {
            console.log('✅ API key validation working correctly!');
        } else {
            console.log('❌ API key validation not working');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testMissingFields() {
    console.log('\n📝 Testing with missing required fields');
    console.log('=' .repeat(50));
    
    try {
        const response = await makeRequest('POST', '/api/locations', {
            id: 'TEST_MISSING',
            name: 'Test Station'
            // Missing address and coordinates
        });
        
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 400) {
            console.log('✅ Field validation working correctly!');
        } else {
            console.log('❌ Field validation not working');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting CUUB Location API Tests');
    console.log('=' .repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`API Key: ${API_KEY}`);
    
    try {
        // Test 1: Get all locations
        const locations = await testGetAllLocations();
        
        // Test 2: Add a new test location
        const testLocation = {
            id: 'TEST_' + Date.now(),
            name: 'Test Battery Station',
            address: '123 Test Street, Chicago, IL',
            coordinates: [-87.6, 41.9]
        };
        
        const addResult = await testAddLocation(testLocation);
        
        // Test 3: Delete the test location (only if it was added successfully)
        if (addResult && addResult.status === 201) {
            await testDeleteLocation(testLocation.id);
        }
        
        // Test 4: Test invalid API key
        await testInvalidApiKey();
        
        // Test 5: Test missing fields
        await testMissingFields();
        
        // Test 6: Final check - get all locations again
        console.log('\n📊 Final location count:');
        await testGetAllLocations();
        
        console.log('\n🎉 All tests completed!');
        
    } catch (error) {
        console.error('Test suite failed:', error.message);
    }
}

// Interactive test functions
async function interactiveAddLocation() {
    console.log('\n➕ Interactive: Add a new location');
    console.log('=' .repeat(40));
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    
    try {
        const id = await question('Enter station ID: ');
        const name = await question('Enter station name: ');
        const address = await question('Enter station address: ');
        const longitude = await question('Enter longitude: ');
        const latitude = await question('Enter latitude: ');
        
        const locationData = {
            id: id.trim(),
            name: name.trim(),
            address: address.trim(),
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
        
        await testAddLocation(locationData);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'test':
        runAllTests();
        break;
    case 'add':
        interactiveAddLocation();
        break;
    case 'list':
        testGetAllLocations();
        break;
    case 'delete':
        if (args[1]) {
            testDeleteLocation(args[1]);
        } else {
            console.log('Usage: node api.js delete <location_id>');
        }
        break;
    default:
        console.log(`
CUUB Location API Tester

Usage:
  node api.js test          - Run all tests
  node api.js add           - Interactive add location
  node api.js list          - List all locations
  node api.js delete <id>   - Delete a location

Examples:
  node api.js test
  node api.js add
  node api.js list
  node api.js delete TEST123
        `);
}
