#!/usr/bin/env python3
"""
Backend Testing Suite for Phase 4: Trust - Provider Photo + ID Upload
Tests all backend endpoints and functionality for provider photo/ID uploads
"""

import requests
import json
import base64
import os
from typing import Dict, Any, Optional

# Get backend URL from frontend env
BACKEND_URL = "https://fixr-services.preview.emergentagent.com/api"

# Test credentials
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"

# Test data
PROVIDER_SETUP_DATA = {
    "services": ["electrical"],
    "bio": "Experienced electrician with 10+ years in residential and commercial work",
    "baseTown": "Port of Spain",
    "travelRadiusMiles": 15,
    "travelAnywhere": False
}

# Simple base64 test image (1x1 pixel PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

class BackendTester:
    def __init__(self):
        self.provider_token = None
        self.customer_token = None
        self.provider_id = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None) -> Dict[str, Any]:
        """Make HTTP request to backend"""
        url = f"{BACKEND_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PATCH":
                response = requests.patch(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "success": False
            }
    
    def setup_test_users(self):
        """Setup test users and get authentication tokens"""
        print("\n=== SETTING UP TEST USERS ===")
        
        # Login as provider
        provider_login = self.make_request("POST", "/auth/login", {
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        
        if provider_login["success"]:
            self.provider_token = provider_login["data"]["token"]
            self.log_result("Provider login", True, f"Token obtained")
        else:
            self.log_result("Provider login", False, f"Status: {provider_login['status_code']}, Error: {provider_login['data']}")
            return False
        
        # Login as customer
        customer_login = self.make_request("POST", "/auth/login", {
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        if customer_login["success"]:
            self.customer_token = customer_login["data"]["token"]
            self.log_result("Customer login", True, f"Token obtained")
        else:
            self.log_result("Customer login", False, f"Status: {customer_login['status_code']}, Error: {customer_login['data']}")
            return False
        
        return True
    
    def test_provider_setup(self):
        """Test provider setup creates profile with Phase 4 fields"""
        print("\n=== TESTING PROVIDER SETUP ===")
        
        # First check if provider already has uploads complete
        profile_check = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
        existing_uploads_complete = False
        if profile_check["success"]:
            existing_uploads_complete = profile_check["data"].get("uploadsComplete", False)
        
        # Create/update provider profile
        setup_response = self.make_request("POST", "/users/provider-setup", 
                                         PROVIDER_SETUP_DATA, self.provider_token)
        
        if setup_response["success"]:
            user_data = setup_response["data"]
            actual_enabled = user_data.get("isProviderEnabled", False)
            
            if existing_uploads_complete:
                # If uploads were already complete, provider should remain enabled
                if actual_enabled:
                    self.log_result("Provider setup - access control (existing uploads)", True, 
                                  f"isProviderEnabled correctly preserved as {actual_enabled} with existing uploads")
                else:
                    self.log_result("Provider setup - access control (existing uploads)", False,
                                  f"isProviderEnabled should remain true with existing uploads, got {actual_enabled}")
            else:
                # If no existing uploads, should NOT enable provider access
                expected_enabled = False  # Phase 4: uploads required first
                if actual_enabled == expected_enabled:
                    self.log_result("Provider setup - access control (new setup)", True, 
                                  f"isProviderEnabled correctly set to {actual_enabled}")
                else:
                    self.log_result("Provider setup - access control (new setup)", False,
                                  f"Expected isProviderEnabled={expected_enabled}, got {actual_enabled}")
        else:
            self.log_result("Provider setup", False, 
                          f"Status: {setup_response['status_code']}, Error: {setup_response['data']}")
    
    def test_provider_profile_endpoint(self):
        """Test GET /api/providers/me/profile endpoint"""
        print("\n=== TESTING PROVIDER PROFILE ENDPOINT ===")
        
        profile_response = self.make_request("GET", "/providers/me/profile", 
                                           token=self.provider_token)
        
        if profile_response["success"]:
            profile = profile_response["data"]
            
            # Check Phase 4 fields exist
            required_fields = ["profilePhotoUrl", "governmentIdFrontUrl", "governmentIdBackUrl", 
                             "uploadsComplete", "verificationStatus"]
            missing_fields = []
            
            for field in required_fields:
                if field not in profile:
                    missing_fields.append(field)
            
            if not missing_fields:
                self.log_result("Provider profile - Phase 4 fields", True, 
                              "All Phase 4 fields present in response")
                
                # Check if this is a fresh provider or one with existing uploads
                has_existing_uploads = bool(profile.get("profilePhotoUrl") and 
                                          profile.get("governmentIdFrontUrl") and 
                                          profile.get("governmentIdBackUrl"))
                
                if has_existing_uploads:
                    # Provider already has uploads - verify they're in correct state
                    expected_values = {
                        "uploadsComplete": True,
                        "verificationStatus": "pending"
                    }
                    
                    values_correct = True
                    for field, expected in expected_values.items():
                        actual = profile.get(field)
                        if actual != expected:
                            values_correct = False
                            self.log_result(f"Provider profile - {field} with uploads", False,
                                          f"Expected {expected}, got {actual}")
                    
                    if values_correct:
                        self.log_result("Provider profile - existing uploads state", True,
                                      "Provider with existing uploads has correct status")
                else:
                    # Fresh provider - check initial values
                    expected_values = {
                        "profilePhotoUrl": None,
                        "governmentIdFrontUrl": None, 
                        "governmentIdBackUrl": None,
                        "uploadsComplete": False,
                        "verificationStatus": "unverified"
                    }
                    
                    values_correct = True
                    for field, expected in expected_values.items():
                        actual = profile.get(field)
                        if actual != expected:
                            values_correct = False
                            self.log_result(f"Provider profile - {field} initial value", False,
                                          f"Expected {expected}, got {actual}")
                    
                    if values_correct:
                        self.log_result("Provider profile - initial values", True,
                                      "All Phase 4 fields have correct initial values")
            else:
                self.log_result("Provider profile - Phase 4 fields", False,
                              f"Missing fields: {missing_fields}")
        else:
            self.log_result("Provider profile endpoint", False,
                          f"Status: {profile_response['status_code']}, Error: {profile_response['data']}")
    
    def test_photo_upload_endpoint(self):
        """Test POST /api/providers/me/upload endpoint"""
        print("\n=== TESTING PHOTO UPLOAD ENDPOINT ===")
        
        # Test profile photo upload
        profile_upload = self.make_request("POST", "/providers/me/upload", {
            "imageData": TEST_IMAGE_BASE64,
            "uploadType": "profile_photo"
        }, self.provider_token)
        
        if profile_upload["success"]:
            provider = profile_upload["data"]
            profile_url = provider.get("profilePhotoUrl")
            
            if profile_url and profile_url.startswith("/api/uploads/profile_photos/"):
                self.log_result("Profile photo upload", True, f"URL: {profile_url}")
            else:
                self.log_result("Profile photo upload", False, 
                              f"Invalid profilePhotoUrl: {profile_url}")
        else:
            self.log_result("Profile photo upload", False,
                          f"Status: {profile_upload['status_code']}, Error: {profile_upload['data']}")
            return
        
        # Test government ID front upload
        id_front_upload = self.make_request("POST", "/providers/me/upload", {
            "imageData": TEST_IMAGE_BASE64,
            "uploadType": "government_id_front"
        }, self.provider_token)
        
        if id_front_upload["success"]:
            provider = id_front_upload["data"]
            id_front_url = provider.get("governmentIdFrontUrl")
            
            if id_front_url and id_front_url.startswith("/api/uploads/government_ids/"):
                self.log_result("Government ID front upload", True, f"URL: {id_front_url}")
            else:
                self.log_result("Government ID front upload", False,
                              f"Invalid governmentIdFrontUrl: {id_front_url}")
        else:
            self.log_result("Government ID front upload", False,
                          f"Status: {id_front_upload['status_code']}, Error: {id_front_upload['data']}")
            return
        
        # Test government ID back upload
        id_back_upload = self.make_request("POST", "/providers/me/upload", {
            "imageData": TEST_IMAGE_BASE64,
            "uploadType": "government_id_back"
        }, self.provider_token)
        
        if id_back_upload["success"]:
            provider = id_back_upload["data"]
            id_back_url = provider.get("governmentIdBackUrl")
            uploads_complete = provider.get("uploadsComplete", False)
            verification_status = provider.get("verificationStatus")
            
            if id_back_url and id_back_url.startswith("/api/uploads/government_ids/"):
                self.log_result("Government ID back upload", True, f"URL: {id_back_url}")
            else:
                self.log_result("Government ID back upload", False,
                              f"Invalid governmentIdBackUrl: {id_back_url}")
                return
            
            # Check if uploads completion triggers status changes
            if uploads_complete:
                self.log_result("Uploads completion detection", True, 
                              "uploadsComplete set to true after all uploads")
            else:
                self.log_result("Uploads completion detection", False,
                              "uploadsComplete should be true after all uploads")
            
            if verification_status == "pending":
                self.log_result("Verification status update", True,
                              "verificationStatus set to 'pending' after uploads complete")
            else:
                self.log_result("Verification status update", False,
                              f"Expected verificationStatus='pending', got '{verification_status}'")
        else:
            self.log_result("Government ID back upload", False,
                          f"Status: {id_back_upload['status_code']}, Error: {id_back_upload['data']}")
    
    def test_provider_access_enabled(self):
        """Test that provider access is enabled after uploads complete"""
        print("\n=== TESTING PROVIDER ACCESS ENABLEMENT ===")
        
        # Check user profile to see if provider access is enabled
        user_response = self.make_request("GET", "/auth/me", token=self.provider_token)
        
        if user_response["success"]:
            user = user_response["data"]
            is_enabled = user.get("isProviderEnabled", False)
            
            if is_enabled:
                self.log_result("Provider access enabled after uploads", True,
                              "isProviderEnabled=true after completing uploads")
            else:
                self.log_result("Provider access enabled after uploads", False,
                              "isProviderEnabled should be true after completing uploads")
        else:
            self.log_result("Provider access check", False,
                          f"Status: {user_response['status_code']}, Error: {user_response['data']}")
    
    def test_provider_search_filtering(self):
        """Test that provider search filters out providers without uploads"""
        print("\n=== TESTING PROVIDER SEARCH FILTERING ===")
        
        # Search for providers as customer
        search_response = self.make_request("GET", "/providers?service=electrical", 
                                          token=self.customer_token)
        
        if search_response["success"]:
            providers = search_response["data"]
            
            # Check that all returned providers have required uploads
            all_have_uploads = True
            provider_count = len(providers)
            
            for provider in providers:
                profile_photo = provider.get("profilePhotoUrl")
                id_front = provider.get("governmentIdFrontUrl")
                
                if not profile_photo or not id_front:
                    all_have_uploads = False
                    self.log_result("Provider search filtering", False,
                                  f"Provider {provider.get('name')} missing uploads: "
                                  f"photo={bool(profile_photo)}, id={bool(id_front)}")
                    break
            
            if all_have_uploads:
                self.log_result("Provider search filtering", True,
                              f"All {provider_count} providers have required uploads")
                
                # Check if our test provider appears in search (should appear after uploads)
                test_provider_found = False
                for provider in providers:
                    if provider.get("services") and "electrical" in provider["services"]:
                        # Check if this could be our test provider
                        if provider.get("profilePhotoUrl") and provider.get("governmentIdFrontUrl"):
                            test_provider_found = True
                            break
                
                if test_provider_found:
                    self.log_result("Test provider in search results", True,
                                  "Provider appears in search after completing uploads")
                else:
                    self.log_result("Test provider in search results", False,
                                  "Provider should appear in search after completing uploads")
        else:
            self.log_result("Provider search", False,
                          f"Status: {search_response['status_code']}, Error: {search_response['data']}")
    
    def test_profile_photo_serving(self):
        """Test that profile photos can be served publicly"""
        print("\n=== TESTING PROFILE PHOTO SERVING ===")
        
        # Get provider profile to get photo URL
        profile_response = self.make_request("GET", "/providers/me/profile", 
                                           token=self.provider_token)
        
        if profile_response["success"]:
            profile = profile_response["data"]
            photo_url = profile.get("profilePhotoUrl")
            
            if photo_url:
                # Test accessing the photo URL
                full_url = f"{BACKEND_URL.replace('/api', '')}{photo_url}"
                try:
                    photo_response = requests.get(full_url)
                    if photo_response.status_code == 200:
                        self.log_result("Profile photo serving", True,
                                      f"Photo accessible at {photo_url}")
                    else:
                        self.log_result("Profile photo serving", False,
                                      f"Photo not accessible: status {photo_response.status_code}")
                except Exception as e:
                    self.log_result("Profile photo serving", False,
                                  f"Error accessing photo: {str(e)}")
            else:
                self.log_result("Profile photo serving", False,
                              "No profilePhotoUrl found to test")
        else:
            self.log_result("Profile photo serving setup", False,
                          "Could not get provider profile for photo URL")
    
    def test_invalid_upload_scenarios(self):
        """Test error handling for invalid uploads"""
        print("\n=== TESTING INVALID UPLOAD SCENARIOS ===")
        
        # Test invalid upload type
        invalid_type_response = self.make_request("POST", "/providers/me/upload", {
            "imageData": TEST_IMAGE_BASE64,
            "uploadType": "invalid_type"
        }, self.provider_token)
        
        if not invalid_type_response["success"] and invalid_type_response["status_code"] == 400:
            self.log_result("Invalid upload type handling", True,
                          "Correctly rejected invalid upload type")
        else:
            self.log_result("Invalid upload type handling", False,
                          f"Should reject invalid upload type with 400, got {invalid_type_response['status_code']}")
        
        # Test invalid base64 data
        invalid_data_response = self.make_request("POST", "/providers/me/upload", {
            "imageData": "invalid_base64_data",
            "uploadType": "profile_photo"
        }, self.provider_token)
        
        if not invalid_data_response["success"] and invalid_data_response["status_code"] == 400:
            self.log_result("Invalid image data handling", True,
                          "Correctly rejected invalid base64 data")
        else:
            self.log_result("Invalid image data handling", False,
                          f"Should reject invalid base64 with 400, got {invalid_data_response['status_code']}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 STARTING PHASE 4 BACKEND TESTING")
        print("=" * 50)
        
        # Setup
        if not self.setup_test_users():
            print("❌ Failed to setup test users, aborting tests")
            return
        
        # Run tests in order
        self.test_provider_setup()
        self.test_provider_profile_endpoint()
        self.test_photo_upload_endpoint()
        self.test_provider_access_enabled()
        self.test_provider_search_filtering()
        self.test_profile_photo_serving()
        self.test_invalid_upload_scenarios()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)