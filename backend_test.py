#!/usr/bin/env python3
"""
Backend API Tests for Fixr App - Other Services (Beta) Feature
Tests the general service request functionality where customers can submit 
requests without selecting a specific provider.
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Use the production URL from frontend/.env
BASE_URL = "https://service-finder-233.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class FixrAPITester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.created_request_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
        
    def make_request(self, method, endpoint, headers=None, json_data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=json_data,
                params=params,
                timeout=30
            )
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None
            
    def test_customer_login(self):
        """Test 1: Login as Customer"""
        print("\n=== Test 1: Customer Login ===")
        
        response = self.make_request(
            "POST",
            "/auth/login",
            json_data={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD
            }
        )
        
        if not response:
            self.log_test("Customer Login", False, "Request failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                self.customer_token = data["token"]
                user_info = data.get("user", {})
                self.log_test(
                    "Customer Login", 
                    True, 
                    f"Successfully logged in as {user_info.get('name', 'customer')}",
                    f"User ID: {user_info.get('id')}, Role: {user_info.get('currentRole')}"
                )
                return True
            else:
                self.log_test("Customer Login", False, "No token in response", data)
                return False
        else:
            self.log_test("Customer Login", False, f"HTTP {response.status_code}", response.text)
            return False
            
    def test_create_general_request(self):
        """Test 2: Create General Service Request (Other Services Beta)"""
        print("\n=== Test 2: Create General Service Request ===")
        
        if not self.customer_token:
            self.log_test("Create General Request", False, "No customer token available")
            return False
            
        # Create a general request with provider_id=general
        preferred_datetime = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        response = self.make_request(
            "POST",
            "/service-requests",
            headers={"Authorization": f"Bearer {self.customer_token}"},
            params={"provider_id": "general"},
            json_data={
                "service": "other",
                "description": "I need help assembling furniture for my new apartment",
                "preferredDateTime": preferred_datetime
            }
        )
        
        if not response:
            self.log_test("Create General Request", False, "Request failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.created_request_id = data.get("id")
            
            # Verify the response has expected fields
            expected_fields = ["id", "isGeneralRequest", "providerId", "service", "description"]
            missing_fields = [field for field in expected_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Create General Request", 
                    False, 
                    f"Missing fields in response: {missing_fields}",
                    data
                )
                return False
                
            # Verify it's marked as a general request
            if data.get("isGeneralRequest") != True:
                self.log_test(
                    "Create General Request", 
                    False, 
                    f"isGeneralRequest should be True, got: {data.get('isGeneralRequest')}",
                    data
                )
                return False
                
            # Verify providerId is None
            if data.get("providerId") is not None:
                self.log_test(
                    "Create General Request", 
                    False, 
                    f"providerId should be None for general requests, got: {data.get('providerId')}",
                    data
                )
                return False
                
            self.log_test(
                "Create General Request", 
                True, 
                f"Successfully created general request with ID: {self.created_request_id}",
                f"isGeneralRequest: {data.get('isGeneralRequest')}, providerId: {data.get('providerId')}"
            )
            return True
        else:
            self.log_test("Create General Request", False, f"HTTP {response.status_code}", response.text)
            return False
            
    def test_provider_login(self):
        """Test 3: Login as Provider"""
        print("\n=== Test 3: Provider Login ===")
        
        response = self.make_request(
            "POST",
            "/auth/login",
            json_data={
                "email": PROVIDER_EMAIL,
                "password": PROVIDER_PASSWORD
            }
        )
        
        if not response:
            self.log_test("Provider Login", False, "Request failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                self.provider_token = data["token"]
                user_info = data.get("user", {})
                self.log_test(
                    "Provider Login", 
                    True, 
                    f"Successfully logged in as {user_info.get('name', 'provider')}",
                    f"User ID: {user_info.get('id')}, Role: {user_info.get('currentRole')}, Provider Enabled: {user_info.get('isProviderEnabled')}"
                )
                return True
            else:
                self.log_test("Provider Login", False, "No token in response", data)
                return False
        else:
            self.log_test("Provider Login", False, f"HTTP {response.status_code}", response.text)
            return False
            
    def test_provider_get_requests(self):
        """Test 4: Get Service Requests as Provider (should include general requests)"""
        print("\n=== Test 4: Provider Get Service Requests ===")
        
        if not self.provider_token:
            self.log_test("Provider Get Requests", False, "No provider token available")
            return False
            
        response = self.make_request(
            "GET",
            "/service-requests",
            headers={"Authorization": f"Bearer {self.provider_token}"}
        )
        
        if not response:
            self.log_test("Provider Get Requests", False, "Request failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Provider Get Requests", False, "Response should be a list", data)
                return False
                
            # Look for our created general request
            general_requests = [req for req in data if req.get("isGeneralRequest") == True]
            our_request = None
            
            if self.created_request_id:
                our_request = next((req for req in data if req.get("id") == self.created_request_id), None)
                
            if not general_requests:
                self.log_test(
                    "Provider Get Requests", 
                    False, 
                    "No general requests found in provider's request list",
                    f"Total requests: {len(data)}, General requests: {len(general_requests)}"
                )
                return False
                
            if self.created_request_id and not our_request:
                self.log_test(
                    "Provider Get Requests", 
                    False, 
                    f"Our created request (ID: {self.created_request_id}) not found in provider's list",
                    f"Found {len(data)} requests, {len(general_requests)} general requests"
                )
                return False
                
            self.log_test(
                "Provider Get Requests", 
                True, 
                f"Provider can see general requests",
                f"Total requests: {len(data)}, General requests: {len(general_requests)}, Our request found: {our_request is not None}"
            )
            return True
        else:
            self.log_test("Provider Get Requests", False, f"HTTP {response.status_code}", response.text)
            return False
            
    def test_provider_accept_request(self):
        """Test 5: Provider Accepts the General Request"""
        print("\n=== Test 5: Provider Accept General Request ===")
        
        if not self.provider_token:
            self.log_test("Provider Accept Request", False, "No provider token available")
            return False
            
        if not self.created_request_id:
            self.log_test("Provider Accept Request", False, "No request ID to accept")
            return False
            
        response = self.make_request(
            "PATCH",
            f"/service-requests/{self.created_request_id}/accept",
            headers={"Authorization": f"Bearer {self.provider_token}"}
        )
        
        if not response:
            self.log_test("Provider Accept Request", False, "Request failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") != "accepted":
                self.log_test(
                    "Provider Accept Request", 
                    False, 
                    f"Status should be 'accepted', got: {data.get('status')}",
                    data
                )
                return False
                
            self.log_test(
                "Provider Accept Request", 
                True, 
                f"Successfully accepted request {self.created_request_id}",
                f"Status: {data.get('status')}, Request ID: {data.get('id')}"
            )
            return True
        else:
            self.log_test("Provider Accept Request", False, f"HTTP {response.status_code}", response.text)
            return False
            
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Fixr API Tests - Other Services (Beta) Feature")
        print(f"Testing against: {BASE_URL}")
        
        tests = [
            self.test_customer_login,
            self.test_create_general_request,
            self.test_provider_login,
            self.test_provider_get_requests,
            self.test_provider_accept_request
        ]
        
        for test in tests:
            success = test()
            if not success:
                print(f"\n⚠️  Test failed, continuing with remaining tests...")
                
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
            
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Other Services (Beta) feature is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Please check the issues above.")
            return False

if __name__ == "__main__":
    tester = FixrAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)