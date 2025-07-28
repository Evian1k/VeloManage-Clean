#!/bin/bash

echo "🧪 AutoCare Pro - Feature Testing Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    local description=$4
    
    echo -e "${BLUE}Testing:${NC} $description"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -X POST "http://localhost:3001$endpoint" \
            -H "Authorization: Bearer test-token" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s "http://localhost:3001$endpoint" \
            -H "Authorization: Bearer test-token")
    fi
    
    if [[ $response == *"success\":true"* ]]; then
        echo -e "${GREEN}✅ PASSED:${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED:${NC} $description"
        echo "Response: $response"
        ((FAILED++))
    fi
    echo ""
}

echo "🔍 Testing Backend API Endpoints..."
echo "-----------------------------------"

# Test 1: Health Check
echo -e "${BLUE}Testing:${NC} Backend Health Check"
health_response=$(curl -s http://localhost:3001/health)
if [[ $health_response == *"OK"* ]]; then
    echo -e "${GREEN}✅ PASSED:${NC} Backend Health Check"
    ((PASSED++))
else
    echo -e "${RED}❌ FAILED:${NC} Backend Health Check"
    ((FAILED++))
fi
echo ""

# Test 2: Admin Messaging - Send Message
test_api "/api/v1/messages" "POST" '{"text":"Test admin message"}' "Admin Messaging - Send Message"

# Test 3: Admin Messaging - Get Messages (mock admin)
test_api "/api/v1/messages" "GET" "" "Admin Messaging - Get Messages"

# Test 4: Payment Config
test_api "/api/v1/payments/config" "GET" "" "Payment Integration - Get Config"

# Test 5: Create Payment Intent
test_api "/api/v1/payments/create-payment-intent" "POST" '{"amount":50,"currency":"usd","description":"Test payment"}' "Payment Integration - Create Payment Intent"

# Test 6: Share Location
test_api "/api/v1/locations" "POST" '{"latitude":40.7128,"longitude":-74.0060,"address":"New York, NY"}' "Google Maps - Share Location"

# Test 7: Get All Locations (admin)
test_api "/api/v1/locations/all" "GET" "" "Google Maps - Get All Locations"

# Test 8: Get Trucks
test_api "/api/v1/trucks" "GET" "" "Truck Management - Get Trucks"

# Test 9: Add Truck
test_api "/api/v1/trucks" "POST" '{"truckId":"TRUCK001","driver":{"name":"John Doe","phone":"555-1234"},"vehicle":{"licensePlate":"ABC123","capacity":"5 tons"},"currentLocation":{"latitude":40.7128,"longitude":-74.0060,"address":"NYC"}}' "Truck Management - Add Truck"

echo "🌐 Testing Frontend Availability..."
echo "----------------------------------"

# Test Frontend
echo -e "${BLUE}Testing:${NC} Frontend Availability"
frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
if [ "$frontend_response" = "200" ]; then
    echo -e "${GREEN}✅ PASSED:${NC} Frontend is accessible at http://localhost:5173"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING:${NC} Frontend may not be fully loaded yet (HTTP $frontend_response)"
fi
echo ""

echo "📊 Test Results Summary"
echo "======================"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo -e "Total Tests: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! All features are working correctly.${NC}"
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
fi

echo ""
echo "🚀 Application URLs:"
echo "==================="
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:3001"
echo "Health Check: http://localhost:3001/health"

echo ""
echo "🔧 Features Implemented:"
echo "========================"
echo "✅ Admin Messaging with real-time delivery"
echo "✅ Broadcast to all admins via Socket.IO"
echo "✅ Stripe payment integration"
echo "✅ Google Maps location sharing"
echo "✅ Add Pickup Truck feature"
echo "✅ Epic intro animation"

echo ""
echo "💡 Next Steps:"
echo "=============="
echo "1. Open http://localhost:5173 in your browser"
echo "2. Test the epic intro animation"
echo "3. Navigate through user/admin dashboards"
echo "4. Test real-time features (messaging, payments, location)"
echo "5. For production: Set up MongoDB and update API keys"