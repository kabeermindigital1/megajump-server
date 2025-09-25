/**
 * Test file for the new date range ticket filtering API
 * This demonstrates how to use the new endpoint from your frontend
 */

const axios = require('axios');

// Base URL for your API (adjust as needed)
const BASE_URL = `${process.env.BASE_URL}/api/tickets`;

// Test function to demonstrate the new API
async function testDateRangeAPI() {
  console.log('🧪 Testing Date Range Ticket API...\n');

  try {
    // Test 1: Get tickets for a specific date range
    console.log('📅 Test 1: Get tickets for date range (2024-01-01 to 2024-12-31)');
    const response1 = await axios.get(`${BASE_URL}/by-date-range`, {
      params: {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        sortBy: 'date',
        sortOrder: 'desc'
      }
    });
    
    console.log('✅ Response:', {
      success: response1.data.success,
      totalCount: response1.data.data.totalCount,
      stats: response1.data.data.stats
    });
    console.log('📊 Sample tickets by date:', response1.data.data.ticketsByDate.slice(0, 3));
    console.log('');

    // Test 2: Get tickets from a specific date onwards
    console.log('📅 Test 2: Get tickets from 2024-06-01 onwards');
    const response2 = await axios.get(`${BASE_URL}/by-date-range`, {
      params: {
        startDate: '2024-06-01',
        sortBy: 'startTime',
        sortOrder: 'asc'
      }
    });
    
    console.log('✅ Response:', {
      success: response2.data.success,
      totalCount: response2.data.data.totalCount,
      filters: response2.data.data.filters
    });
    console.log('');

    // Test 3: Get tickets up to a specific date
    console.log('📅 Test 3: Get tickets up to 2024-03-31');
    const response3 = await axios.get(`${BASE_URL}/by-date-range`, {
      params: {
        endDate: '2024-03-31',
        sortBy: 'subtotal',
        sortOrder: 'desc'
      }
    });
    
    console.log('✅ Response:', {
      success: response3.data.success,
      totalCount: response3.data.data.totalCount,
      totalRevenue: response3.data.data.stats.totalRevenue
    });
    console.log('');

    // Test 4: Get all tickets with custom sorting
    console.log('📅 Test 4: Get all tickets sorted by name');
    const response4 = await axios.get(`${BASE_URL}/by-date-range`, {
      params: {
        sortBy: 'name',
        sortOrder: 'asc'
      }
    });
    
    console.log('✅ Response:', {
      success: response4.data.success,
      totalCount: response4.data.data.totalCount,
      filters: response4.data.data.filters
    });
    console.log('');

    // Test 5: Error handling - invalid date format
    console.log('❌ Test 5: Error handling - invalid date format');
    try {
      await axios.get(`${BASE_URL}/by-date-range`, {
        params: {
          startDate: 'invalid-date',
          endDate: '2024-12-31'
        }
      });
    } catch (error) {
      console.log('✅ Expected error caught:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Frontend usage examples
console.log(`
🚀 Frontend Usage Examples:

1. Get tickets for a specific date range:
   GET /api/tickets/by-date-range?startDate=2024-01-01&endDate=2024-12-31&sortBy=date&sortOrder=desc

2. Get tickets from a specific date onwards:
   GET /api/tickets/by-date-range?startDate=2024-06-01&sortBy=startTime&sortOrder=asc

3. Get tickets up to a specific date:
   GET /api/tickets/by-date-range?endDate=2024-03-31&sortBy=subtotal&sortOrder=desc

4. Get all tickets with custom sorting:
   GET /api/tickets/by-date-range?sortBy=name&sortOrder=asc

📋 Available sortBy options:
- date, startTime, endTime, createdAt, ticketId, name, subtotal

📋 Available sortOrder options:
- asc (ascending), desc (descending)

📊 Response includes:
- tickets: Array of all matching tickets
- ticketsByDate: Tickets grouped by date with statistics
- stats: Summary statistics (total tickets, revenue, etc.)
- filters: Applied filters for reference
- totalCount: Total number of tickets returned

`);

// Run the test if this file is executed directly
if (require.main === module) {
  testDateRangeAPI();
}

module.exports = { testDateRangeAPI };


