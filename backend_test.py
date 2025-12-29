#!/usr/bin/env python3
"""
Backend API Testing for Phase 2: Location Flow + Radius Matching
Tests the Trinidad towns list, provider setup with location, and location-based provider matching
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://connect-fixr.preview.emergentagent.com/api"

# Test credentials
TEST_CUSTOMER = {"email": "customer@test.com", "password": "password123"}
TEST_PROVIDER = {"email": "provider@test.com", "password": "password123"}

class BackendTester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None) -> Dict[str, Any]:
        """Make HTTP request to backend"""
        url = f"{BACKEND_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            else:
                return {"error": f"Unsupported method: {method}"}
            
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "success": False}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode error: {str(e)}", "success": False}
    
    def authenticate_users(self) -> bool:
        """Authenticate test users"""
        print("=== AUTHENTICATION ===")
        
        # Login customer
        customer_response = self.make_request("POST", "/auth/login", TEST_CUSTOMER)
        if not customer_response.get("success"):
            self.log_result("Customer Authentication", False, f"Failed to login customer: {customer_response}")
            return False
        
        self.customer_token = customer_response["data"].get("token")
        if not self.customer_token:
            self.log_result("Customer Authentication", False, "No token received for customer")
            return False
        
        self.log_result("Customer Authentication", True, "Successfully authenticated customer")
        
        # Login provider
        provider_response = self.make_request("POST", "/auth/login", TEST_PROVIDER)
        if not provider_response.get("success"):
            self.log_result("Provider Authentication", False, f"Failed to login provider: {provider_response}")
            return False
        
        self.provider_token = provider_response["data"].get("token")
        if not self.provider_token:
            self.log_result("Provider Authentication", False, "No token received for provider")
            return False
        
        self.log_result("Provider Authentication", True, "Successfully authenticated provider")
        return True
    
    def test_towns_endpoint(self):
        """Test GET /api/towns endpoint"""
        print("=== TESTING TOWNS ENDPOINT ===")
        
        response = self.make_request("GET", "/towns", token=self.customer_token)
        
        if not response.get("success"):
            self.log_result("GET /api/towns", False, f"Request failed: {response}")
            return
        
        towns = response["data"]
        
        # Verify it's a list
        if not isinstance(towns, list):
            self.log_result("GET /api/towns", False, f"Expected list, got {type(towns)}")
            return
        
        # Verify we have 44+ towns as expected
        if len(towns) < 44:
            self.log_result("GET /api/towns", False, f"Expected 44+ towns, got {len(towns)}")
            return
        
        # Verify structure of first town
        if not towns:
            self.log_result("GET /api/towns", False, "Towns list is empty")
            return
        
        first_town = towns[0]
        required_fields = ["key", "label", "region"]
        missing_fields = [field for field in required_fields if field not in first_town]
        
        if missing_fields:
            self.log_result("GET /api/towns", False, f"Missing fields in town object: {missing_fields}")
            return
        
        # Check for specific towns mentioned in the code
        town_labels = [town["label"] for town in towns]
        expected_towns = ["Port of Spain", "San Juan", "Chaguanas", "San Fernando"]
        missing_towns = [town for town in expected_towns if town not in town_labels]
        
        if missing_towns:
            self.log_result("GET /api/towns", False, f"Missing expected towns: {missing_towns}")
            return
        
        self.log_result("GET /api/towns", True, f"Successfully returned {len(towns)} towns with correct structure")
    
    def test_provider_setup_with_location(self):
        """Test POST /api/users/provider-setup with location fields"""
        print("=== TESTING PROVIDER SETUP WITH LOCATION ===")
        
        setup_data = {
            "services": ["electrical"],
            "bio": "Test electrical provider for location testing",
            "baseTown": "Port of Spain",
            "travelRadiusMiles": 15,
            "travelAnywhere": True
        }
        
        response = self.make_request("POST", "/users/provider-setup", setup_data, self.provider_token)
        
        if not response.get("success"):
            self.log_result("Provider Setup with Location", False, f"Setup failed: {response}")
            return
        
        user_data = response["data"]
        
        # Verify user is now provider enabled
        if not user_data.get("isProviderEnabled"):
            self.log_result("Provider Setup with Location", False, "User not marked as provider enabled")
            return
        
        # Now verify the provider profile was created with location data
        provider_response = self.make_request("GET", "/providers", token=self.provider_token)
        
        if not provider_response.get("success"):
            self.log_result("Provider Setup with Location", False, f"Failed to fetch providers: {provider_response}")
            return
        
        providers = provider_response["data"]
        
        # Find our test provider
        test_provider = None
        for provider in providers:
            if provider.get("userId") == user_data.get("id"):
                test_provider = provider
                break
        
        if not test_provider:
            # Debug: Print available providers to understand the issue
            print(f"   DEBUG: User ID: {user_data.get('id')}")
            print(f"   DEBUG: Available providers: {len(providers)}")
            for i, provider in enumerate(providers):
                print(f"   DEBUG: Provider {i}: userId={provider.get('userId')}, name={provider.get('name')}")
            self.log_result("Provider Setup with Location", False, "Test provider not found in providers list")
            return
        
        # Verify location fields
        location_checks = [
            ("baseTown", "Port of Spain"),
            ("travelRadiusMiles", 15),
            ("travelAnywhere", True)
        ]
        
        for field, expected_value in location_checks:
            actual_value = test_provider.get(field)
            if actual_value != expected_value:
                self.log_result("Provider Setup with Location", False, 
                              f"Field {field}: expected {expected_value}, got {actual_value}")
                return
        
        self.log_result("Provider Setup with Location", True, 
                       "Provider successfully created with all location fields")
    
    def test_location_based_provider_matching(self):
        """Test GET /api/providers with location-based matching"""
        print("=== TESTING LOCATION-BASED PROVIDER MATCHING ===")
        
        # Test 1: Basic location search without travel providers
        print("Test 1: Providers in radius with travel OFF")
        params = {
            "service": "electrical",
            "job_town": "San Juan",
            "search_radius": "10",
            "include_travel_anywhere": "false"
        }
        
        response = self.make_request("GET", f"/providers?{'&'.join([f'{k}={v}' for k, v in params.items()])}", 
                                   token=self.customer_token)
        
        if not response.get("success"):
            self.log_result("Location Matching - Bucket A Only", False, f"Request failed: {response}")
            return
        
        bucket_a_providers = response["data"]
        
        # Verify response structure
        if not isinstance(bucket_a_providers, list):
            self.log_result("Location Matching - Bucket A Only", False, f"Expected list, got {type(bucket_a_providers)}")
            return
        
        # Check that providers have required location fields
        for provider in bucket_a_providers:
            required_fields = ["distanceFromJob", "isOutsideSelectedArea"]
            missing_fields = [field for field in required_fields if field not in provider]
            
            if missing_fields:
                self.log_result("Location Matching - Bucket A Only", False, 
                              f"Provider missing fields: {missing_fields}")
                return
            
            # Bucket A providers should not be outside selected area
            if provider.get("isOutsideSelectedArea"):
                self.log_result("Location Matching - Bucket A Only", False, 
                              "Bucket A provider marked as outside selected area")
                return
        
        self.log_result("Location Matching - Bucket A Only", True, 
                       f"Found {len(bucket_a_providers)} providers in Bucket A with correct fields")
        
        # Test 2: Include travel-anywhere providers (Bucket B)
        print("Test 2: Providers in radius with travel ON (includes Bucket B)")
        params["include_travel_anywhere"] = "true"
        
        response = self.make_request("GET", f"/providers?{'&'.join([f'{k}={v}' for k, v in params.items()])}", 
                                   token=self.customer_token)
        
        if not response.get("success"):
            self.log_result("Location Matching - Bucket A + B", False, f"Request failed: {response}")
            return
        
        all_providers = response["data"]
        
        # Should have same or more providers than Bucket A only
        if len(all_providers) < len(bucket_a_providers):
            self.log_result("Location Matching - Bucket A + B", False, 
                          f"With travel providers should have >= {len(bucket_a_providers)} providers, got {len(all_providers)}")
            return
        
        # Check for Bucket B providers (isOutsideSelectedArea = true)
        bucket_b_providers = [p for p in all_providers if p.get("isOutsideSelectedArea")]
        
        # Verify all providers have location fields
        for provider in all_providers:
            required_fields = ["distanceFromJob", "isOutsideSelectedArea"]
            missing_fields = [field for field in required_fields if field not in provider]
            
            if missing_fields:
                self.log_result("Location Matching - Bucket A + B", False, 
                              f"Provider missing fields: {missing_fields}")
                return
        
        self.log_result("Location Matching - Bucket A + B", True, 
                       f"Found {len(all_providers)} total providers ({len(bucket_b_providers)} in Bucket B)")
        
        # Test 3: Verify sorting (Bucket A should be sorted by distance)
        print("Test 3: Verify distance sorting in Bucket A")
        bucket_a_in_combined = [p for p in all_providers if not p.get("isOutsideSelectedArea")]
        
        # Check if sorted by distance (ascending)
        distances = [p.get("distanceFromJob") for p in bucket_a_in_combined if p.get("distanceFromJob") is not None]
        
        if distances and distances != sorted(distances):
            self.log_result("Location Matching - Distance Sorting", False, 
                          f"Bucket A not sorted by distance: {distances}")
            return
        
        self.log_result("Location Matching - Distance Sorting", True, 
                       "Bucket A providers correctly sorted by distance")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 STARTING BACKEND API TESTS FOR PHASE 2: LOCATION FLOW")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate_users():
            print("❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Run all tests
        self.test_towns_endpoint()
        self.test_provider_setup_with_location()
        self.test_location_based_provider_matching()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
        
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)