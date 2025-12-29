#!/usr/bin/env python3
"""
Backend API Testing for Phase 3A: Provider Availability + Workload Control
Tests the provider availability features including:
- Provider profile retrieval
- Availability updates
- Provider discovery filtering
- Service request validation for unavailable providers
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://connect-fixr.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class FixrAPITester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.provider_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test result"""
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
    
    def make_request(self, method: str, endpoint: str, token: str = None, data: Dict = None, params: Dict = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{BACKEND_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def login_user(self, email: str, password: str) -> Optional[str]:
        """Login user and return token"""
        try:
            response = self.make_request("POST", "/auth/login", data={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                return data.get("token")
            else:
                print(f"Login failed for {email}: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Login error for {email}: {e}")
            return None
    
    def setup_authentication(self):
        """Setup authentication for both customer and provider"""
        print("🔐 Setting up authentication...")
        
        # Login customer
        self.customer_token = self.login_user(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
        if self.customer_token:
            self.log_test("Customer Login", True, f"Successfully logged in {CUSTOMER_EMAIL}")
        else:
            self.log_test("Customer Login", False, f"Failed to login {CUSTOMER_EMAIL}")
            return False
        
        # Login provider
        self.provider_token = self.login_user(PROVIDER_EMAIL, PROVIDER_PASSWORD)
        if self.provider_token:
            self.log_test("Provider Login", True, f"Successfully logged in {PROVIDER_EMAIL}")
        else:
            self.log_test("Provider Login", False, f"Failed to login {PROVIDER_EMAIL}")
            return False
        
        return True
    
    def test_get_provider_profile(self):
        """Test GET /api/providers/me/profile"""
        print("\n📋 Testing Provider Profile Retrieval...")
        
        try:
            response = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
            
            if response.status_code == 200:
                profile = response.json()
                
                # Check required fields
                required_fields = ["isAcceptingJobs", "availabilityNote"]
                missing_fields = [field for field in required_fields if field not in profile]
                
                if missing_fields:
                    self.log_test("Provider Profile Fields", False, 
                                f"Missing required fields: {missing_fields}", profile)
                else:
                    self.log_test("Provider Profile Fields", True, 
                                "All required availability fields present", 
                                {k: profile.get(k) for k in required_fields})
                
                # Store provider ID for later tests (check both possible field names)
                self.provider_id = profile.get("id") or profile.get("_id")
                print(f"DEBUG: Provider ID captured: {self.provider_id}")
                print(f"DEBUG: Profile keys: {list(profile.keys())}")
                
                self.log_test("Get Provider Profile", True, "Successfully retrieved provider profile")
                return profile
            else:
                self.log_test("Get Provider Profile", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Get Provider Profile", False, f"Exception: {str(e)}")
            return None
    
    def test_update_provider_availability(self):
        """Test PATCH /api/providers/me/availability"""
        print("\n🔄 Testing Provider Availability Updates...")
        
        # Test 1: Set unavailable with note
        try:
            update_data = {
                "isAcceptingJobs": False,
                "availabilityNote": "Weekends only"
            }
            
            response = self.make_request("PATCH", "/providers/me/availability", 
                                       token=self.provider_token, data=update_data)
            
            if response.status_code == 200:
                updated_profile = response.json()
                
                if (updated_profile.get("isAcceptingJobs") == False and 
                    updated_profile.get("availabilityNote") == "Weekends only"):
                    self.log_test("Set Provider Unavailable", True, 
                                "Successfully set provider to unavailable with note",
                                update_data)
                else:
                    self.log_test("Set Provider Unavailable", False, 
                                "Response doesn't match update data",
                                {"sent": update_data, "received": updated_profile})
            else:
                self.log_test("Set Provider Unavailable", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Set Provider Unavailable", False, f"Exception: {str(e)}")
        
        # Test 2: Set available again
        try:
            update_data = {
                "isAcceptingJobs": True,
                "availabilityNote": None
            }
            
            response = self.make_request("PATCH", "/providers/me/availability", 
                                       token=self.provider_token, data=update_data)
            
            if response.status_code == 200:
                updated_profile = response.json()
                
                if updated_profile.get("isAcceptingJobs") == True:
                    self.log_test("Set Provider Available", True, 
                                "Successfully set provider back to available")
                else:
                    self.log_test("Set Provider Available", False, 
                                "Failed to set provider back to available",
                                updated_profile)
            else:
                self.log_test("Set Provider Available", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Set Provider Available", False, f"Exception: {str(e)}")
    
    def test_provider_discovery_filtering(self):
        """Test GET /api/providers?service=electrical with availability filtering"""
        print("\n🔍 Testing Provider Discovery Filtering...")
        
        # First, set provider to unavailable
        try:
            self.make_request("PATCH", "/providers/me/availability", 
                            token=self.provider_token, 
                            data={"isAcceptingJobs": False, "availabilityNote": "Testing"})
            
            # Test: Get electrical providers (should NOT include unavailable provider)
            response = self.make_request("GET", "/providers", 
                                       token=self.customer_token, 
                                       params={"service": "electrical"})
            
            if response.status_code == 200:
                providers = response.json()
                
                # Check if our test provider is excluded
                provider_ids = [p.get("id") or p.get("_id") for p in providers]
                
                if self.provider_id not in provider_ids:
                    self.log_test("Filter Unavailable Providers", True, 
                                "Unavailable provider correctly excluded from results",
                                f"Provider {self.provider_id} not in {len(providers)} results")
                else:
                    self.log_test("Filter Unavailable Providers", False, 
                                "Unavailable provider still appears in results",
                                f"Provider {self.provider_id} found in results")
            else:
                self.log_test("Filter Unavailable Providers", False, 
                            f"HTTP {response.status_code}: {response.text}")
            
            # Set provider back to available
            self.make_request("PATCH", "/providers/me/availability", 
                            token=self.provider_token, 
                            data={"isAcceptingJobs": True, "availabilityNote": None})
            
            # Test: Get electrical providers again (should include available provider)
            response = self.make_request("GET", "/providers", 
                                       token=self.customer_token, 
                                       params={"service": "electrical"})
            
            if response.status_code == 200:
                providers = response.json()
                provider_ids = [p.get("id") or p.get("_id") for p in providers]
                
                print(f"DEBUG: Available provider test - Provider IDs found: {provider_ids}")
                print(f"DEBUG: Looking for provider ID: {self.provider_id}")
                print(f"DEBUG: Total providers returned: {len(providers)}")
                
                if self.provider_id in provider_ids:
                    self.log_test("Include Available Providers", True, 
                                "Available provider correctly included in results",
                                f"Provider {self.provider_id} found in {len(providers)} results")
                else:
                    # Let's check if the provider has the electrical service
                    for provider in providers:
                        if provider.get("services") and "electrical" in provider.get("services", []):
                            print(f"DEBUG: Found electrical provider: {provider.get('id') or provider.get('_id')} with services: {provider.get('services')}")
                    
                    self.log_test("Include Available Providers", False, 
                                "Available provider not found in results",
                                f"Provider {self.provider_id} not in results. Available providers: {provider_ids}")
            else:
                self.log_test("Include Available Providers", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Provider Discovery Filtering", False, f"Exception: {str(e)}")
    
    def test_service_request_validation(self):
        """Test POST /api/service-requests with unavailable provider validation"""
        print("\n📝 Testing Service Request Validation...")
        
        if not self.provider_id:
            self.log_test("Service Request Validation", False, "No provider ID available for testing")
            return
        
        # Set provider to unavailable
        try:
            self.make_request("PATCH", "/providers/me/availability", 
                            token=self.provider_token, 
                            data={"isAcceptingJobs": False, "availabilityNote": "Testing unavailable"})
            
            # Try to create service request for unavailable provider
            request_data = {
                "service": "electrical",
                "description": "Test electrical work for unavailable provider",
                "preferredDateTime": "2024-01-15T10:00:00Z"
            }
            
            response = self.make_request("POST", "/service-requests", 
                                       token=self.customer_token, 
                                       data=request_data,
                                       params={"provider_id": self.provider_id})
            
            if response.status_code == 400:
                error_message = response.json().get("detail", "")
                
                if "unavailable" in error_message.lower():
                    self.log_test("Unavailable Provider Validation", True, 
                                "Correctly rejected request to unavailable provider",
                                f"Error: {error_message}")
                else:
                    self.log_test("Unavailable Provider Validation", False, 
                                "Got 400 error but message doesn't mention unavailable",
                                f"Error: {error_message}")
            else:
                self.log_test("Unavailable Provider Validation", False, 
                            f"Expected 400 error, got {response.status_code}: {response.text}")
            
            # Set provider back to available and test successful request
            self.make_request("PATCH", "/providers/me/availability", 
                            token=self.provider_token, 
                            data={"isAcceptingJobs": True, "availabilityNote": None})
            
            response = self.make_request("POST", "/service-requests", 
                                       token=self.customer_token, 
                                       data=request_data,
                                       params={"provider_id": self.provider_id})
            
            if response.status_code == 200:
                self.log_test("Available Provider Request", True, 
                            "Successfully created request for available provider")
            else:
                self.log_test("Available Provider Request", False, 
                            f"Failed to create request for available provider: {response.status_code}")
                
        except Exception as e:
            self.log_test("Service Request Validation", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all Phase 3A tests"""
        print("🚀 Starting Phase 3A: Provider Availability + Workload Control Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 70)
        
        # Setup authentication
        if not self.setup_authentication():
            print("❌ Authentication setup failed. Cannot proceed with tests.")
            return False
        
        # Run tests
        self.test_get_provider_profile()
        self.test_update_provider_availability()
        self.test_provider_discovery_filtering()
        self.test_service_request_validation()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = FixrAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)