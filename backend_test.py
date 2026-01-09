#!/usr/bin/env python3
"""
Backend Testing Suite for Reviews Feature
Tests the complete Reviews feature end-to-end using test accounts.
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://chat-jump-fixer.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer003@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider003@test.com"
PROVIDER_PASSWORD = "password123"

class ReviewsTestSuite:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.customer_id = None
        self.provider_id = None
        self.provider_profile_id = None
        self.completed_job_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status}: {test_name}")
        if details:
            self.test_results.append(f"    {details}")
        print(f"{status}: {test_name}")
        if details:
            print(f"    {details}")
    
    def make_request(self, method: str, endpoint: str, token: str = None, data: dict = None) -> tuple[bool, dict]:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
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
                return False, {"error": f"Unsupported method: {method}"}
            
            if response.status_code < 400:
                return True, response.json()
            else:
                return False, {
                    "status_code": response.status_code,
                    "error": response.text
                }
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_authentication(self):
        """Test 1-2: Authentication for both customer and provider"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test 1: Customer Authentication
        success, result = self.make_request("POST", "/auth/login", data={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        if success and "token" in result:
            self.customer_token = result["token"]
            self.customer_id = result["user"]["_id"]
            self.log_test("Customer Authentication", True, f"Customer ID: {self.customer_id}")
        else:
            self.log_test("Customer Authentication", False, f"Error: {result}")
            return False
        
        # Test 2: Provider Authentication
        success, result = self.make_request("POST", "/auth/login", data={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        
        if success and "token" in result:
            self.provider_token = result["token"]
            self.provider_id = result["user"]["_id"]
            self.log_test("Provider Authentication", True, f"Provider ID: {self.provider_id}")
        else:
            self.log_test("Provider Authentication", False, f"Error: {result}")
            return False
        
        return True
    
    def test_get_provider_profile(self):
        """Test 3: Get provider profile to get provider profile ID"""
        print("\n=== PROVIDER PROFILE TEST ===")
        
        success, result = self.make_request("GET", "/providers/me/profile", self.provider_token)
        
        if success and "_id" in result:
            self.provider_profile_id = result["_id"]
            self.log_test("Get Provider Profile", True, f"Provider Profile ID: {self.provider_profile_id}")
            return True
        else:
            self.log_test("Get Provider Profile", False, f"Error: {result}")
            return False
    
    def test_get_or_create_completed_job(self):
        """Test 4-10: Get or create a completed job for testing reviews"""
        print("\n=== COMPLETED JOB SETUP ===")
        
        # First, try to find an existing completed job
        success, result = self.make_request("GET", "/service-requests", self.customer_token)
        
        if success and isinstance(result, list):
            for request in result:
                if request.get("status") == "completed" and request.get("providerId") == self.provider_profile_id:
                    self.completed_job_id = request["_id"]
                    self.log_test("Found Existing Completed Job", True, f"Job ID: {self.completed_job_id}")
                    return True
        
        # If no completed job found, create the full workflow
        self.log_test("No Existing Completed Job Found", True, "Creating new job workflow...")
        
        # Test 4: Customer creates service request
        success, result = self.make_request("POST", "/service-requests", self.customer_token, {
            "service": "Plumbing",
            "description": "Test plumbing job for reviews testing",
            "providerId": self.provider_profile_id,
            "jobTown": "Port of Spain",
            "searchDistanceKm": 16
        })
        
        if success and "_id" in result:
            job_id = result["_id"]
            self.log_test("Create Service Request", True, f"Job ID: {job_id}")
        else:
            self.log_test("Create Service Request", False, f"Error: {result}")
            return False
        
        # Test 5: Provider accepts request
        success, result = self.make_request("PATCH", f"/service-requests/{job_id}/accept", self.provider_token)
        
        if success and "jobCode" in result:
            job_code = result["jobCode"]
            self.log_test("Provider Accepts Request", True, f"Job Code: {job_code}")
        else:
            self.log_test("Provider Accepts Request", False, f"Error: {result}")
            return False
        
        # Test 6: Create and send quote
        success, result = self.make_request("POST", "/quotes", self.provider_token, {
            "requestId": job_id,
            "amount": 150.00,
            "description": "Plumbing repair work",
            "estimatedDuration": "2 hours"
        })
        
        if success and "_id" in result:
            quote_id = result["_id"]
            self.log_test("Create Quote", True, f"Quote ID: {quote_id}")
        else:
            self.log_test("Create Quote", False, f"Error: {result}")
            return False
        
        # Test 7: Send quote
        success, result = self.make_request("POST", f"/quotes/{quote_id}/send", self.provider_token)
        
        if success:
            self.log_test("Send Quote", True, "Quote sent successfully")
        else:
            self.log_test("Send Quote", False, f"Error: {result}")
            return False
        
        # Test 8: Customer accepts quote
        success, result = self.make_request("POST", f"/quotes/{quote_id}/accept", self.customer_token)
        
        if success:
            self.log_test("Customer Accepts Quote", True, "Quote accepted")
        else:
            self.log_test("Customer Accepts Quote", False, f"Error: {result}")
            return False
        
        # Test 9: Customer pays quote (sandbox)
        success, result = self.make_request("POST", f"/quotes/{quote_id}/sandbox-pay", self.customer_token)
        
        if success:
            self.log_test("Customer Pays Quote (Sandbox)", True, "Payment successful")
        else:
            self.log_test("Customer Pays Quote (Sandbox)", False, f"Error: {result}")
            return False
        
        # Test 10: Provider confirms arrival and starts job
        success, result = self.make_request("POST", f"/service-requests/{job_id}/confirm-arrival", self.provider_token, {
            "jobCode": job_code
        })
        
        if success:
            self.log_test("Provider Confirms Arrival", True, "Job started")
        else:
            self.log_test("Provider Confirms Arrival", False, f"Error: {result}")
            return False
        
        # Test 11: Provider completes job
        success, result = self.make_request("PATCH", f"/service-requests/{job_id}/complete", self.provider_token, {
            "completionOtp": "123456"  # Using test OTP
        })
        
        if success:
            self.completed_job_id = job_id
            self.log_test("Provider Completes Job", True, f"Job completed: {job_id}")
            return True
        else:
            self.log_test("Provider Completes Job", False, f"Error: {result}")
            return False
    
    def test_reviews_backend(self):
        """Test 12-18: Reviews backend functionality"""
        print("\n=== REVIEWS BACKEND TESTS ===")
        
        if not self.completed_job_id:
            self.log_test("Reviews Backend Tests", False, "No completed job available")
            return False
        
        # Get provider rating before review
        success, result = self.make_request("GET", f"/providers/{self.provider_profile_id}", self.customer_token)
        provider_rating_before = None
        provider_reviews_before = 0
        
        if success:
            provider_rating_before = result.get("averageRating")
            provider_reviews_before = result.get("totalReviews", 0)
            self.log_test("Get Provider Rating Before Review", True, 
                         f"Rating: {provider_rating_before}, Reviews: {provider_reviews_before}")
        
        # Test 12: Create review with valid data
        success, result = self.make_request("POST", "/reviews", self.customer_token, {
            "jobId": self.completed_job_id,
            "rating": 5,
            "comment": "Excellent service, very professional!"
        })
        
        if success and "_id" in result:
            review_id = result["_id"]
            self.log_test("Create Review (Valid Data)", True, f"Review ID: {review_id}")
        else:
            self.log_test("Create Review (Valid Data)", False, f"Error: {result}")
            return False
        
        # Test 13: Verify review was created - GET /api/reviews/by-job/{jobId}
        success, result = self.make_request("GET", f"/reviews/by-job/{self.completed_job_id}", self.customer_token)
        
        if success and "rating" in result:
            self.log_test("Get Review by Job ID", True, f"Rating: {result['rating']}, Comment: {result.get('comment', 'None')}")
        else:
            self.log_test("Get Review by Job ID", False, f"Error: {result}")
        
        # Test 14: Get reviews by provider - GET /api/reviews/by-provider/{providerId}
        success, result = self.make_request("GET", f"/reviews/by-provider/{self.provider_profile_id}", self.customer_token)
        
        if success and "reviews" in result:
            reviews = result["reviews"]
            total = result.get("total", 0)
            self.log_test("Get Reviews by Provider", True, f"Found {len(reviews)} reviews, Total: {total}")
        else:
            self.log_test("Get Reviews by Provider", False, f"Error: {result}")
        
        # Test 15: Verify provider rating was updated
        success, result = self.make_request("GET", f"/providers/{self.provider_profile_id}", self.customer_token)
        
        if success:
            provider_rating_after = result.get("averageRating")
            provider_reviews_after = result.get("totalReviews", 0)
            
            if provider_reviews_after > provider_reviews_before:
                self.log_test("Provider Rating Updated", True, 
                             f"Before: {provider_rating_before}/{provider_reviews_before} → After: {provider_rating_after}/{provider_reviews_after}")
            else:
                self.log_test("Provider Rating Updated", False, 
                             f"Review count not increased: {provider_reviews_before} → {provider_reviews_after}")
        else:
            self.log_test("Provider Rating Updated", False, f"Error: {result}")
        
        # Test 16: Verify provider rating in provider list
        success, result = self.make_request("GET", "/providers", self.customer_token)
        
        if success and isinstance(result, list):
            found_provider = None
            for provider in result:
                if provider.get("id") == self.provider_profile_id:
                    found_provider = provider
                    break
            
            if found_provider and found_provider.get("averageRating") is not None:
                self.log_test("Provider Rating in List", True, 
                             f"Rating: {found_provider['averageRating']}, Reviews: {found_provider.get('totalReviews', 0)}")
            else:
                self.log_test("Provider Rating in List", False, "Provider not found or no rating")
        else:
            self.log_test("Provider Rating in List", False, f"Error: {result}")
        
        # Test 17: Verify quote includes provider rating
        success, result = self.make_request("GET", f"/quotes/by-request/{self.completed_job_id}", self.customer_token)
        
        if success and "quote" in result and result["quote"]:
            quote = result["quote"]
            if "providerRating" in quote and "providerReviewCount" in quote:
                self.log_test("Quote Includes Provider Rating", True, 
                             f"Rating: {quote['providerRating']}, Count: {quote['providerReviewCount']}")
            else:
                self.log_test("Quote Includes Provider Rating", False, "Rating fields missing from quote")
        else:
            self.log_test("Quote Includes Provider Rating", False, f"Error: {result}")
        
        return True
    
    def test_validation_and_authorization(self):
        """Test 18-22: Validation and authorization tests"""
        print("\n=== VALIDATION & AUTHORIZATION TESTS ===")
        
        if not self.completed_job_id:
            self.log_test("Validation Tests", False, "No completed job available")
            return False
        
        # Test 18: Invalid rating (0)
        success, result = self.make_request("POST", "/reviews", self.customer_token, {
            "jobId": self.completed_job_id,
            "rating": 0,
            "comment": "Invalid rating test"
        })
        
        if not success and "400" in str(result.get("status_code", "")):
            self.log_test("Invalid Rating (0) - Validation", True, "Correctly rejected rating=0")
        else:
            self.log_test("Invalid Rating (0) - Validation", False, f"Should have failed: {result}")
        
        # Test 19: Invalid rating (6)
        success, result = self.make_request("POST", "/reviews", self.customer_token, {
            "jobId": self.completed_job_id,
            "rating": 6,
            "comment": "Invalid rating test"
        })
        
        if not success and "400" in str(result.get("status_code", "")):
            self.log_test("Invalid Rating (6) - Validation", True, "Correctly rejected rating=6")
        else:
            self.log_test("Invalid Rating (6) - Validation", False, f"Should have failed: {result}")
        
        # Test 20: Duplicate review (idempotency)
        success, result = self.make_request("POST", "/reviews", self.customer_token, {
            "jobId": self.completed_job_id,
            "rating": 4,
            "comment": "Duplicate review test"
        })
        
        if success and "_id" in result:
            # Should return existing review, not create new one
            self.log_test("Duplicate Review - Idempotency", True, "Returned existing review")
        else:
            self.log_test("Duplicate Review - Idempotency", False, f"Error: {result}")
        
        # Test 21: Unauthorized access (provider trying to review their own job)
        success, result = self.make_request("POST", "/reviews", self.provider_token, {
            "jobId": self.completed_job_id,
            "rating": 5,
            "comment": "Provider trying to review"
        })
        
        if not success and ("403" in str(result.get("status_code", "")) or "401" in str(result.get("status_code", ""))):
            self.log_test("Unauthorized Review - Provider", True, "Correctly rejected provider review")
        else:
            self.log_test("Unauthorized Review - Provider", False, f"Should have failed: {result}")
        
        # Test 22: Invalid job ID
        success, result = self.make_request("GET", "/reviews/by-job/invalid_job_id", self.customer_token)
        
        if not success and "400" in str(result.get("status_code", "")):
            self.log_test("Invalid Job ID - Validation", True, "Correctly rejected invalid job ID")
        else:
            self.log_test("Invalid Job ID - Validation", False, f"Should have failed: {result}")
        
        return True
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print("🧪 REVIEWS FEATURE END-TO-END TESTING")
        print("=" * 50)
        
        # Run test phases
        if not self.test_authentication():
            print("\n❌ AUTHENTICATION FAILED - STOPPING TESTS")
            return False
        
        if not self.test_get_provider_profile():
            print("\n❌ PROVIDER PROFILE FAILED - STOPPING TESTS")
            return False
        
        if not self.test_get_or_create_completed_job():
            print("\n❌ COMPLETED JOB SETUP FAILED - STOPPING TESTS")
            return False
        
        self.test_reviews_backend()
        self.test_validation_and_authorization()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n📈 RESULTS: {passed} PASSED, {failed} FAILED")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED! Reviews feature is working correctly.")
            return True
        else:
            print(f"⚠️  {failed} TESTS FAILED. Please review the issues above.")
            return False

if __name__ == "__main__":
    test_suite = ReviewsTestSuite()
    success = test_suite.run_all_tests()
    sys.exit(0 if success else 1)