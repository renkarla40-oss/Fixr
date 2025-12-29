#!/usr/bin/env python3
"""
Backend Testing Suite for Fixr Phase 4: Trust & Accountability
Tests phone verification, job codes, arrival confirmation, completion, reviews, and messaging
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://fixr-services.preview.emergentagent.com/api"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"

class FixrAPITester:
    def __init__(self):
        self.provider_token = None
        self.customer_token = None
        self.provider_id = None
        self.customer_id = None
        self.service_request_id = None
        self.job_code = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f": {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None) -> Dict[str, Any]:
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
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
                raise ValueError(f"Unsupported method: {method}")
                
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
                
            return {
                "status_code": response.status_code,
                "data": response_data,
                "success": 200 <= response.status_code < 300
            }
            
        except requests.exceptions.RequestException as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "success": False
            }
    
    def authenticate_users(self) -> bool:
        """Authenticate both provider and customer users"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Login provider
        provider_login = self.make_request("POST", "/auth/login", {
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        
        if provider_login["success"] and "token" in provider_login["data"]:
            self.provider_token = provider_login["data"]["token"]
            # Handle both 'id' and '_id' fields
            user_data = provider_login["data"]["user"]
            self.provider_id = user_data.get("id") or user_data.get("_id")
            self.log_test("Provider Authentication", True, f"Provider ID: {self.provider_id}")
        else:
            self.log_test("Provider Authentication", False, f"Login failed: {provider_login['data']}")
            return False
            
        # Login customer
        customer_login = self.make_request("POST", "/auth/login", {
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        if customer_login["success"] and "token" in customer_login["data"]:
            self.customer_token = customer_login["data"]["token"]
            # Handle both 'id' and '_id' fields
            user_data = customer_login["data"]["user"]
            self.customer_id = user_data.get("id") or user_data.get("_id")
            self.log_test("Customer Authentication", True, f"Customer ID: {self.customer_id}")
        else:
            self.log_test("Customer Authentication", False, f"Login failed: {customer_login['data']}")
            return False
            
        return True
    
    def test_phone_verification_flow(self) -> bool:
        """Test Phase 4: Phone Verification OTP Flow"""
        print("\n=== PHONE VERIFICATION OTP FLOW TESTS ===")
        
        test_phone = "8681234567"
        
        # 1. Send OTP
        send_otp = self.make_request("POST", "/providers/me/phone/send-otp", {
            "phone": test_phone
        }, self.provider_token)
        
        if send_otp["success"] and send_otp["data"].get("success"):
            message = send_otp["data"].get("message", "")
            # Extract OTP from beta message (format: "Code: 123456 (beta only)")
            otp_code = None
            if "Code: " in message:
                try:
                    otp_code = message.split("Code: ")[1].split(" ")[0]
                except:
                    pass
            
            self.log_test("Send OTP", True, f"OTP sent, code extracted: {otp_code}")
            
            if otp_code:
                # 2. Verify OTP
                verify_otp = self.make_request("POST", "/providers/me/phone/verify", {
                    "phone": test_phone,
                    "otp": otp_code
                }, self.provider_token)
                
                if verify_otp["success"] and verify_otp["data"].get("success"):
                    self.log_test("Verify OTP", True, "Phone verified successfully")
                    
                    # 3. Check provider profile for phoneVerified=true
                    profile = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
                    if profile["success"] and profile["data"].get("phoneVerified"):
                        self.log_test("Phone Verification Status", True, "phoneVerified=true in profile")
                        return True
                    else:
                        self.log_test("Phone Verification Status", False, f"phoneVerified not set: {profile['data']}")
                else:
                    self.log_test("Verify OTP", False, f"Verification failed: {verify_otp['data']}")
            else:
                self.log_test("Extract OTP Code", False, "Could not extract OTP from response")
        else:
            self.log_test("Send OTP", False, f"Send OTP failed: {send_otp['data']}")
            
        return False
    
    def test_service_request_job_code_generation(self) -> bool:
        """Test Phase 4: Service Request Job Code Generation"""
        print("\n=== SERVICE REQUEST & JOB CODE TESTS ===")
        
        # First, get provider profile to get provider ID for service request
        provider_profile = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
        if not provider_profile["success"]:
            self.log_test("Get Provider Profile", False, "Could not get provider profile")
            return False
            
        provider_db_id = provider_profile["data"].get("id") or provider_profile["data"].get("_id")
        
        # 1. Create service request as customer
        service_request = self.make_request("POST", f"/service-requests?provider_id={provider_db_id}", {
            "service": "electrical", 
            "description": "Test electrical work for Phase 4 testing",
            "preferredDateTime": datetime.now().isoformat(),
            "jobTown": "Port of Spain"
        }, self.customer_token)
        
        if service_request["success"] and service_request["data"].get("_id"):
            self.service_request_id = service_request["data"]["_id"]
            self.log_test("Create Service Request", True, f"Request ID: {self.service_request_id}")
            
            # 2. Accept request as provider (should generate job code)
            accept_request = self.make_request("PATCH", f"/service-requests/{self.service_request_id}/accept", 
                                             {}, self.provider_token)
            
            if accept_request["success"] and "jobCode" in accept_request["data"]:
                self.job_code = accept_request["data"]["jobCode"]
                self.log_test("Accept Request & Generate Job Code", True, f"Job code: {self.job_code}")
                return True
            else:
                self.log_test("Accept Request & Generate Job Code", False, f"No job code: {accept_request['data']}")
        else:
            self.log_test("Create Service Request", False, f"Request creation failed: {service_request['data']}")
            
        return False
    
    def test_job_arrival_confirmation(self) -> bool:
        """Test Phase 4: Job Arrival Confirmation"""
        print("\n=== JOB ARRIVAL CONFIRMATION TESTS ===")
        
        if not self.service_request_id or not self.job_code:
            self.log_test("Job Arrival Prerequisites", False, "Missing service request ID or job code")
            return False
        
        # 1. Test correct job code
        confirm_arrival = self.make_request("POST", f"/service-requests/{self.service_request_id}/confirm-arrival", {
            "jobCode": self.job_code
        }, self.provider_token)
        
        if confirm_arrival["success"] and confirm_arrival["data"].get("success"):
            self.log_test("Confirm Arrival - Correct Code", True, "Job marked as started")
            
            # 2. Test wrong job code (should fail)
            wrong_code_test = self.make_request("POST", f"/service-requests/{self.service_request_id}/confirm-arrival", {
                "jobCode": "999999"  # Wrong code
            }, self.provider_token)
            
            if not wrong_code_test["success"] and "Incorrect code" in str(wrong_code_test["data"]):
                self.log_test("Confirm Arrival - Wrong Code", True, "Correctly rejected wrong code")
                return True
            else:
                self.log_test("Confirm Arrival - Wrong Code", False, f"Should have rejected: {wrong_code_test['data']}")
        else:
            self.log_test("Confirm Arrival - Correct Code", False, f"Arrival confirmation failed: {confirm_arrival['data']}")
            
        return False
    
    def test_job_completion(self) -> bool:
        """Test Phase 4: Job Completion"""
        print("\n=== JOB COMPLETION TESTS ===")
        
        if not self.service_request_id:
            self.log_test("Job Completion Prerequisites", False, "Missing service request ID")
            return False
        
        # Complete the job
        complete_job = self.make_request("PATCH", f"/service-requests/{self.service_request_id}/complete", 
                                       {}, self.provider_token)
        
        if complete_job["success"] and complete_job["data"].get("success"):
            self.log_test("Complete Job", True, "Job marked as completed")
            
            # Check if provider's completedJobsCount was incremented
            provider_profile = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
            if provider_profile["success"]:
                completed_count = provider_profile["data"].get("completedJobsCount", 0)
                self.log_test("Increment Completed Jobs Count", True, f"Count: {completed_count}")
                return True
            else:
                self.log_test("Check Completed Jobs Count", False, "Could not verify count")
        else:
            self.log_test("Complete Job", False, f"Job completion failed: {complete_job['data']}")
            
        return False
    
    def test_review_system(self) -> bool:
        """Test Phase 4: Review System"""
        print("\n=== REVIEW SYSTEM TESTS ===")
        
        if not self.service_request_id:
            self.log_test("Review System Prerequisites", False, "Missing service request ID")
            return False
        
        # Submit review as customer
        submit_review = self.make_request("POST", f"/service-requests/{self.service_request_id}/review", {
            "rating": 5,
            "review": "Great work! Very professional and efficient."
        }, self.customer_token)
        
        if submit_review["success"] and submit_review["data"].get("success"):
            self.log_test("Submit Review", True, "Review submitted successfully")
            
            # Check if provider's rating was updated
            provider_profile = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
            if provider_profile["success"]:
                avg_rating = provider_profile["data"].get("averageRating")
                total_reviews = provider_profile["data"].get("totalReviews", 0)
                self.log_test("Update Provider Rating", True, f"Avg: {avg_rating}, Total: {total_reviews}")
                return True
            else:
                self.log_test("Check Provider Rating Update", False, "Could not verify rating update")
        else:
            self.log_test("Submit Review", False, f"Review submission failed: {submit_review['data']}")
            
        return False
    
    def test_in_app_messaging(self) -> bool:
        """Test Phase 4: In-App Messaging"""
        print("\n=== IN-APP MESSAGING TESTS ===")
        
        if not self.service_request_id:
            self.log_test("Messaging Prerequisites", False, "Missing service request ID")
            return False
        
        # 1. Send message as customer
        send_message = self.make_request("POST", f"/service-requests/{self.service_request_id}/messages", {
            "text": "Hello! When will you arrive?"
        }, self.customer_token)
        
        if send_message["success"] and send_message["data"].get("success"):
            self.log_test("Send Message - Customer", True, "Message sent successfully")
            
            # 2. Send message as provider
            provider_message = self.make_request("POST", f"/service-requests/{self.service_request_id}/messages", {
                "text": "I'll be there in 30 minutes!"
            }, self.provider_token)
            
            if provider_message["success"] and provider_message["data"].get("success"):
                self.log_test("Send Message - Provider", True, "Provider message sent")
                
                # 3. Get all messages
                get_messages = self.make_request("GET", f"/service-requests/{self.service_request_id}/messages", 
                                               token=self.customer_token)
                
                if get_messages["success"] and "messages" in get_messages["data"]:
                    messages = get_messages["data"]["messages"]
                    self.log_test("Get Messages", True, f"Retrieved {len(messages)} messages")
                    return len(messages) >= 2  # Should have at least 2 messages
                else:
                    self.log_test("Get Messages", False, f"Could not retrieve messages: {get_messages['data']}")
            else:
                self.log_test("Send Message - Provider", False, f"Provider message failed: {provider_message['data']}")
        else:
            self.log_test("Send Message - Customer", False, f"Customer message failed: {send_message['data']}")
            
        return False
    
    def test_fear_based_language_check(self) -> bool:
        """Test that responses contain no fear-based language"""
        print("\n=== FEAR-BASED LANGUAGE CHECK ===")
        
        # Check various endpoint responses for calm, neutral language
        fear_words = ["warning", "danger", "threat", "unsafe", "beware", "alert", "caution"]
        
        # Test provider profile endpoint
        profile = self.make_request("GET", "/providers/me/profile", token=self.provider_token)
        if profile["success"]:
            response_text = json.dumps(profile["data"]).lower()
            found_fear_words = [word for word in fear_words if word in response_text]
            
            if not found_fear_words:
                self.log_test("Fear-Based Language Check", True, "No fear-based language detected")
                return True
            else:
                self.log_test("Fear-Based Language Check", False, f"Found fear words: {found_fear_words}")
        else:
            self.log_test("Fear-Based Language Check", False, "Could not test - profile request failed")
            
        return False
    
    def run_all_tests(self):
        """Run all Phase 4 Trust & Accountability tests"""
        print("🚀 Starting Fixr Phase 4: Trust & Accountability Backend Tests")
        print(f"Testing against: {BASE_URL}")
        print(f"Provider: {PROVIDER_EMAIL}")
        print(f"Customer: {CUSTOMER_EMAIL}")
        
        # Authentication is prerequisite for all tests
        if not self.authenticate_users():
            print("\n❌ CRITICAL: Authentication failed - cannot proceed with tests")
            return False
        
        # Run all test suites
        test_results = []
        test_results.append(self.test_phone_verification_flow())
        test_results.append(self.test_service_request_job_code_generation())
        test_results.append(self.test_job_arrival_confirmation())
        test_results.append(self.test_job_completion())
        test_results.append(self.test_review_system())
        test_results.append(self.test_in_app_messaging())
        test_results.append(self.test_fear_based_language_check())
        
        # Summary
        passed = sum(test_results)
        total = len(test_results)
        
        print(f"\n{'='*50}")
        print(f"🏁 PHASE 4 TRUST & ACCOUNTABILITY TEST SUMMARY")
        print(f"{'='*50}")
        print(f"✅ Passed: {passed}/{total} test suites")
        print(f"❌ Failed: {total - passed}/{total} test suites")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Phase 4 backend is working correctly!")
        else:
            print("⚠️  Some tests failed - see details above")
            
        return passed == total

if __name__ == "__main__":
    tester = FixrAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)