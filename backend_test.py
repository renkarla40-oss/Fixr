#!/usr/bin/env python3
"""
Backend API Testing for Message Read Status Features
Tests the new POST /api/messages/mark-read endpoint and message delivery/read tracking
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://status-updater-3.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, test_name: str):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def failure(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Results: {self.passed}/{total} passed")
        if self.errors:
            print("\n🔍 Failures:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method: str, endpoint: str, data: Dict[Any, Any] = None, headers: Dict[str, str] = None) -> requests.Response:
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "PATCH":
            response = requests.patch(url, json=data, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        raise

def login_user(email: str, password: str) -> Optional[str]:
    """Login user and return auth token"""
    try:
        response = make_request("POST", "/auth/login", {
            "email": email,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return None

def get_auth_headers(token: str) -> Dict[str, str]:
    """Get authorization headers"""
    return {"Authorization": f"Bearer {token}"}

def test_message_read_functionality():
    """Test the complete message read functionality"""
    result = TestResult()
    
    print("🧪 Testing Message Read Status Features")
    print("=" * 50)
    
    # Step 1: Login as customer
    print("\n1️⃣ Authenticating users...")
    customer_token = login_user(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    if not customer_token:
        result.failure("Customer Authentication", "Failed to login customer")
        return result
    result.success("Customer Authentication")
    
    # Step 2: Login as provider
    provider_token = login_user(PROVIDER_EMAIL, PROVIDER_PASSWORD)
    if not provider_token:
        result.failure("Provider Authentication", "Failed to login provider")
        return result
    result.success("Provider Authentication")
    
    customer_headers = get_auth_headers(customer_token)
    provider_headers = get_auth_headers(provider_token)
    
    # Step 3: Create a new service request for testing
    print("\n2️⃣ Setting up service request...")
    try:
        # Always create a new service request to ensure it's in pending status
        create_response = make_request("POST", "/service-requests", {
            "service": "Plumbing",
            "description": "Test plumbing service for message testing",
            "preferredDateTime": datetime.utcnow().isoformat(),
            "jobTown": "Port of Spain",
            "searchDistanceKm": 16
        }, customer_headers)
        
        service_request_id = None
        if create_response.status_code == 200:
            service_request_id = create_response.json()["_id"]
            result.success("Created New Service Request")
        else:
            result.failure("Create Service Request", f"Status: {create_response.status_code}, Response: {create_response.text}")
            return result
            
    except Exception as e:
        result.failure("Service Request Setup", str(e))
        return result
    
    if not service_request_id:
        result.failure("Service Request Setup", "No service request ID available")
        return result
    
    print(f"📋 Using Service Request ID: {service_request_id}")
    
    # Step 4: Send a message as customer
    print("\n3️⃣ Testing message creation...")
    try:
        message_text = f"Test message from customer at {datetime.utcnow().isoformat()}"
        response = make_request("POST", f"/service-requests/{service_request_id}/messages", {
            "text": message_text
        }, customer_headers)
        
        if response.status_code == 200:
            message_data = response.json()
            if message_data.get("success") and "message" in message_data:
                msg = message_data["message"]
                
                # Verify deliveredAt is set
                if msg.get("deliveredAt"):
                    result.success("Message Creation - deliveredAt Set")
                else:
                    result.failure("Message Creation - deliveredAt", "deliveredAt not set on message creation")
                
                # Verify readAt is null
                if msg.get("readAt") is None:
                    result.success("Message Creation - readAt Null")
                else:
                    result.failure("Message Creation - readAt", f"readAt should be null but got: {msg.get('readAt')}")
                
                result.success("Message Creation")
            else:
                result.failure("Message Creation", f"Invalid response structure: {message_data}")
        else:
            result.failure("Message Creation", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        result.failure("Message Creation", str(e))
    
    # Step 5: Verify message retrieval shows deliveredAt and readAt fields
    print("\n4️⃣ Testing message retrieval...")
    try:
        response = make_request("GET", f"/service-requests/{service_request_id}/messages", headers=provider_headers)
        
        if response.status_code == 200:
            messages_data = response.json()
            messages = messages_data.get("messages", [])
            
            if messages:
                latest_message = messages[-1]  # Get the latest message
                
                # Check deliveredAt field exists
                if "deliveredAt" in latest_message:
                    result.success("Message Retrieval - deliveredAt Field Present")
                else:
                    result.failure("Message Retrieval - deliveredAt", "deliveredAt field missing from message")
                
                # Check readAt field exists (should be null)
                if "readAt" in latest_message:
                    if latest_message["readAt"] is None:
                        result.success("Message Retrieval - readAt Field Present (null)")
                    else:
                        result.failure("Message Retrieval - readAt", f"readAt should be null but got: {latest_message['readAt']}")
                else:
                    result.failure("Message Retrieval - readAt", "readAt field missing from message")
                
                result.success("Message Retrieval")
            else:
                result.failure("Message Retrieval", "No messages found")
        else:
            result.failure("Message Retrieval", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        result.failure("Message Retrieval", str(e))
    
    # Step 6: Test POST /api/messages/mark-read endpoint
    print("\n5️⃣ Testing POST /api/messages/mark-read endpoint...")
    try:
        response = make_request("POST", "/messages/mark-read", {
            "jobId": service_request_id
        }, provider_headers)
        
        if response.status_code == 200:
            mark_read_data = response.json()
            
            # Verify response structure
            if mark_read_data.get("success"):
                result.success("Mark Read - Success Response")
            else:
                result.failure("Mark Read - Success", "success field not true")
            
            # Verify markedCount field
            if "markedCount" in mark_read_data:
                result.success("Mark Read - markedCount Field Present")
            else:
                result.failure("Mark Read - markedCount", "markedCount field missing")
            
            # Verify readAt field
            if "readAt" in mark_read_data:
                result.success("Mark Read - readAt Field Present")
            else:
                result.failure("Mark Read - readAt", "readAt field missing")
            
            result.success("Mark Read Endpoint")
        else:
            result.failure("Mark Read Endpoint", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        result.failure("Mark Read Endpoint", str(e))
    
    # Step 7: Verify messages are now marked as read
    print("\n6️⃣ Verifying messages marked as read...")
    try:
        response = make_request("GET", f"/service-requests/{service_request_id}/messages", headers=provider_headers)
        
        if response.status_code == 200:
            messages_data = response.json()
            messages = messages_data.get("messages", [])
            
            if messages:
                # Check if customer messages (sent by customer, received by provider) are now marked as read
                customer_messages = [msg for msg in messages if msg.get("senderRole") == "customer"]
                
                if customer_messages:
                    latest_customer_msg = customer_messages[-1]
                    if latest_customer_msg.get("readAt") is not None:
                        result.success("Message Read Verification - readAt Set")
                    else:
                        result.failure("Message Read Verification", "readAt still null after mark-read call")
                else:
                    result.failure("Message Read Verification", "No customer messages found to verify")
                
                result.success("Message Read Verification")
            else:
                result.failure("Message Read Verification", "No messages found for verification")
        else:
            result.failure("Message Read Verification", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        result.failure("Message Read Verification", str(e))
    
    # Step 8: Test edge cases
    print("\n7️⃣ Testing edge cases...")
    
    # Test with invalid jobId (but valid ObjectId format)
    try:
        response = make_request("POST", "/messages/mark-read", {
            "jobId": "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
        }, provider_headers)
        
        if response.status_code == 404:
            result.success("Edge Case - Invalid jobId Returns 404")
        else:
            result.failure("Edge Case - Invalid jobId", f"Expected 404 but got {response.status_code}")
            
    except Exception as e:
        result.failure("Edge Case - Invalid jobId", str(e))
    
    # Test with missing jobId
    try:
        response = make_request("POST", "/messages/mark-read", {}, provider_headers)
        
        if response.status_code == 400:
            result.success("Edge Case - Missing jobId Returns 400")
        else:
            result.failure("Edge Case - Missing jobId", f"Expected 400 but got {response.status_code}")
            
    except Exception as e:
        result.failure("Edge Case - Missing jobId", str(e))
    
    return result

def main():
    """Main test execution"""
    print("🚀 Starting Backend Message Read Status Tests")
    print(f"🔗 Backend URL: {BACKEND_URL}")
    print(f"📧 Test Credentials: {CUSTOMER_EMAIL} / {PROVIDER_EMAIL}")
    
    result = test_message_read_functionality()
    
    print("\n" + "=" * 50)
    success = result.summary()
    
    if success:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()