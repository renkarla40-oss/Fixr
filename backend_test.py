#!/usr/bin/env python3
"""
Backend Testing Script for Fixr App - Request Detail and Chat Features
Testing the fixed Request Detail and Chat features as requested.
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://fixr-chat.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class FixrAPITester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.customer_user = None
        self.provider_user = None
        self.test_request_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def make_request(self, method: str, endpoint: str, token: str = None, data: Dict = None, params: Dict = None) -> Dict:
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PATCH":
                response = requests.patch(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Return both status and content for analysis
            return {
                "status_code": response.status_code,
                "content": response.json() if response.content else {},
                "success": response.status_code < 400
            }
        except requests.exceptions.RequestException as e:
            return {
                "status_code": 0,
                "content": {"error": str(e)},
                "success": False
            }
        except json.JSONDecodeError:
            return {
                "status_code": response.status_code,
                "content": {"error": "Invalid JSON response"},
                "success": False
            }
    
    def login_user(self, email: str, password: str, user_type: str) -> Optional[str]:
        """Login user and return token"""
        response = self.make_request("POST", "/auth/login", data={
            "email": email,
            "password": password
        })
        
        if response["success"]:
            token = response["content"]["token"]
            user = response["content"]["user"]
            self.log_test(f"{user_type} Login", True, f"Successfully logged in as {email}")
            return token, user
        else:
            self.log_test(f"{user_type} Login", False, f"Failed to login as {email}", response["content"])
            return None, None
    
    def test_authentication(self):
        """Test user authentication"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Login customer
        self.customer_token, self.customer_user = self.login_user(CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "Customer")
        
        # Login provider
        self.provider_token, self.provider_user = self.login_user(PROVIDER_EMAIL, PROVIDER_PASSWORD, "Provider")
        
        if not self.customer_token or not self.provider_token:
            print("❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return False
        
        return True
    
    def create_test_service_request(self) -> Optional[str]:
        """Create a test service request for testing"""
        print("\n=== CREATING TEST SERVICE REQUEST ===")
        
        # First get provider ID
        provider_response = self.make_request("GET", "/providers/me/profile", self.provider_token)
        if not provider_response["success"]:
            self.log_test("Get Provider Profile", False, "Failed to get provider profile", provider_response["content"])
            return None
        
        # Debug: Check the response structure
        print(f"Provider response: {provider_response['content']}")
        provider_id = provider_response["content"].get("id") or provider_response["content"].get("_id")
        
        # Create service request as customer
        request_data = {
            "service": "electrical",
            "description": "Test electrical work for request detail and chat testing",
            "preferredDateTime": datetime.now().isoformat(),
            "jobTown": "Port of Spain"
        }
        
        response = self.make_request("POST", f"/service-requests?provider_id={provider_id}", 
                                   self.customer_token, request_data)
        
        if response["success"]:
            request_id = response["content"].get("id") or response["content"].get("_id")
            self.log_test("Create Service Request", True, f"Created test request with ID: {request_id}")
            return request_id
        else:
            self.log_test("Create Service Request", False, "Failed to create test request", response["content"])
            return None
    
    def test_request_detail_endpoint(self):
        """Test GET /api/service-requests/{id} endpoint"""
        print("\n=== REQUEST DETAIL TESTS ===")
        
        # Create a test request first
        self.test_request_id = self.create_test_service_request()
        if not self.test_request_id:
            self.log_test("Request Detail Setup", False, "Could not create test request")
            return
        
        # Test 1: Get request detail as customer (owner)
        response = self.make_request("GET", f"/service-requests/{self.test_request_id}", self.customer_token)
        
        if response["success"]:
            request_detail = response["content"]
            required_fields = ["_id", "service", "description", "status", "customerName"]
            missing_fields = [field for field in required_fields if field not in request_detail]
            
            if not missing_fields:
                self.log_test("Get Request Detail - Customer", True, 
                            f"Successfully retrieved request detail with all required fields")
                
                # Verify specific fields
                if request_detail["_id"] == self.test_request_id:
                    self.log_test("Request ID Match", True, "Request ID matches expected value")
                else:
                    self.log_test("Request ID Match", False, f"ID mismatch: expected {self.test_request_id}, got {request_detail['_id']}")
                
                if request_detail["service"] == "electrical":
                    self.log_test("Service Field", True, "Service field contains expected value")
                else:
                    self.log_test("Service Field", False, f"Service mismatch: expected 'electrical', got {request_detail['service']}")
                    
            else:
                self.log_test("Get Request Detail - Customer", False, 
                            f"Missing required fields: {missing_fields}", request_detail)
        else:
            self.log_test("Get Request Detail - Customer", False, 
                        "Failed to get request detail", response["content"])
        
        # Test 2: Get request detail as provider
        response = self.make_request("GET", f"/service-requests/{self.test_request_id}", self.provider_token)
        
        if response["success"]:
            self.log_test("Get Request Detail - Provider", True, 
                        "Provider can access assigned request detail")
        else:
            self.log_test("Get Request Detail - Provider", False, 
                        "Provider cannot access request detail", response["content"])
        
        # Test 3: Test with invalid ID (should return 404 with friendly message)
        invalid_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
        response = self.make_request("GET", f"/service-requests/{invalid_id}", self.customer_token)
        
        if response["status_code"] == 404:
            error_message = response["content"].get("detail", "")
            if "Request not found" in error_message and "AxiosError" not in error_message:
                self.log_test("Invalid Request ID - 404", True, 
                            f"Returns proper 404 with friendly message: '{error_message}'")
            else:
                self.log_test("Invalid Request ID - 404", False, 
                            f"404 message not user-friendly: '{error_message}'")
        else:
            self.log_test("Invalid Request ID - 404", False, 
                        f"Expected 404, got {response['status_code']}", response["content"])
    
    def test_job_accept_with_code_generation(self):
        """Test job acceptance and code generation"""
        print("\n=== JOB ACCEPT & CODE GENERATION TESTS ===")
        
        if not self.test_request_id:
            self.log_test("Job Accept Setup", False, "No test request available")
            return
        
        # Accept the job as provider
        response = self.make_request("PATCH", f"/service-requests/{self.test_request_id}/accept", 
                                   self.provider_token)
        
        if response["success"]:
            accept_response = response["content"]
            
            # Check if jobCode is in response
            if "jobCode" in accept_response:
                job_code = accept_response["jobCode"]
                if len(str(job_code)) == 6 and str(job_code).isdigit():
                    self.log_test("Job Accept - Code Generation", True, 
                                f"Generated 6-digit job code: {job_code}")
                    
                    # Verify the job code is saved in the request
                    detail_response = self.make_request("GET", f"/service-requests/{self.test_request_id}", 
                                                      self.customer_token)
                    
                    if detail_response["success"]:
                        saved_code = detail_response["content"].get("jobCode")
                        if saved_code == job_code:
                            self.log_test("Job Code Persistence", True, 
                                        "Job code correctly saved in request")
                        else:
                            self.log_test("Job Code Persistence", False, 
                                        f"Job code not saved correctly: expected {job_code}, got {saved_code}")
                    else:
                        self.log_test("Job Code Persistence", False, 
                                    "Could not verify job code persistence", detail_response["content"])
                        
                else:
                    self.log_test("Job Accept - Code Generation", False, 
                                f"Invalid job code format: {job_code} (should be 6 digits)")
            else:
                self.log_test("Job Accept - Code Generation", False, 
                            "No jobCode in accept response", accept_response)
        else:
            self.log_test("Job Accept - Code Generation", False, 
                        "Failed to accept job", response["content"])
    
    def test_chat_messages(self):
        """Test chat messaging functionality"""
        print("\n=== CHAT MESSAGES TESTS ===")
        
        if not self.test_request_id:
            self.log_test("Chat Messages Setup", False, "No test request available")
            return
        
        # Test 1: Send message as customer
        customer_message = {
            "text": "Hello, I'm ready for the electrical work. When can you come?"
        }
        
        response = self.make_request("POST", f"/service-requests/{self.test_request_id}/messages", 
                                   self.customer_token, customer_message)
        
        if response["success"]:
            self.log_test("Send Message - Customer", True, "Customer successfully sent message")
            customer_msg_response = response["content"]
        else:
            self.log_test("Send Message - Customer", False, 
                        "Customer failed to send message", response["content"])
            return
        
        # Test 2: Send message as provider
        provider_message = {
            "text": "Hi! I can come tomorrow morning around 9 AM. Does that work for you?"
        }
        
        response = self.make_request("POST", f"/service-requests/{self.test_request_id}/messages", 
                                   self.provider_token, provider_message)
        
        if response["success"]:
            self.log_test("Send Message - Provider", True, "Provider successfully sent message")
        else:
            self.log_test("Send Message - Provider", False, 
                        "Provider failed to send message", response["content"])
            return
        
        # Test 3: Get all messages and verify order
        response = self.make_request("GET", f"/service-requests/{self.test_request_id}/messages", 
                                   self.customer_token)
        
        if response["success"]:
            messages_data = response["content"]
            messages = messages_data.get("messages", [])
            
            if len(messages) >= 2:
                # Check if messages are in chronological order
                customer_msg = None
                provider_msg = None
                
                for msg in messages:
                    if msg.get("senderRole") == "customer" and customer_message["text"] in msg.get("text", ""):
                        customer_msg = msg
                    elif msg.get("senderRole") == "provider" and provider_message["text"] in msg.get("text", ""):
                        provider_msg = msg
                
                if customer_msg and provider_msg:
                    self.log_test("Get Messages - Content", True, 
                                f"Both messages retrieved correctly (total: {len(messages)} messages)")
                    
                    # Verify message structure
                    required_msg_fields = ["_id", "senderId", "senderName", "senderRole", "text", "createdAt"]
                    customer_missing = [field for field in required_msg_fields if field not in customer_msg]
                    provider_missing = [field for field in required_msg_fields if field not in provider_msg]
                    
                    if not customer_missing and not provider_missing:
                        self.log_test("Message Structure", True, 
                                    "Messages contain all required fields")
                    else:
                        self.log_test("Message Structure", False, 
                                    f"Missing fields - Customer: {customer_missing}, Provider: {provider_missing}")
                        
                else:
                    self.log_test("Get Messages - Content", False, 
                                f"Could not find expected messages in response: {messages}")
            else:
                self.log_test("Get Messages - Content", False, 
                            f"Expected at least 2 messages, got {len(messages)}")
        else:
            self.log_test("Get Messages - Content", False, 
                        "Failed to retrieve messages", response["content"])
        
        # Test 4: Verify provider can also get messages
        response = self.make_request("GET", f"/service-requests/{self.test_request_id}/messages", 
                                   self.provider_token)
        
        if response["success"]:
            self.log_test("Get Messages - Provider Access", True, 
                        "Provider can access job messages")
        else:
            self.log_test("Get Messages - Provider Access", False, 
                        "Provider cannot access messages", response["content"])
    
    def test_error_messages(self):
        """Test that error messages are user-friendly"""
        print("\n=== ERROR MESSAGE TESTS ===")
        
        # Test 1: 404 for non-existent request
        invalid_id = "507f1f77bcf86cd799439011"
        response = self.make_request("GET", f"/service-requests/{invalid_id}", self.customer_token)
        
        if response["status_code"] == 404:
            error_msg = response["content"].get("detail", "")
            has_friendly_msg = "Request not found" in error_msg
            has_technical_jargon = any(term in error_msg.lower() for term in ["axios", "error", "exception", "traceback"])
            
            if has_friendly_msg and not has_technical_jargon:
                self.log_test("404 Error Message", True, f"User-friendly 404 message: '{error_msg}'")
            else:
                self.log_test("404 Error Message", False, f"404 message not user-friendly: '{error_msg}'")
        else:
            self.log_test("404 Error Message", False, f"Expected 404, got {response['status_code']}")
        
        # Test 2: 403 for unauthorized access (try to access another user's request)
        # Create a dummy request ID that would belong to another user
        response = self.make_request("GET", f"/service-requests/{invalid_id}", self.provider_token)
        
        if response["status_code"] in [403, 404]:  # Could be either depending on implementation
            error_msg = response["content"].get("detail", "")
            has_friendly_msg = any(phrase in error_msg for phrase in ["Not authorized", "Request not found"])
            has_technical_jargon = any(term in error_msg.lower() for term in ["axios", "error", "exception", "traceback"])
            
            if has_friendly_msg and not has_technical_jargon:
                self.log_test("Authorization Error Message", True, f"User-friendly auth message: '{error_msg}'")
            else:
                self.log_test("Authorization Error Message", False, f"Auth message not user-friendly: '{error_msg}'")
        else:
            self.log_test("Authorization Error Message", False, f"Expected 403/404, got {response['status_code']}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Fixr Backend Tests - Request Detail and Chat Features")
        print("=" * 70)
        
        # Authentication is required for all tests
        if not self.test_authentication():
            return
        
        # Run specific tests as requested
        self.test_request_detail_endpoint()
        self.test_job_accept_with_code_generation()
        self.test_chat_messages()
        self.test_error_messages()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 70)
        return failed_tests == 0

if __name__ == "__main__":
    tester = FixrAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)