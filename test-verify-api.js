const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000'; // Change this to your server URL
const API_ENDPOINT = `${BASE_URL}/api/tickets/verify`;

// Test cases
const testCases = [
  {
    name: 'Health Check',
    url: `${BASE_URL}/api/health`,
    method: 'GET',
    data: null,
    expectedStatus: 200
  },
  {
    name: 'Valid Ticket Verification',
    url: API_ENDPOINT,
    method: 'POST',
    data: { ticketId: 'MJX-123456' }, // Replace with a real ticket ID
    expectedStatus: 200
  },
  {
    name: 'Missing ticketId',
    url: API_ENDPOINT,
    method: 'POST',
    data: {},
    expectedStatus: 400
  },
  {
    name: 'Empty ticketId',
    url: API_ENDPOINT,
    method: 'POST',
    data: { ticketId: '' },
    expectedStatus: 400
  },
  {
    name: 'Invalid ticketId format',
    url: API_ENDPOINT,
    method: 'POST',
    data: { ticketId: 123 },
    expectedStatus: 400
  },
  {
    name: 'Non-existent ticket',
    url: API_ENDPOINT,
    method: 'POST',
    data: { ticketId: 'MJX-NONEXISTENT' },
    expectedStatus: 404
  }
];

async function runTests() {
  console.log('🧪 Testing Verify Ticket API...\n');
  
  for (const testCase of testCases) {
    try {
      console.log(`📋 Test: ${testCase.name}`);
      console.log(`🔗 URL: ${testCase.url}`);
      console.log(`📤 Data: ${JSON.stringify(testCase.data)}`);
      
      const startTime = Date.now();
      
      let response;
      if (testCase.method === 'GET') {
        response = await axios.get(testCase.url);
      } else {
        response = await axios.post(testCase.url, testCase.data);
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`⏱️  Response Time: ${responseTime}ms`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
      
      if (response.status === testCase.expectedStatus) {
        console.log(`✅ PASS - Expected ${testCase.expectedStatus}, got ${response.status}\n`);
      } else {
        console.log(`❌ FAIL - Expected ${testCase.expectedStatus}, got ${response.status}\n`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR in ${testCase.name}:`);
      
      if (error.response) {
        // Server responded with error status
        console.log(`📊 Status: ${error.response.status} ${error.response.statusText}`);
        console.log(`📄 Response:`, JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === testCase.expectedStatus) {
          console.log(`✅ PASS - Expected ${testCase.expectedStatus}, got ${error.response.status}\n`);
        } else {
          console.log(`❌ FAIL - Expected ${testCase.expectedStatus}, got ${error.response.status}\n`);
        }
      } else if (error.request) {
        // Network error
        console.log(`🌐 Network Error: ${error.message}`);
        console.log(`❌ FAIL - Network error occurred\n`);
      } else {
        // Other error
        console.log(`💥 Error: ${error.message}`);
        console.log(`❌ FAIL - Unexpected error occurred\n`);
      }
    }
  }
  
  console.log('🏁 Test suite completed!');
}

// Run tests
runTests().catch(console.error); 