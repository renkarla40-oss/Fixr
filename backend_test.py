#!/usr/bin/env python3
"""
Backend Testing Suite for Quote Negotiation Flow
Tests the complete quote negotiation cycle as specified in the review request.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://chat-jump-fixer.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer003@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider003@test.com" 
PROVIDER_PASSWORD = "password123"

class QuoteNegotiationTester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.customer_id = None
        self.provider_id = None
        self.service_request_id = None
        self.quote_id = None
        self.test_results = []
        
    async def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    async def make_request(self, method: str, endpoint: str, token: str = None, data: dict = None) -> tuple[int, dict]:
        """Make HTTP request to backend"""
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        url = f"{BACKEND_URL}{endpoint}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, json=data)
                elif method.upper() == "PATCH":
                    response = await client.patch(url, headers=headers, json=data)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                    
                try:
                    response_data = response.json()
                except:
                    response_data = {"error": "Invalid JSON response", "text": response.text}
                    
                return response.status_code, response_data
            except Exception as e:
                return 500, {"error": str(e)}
    
    async def authenticate_customer(self) -> bool:
        """Authenticate customer and get token"""
        status_code, response = await self.make_request(
            "POST", "/auth/login",
            data={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        
        if status_code == 200 and "token" in response:
            self.customer_token = response["token"]
            self.customer_id = response["user"].get("id") or response["user"].get("_id")
            await self.log_test("Customer Authentication", True, f"Customer ID: {self.customer_id}")
            return True
        else:
            await self.log_test("Customer Authentication", False, f"Status: {status_code}", response)
            return False
    
    async def authenticate_provider(self) -> bool:
        """Authenticate provider and get token"""
        status_code, response = await self.make_request(
            "POST", "/auth/login", 
            data={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD}
        )
        
        if status_code == 200 and "token" in response:
            self.provider_token = response["token"]
            self.provider_id = response["user"].get("id") or response["user"].get("_id")
            await self.log_test("Provider Authentication", True, f"Provider ID: {self.provider_id}")
            return True
        else:
            await self.log_test("Provider Authentication", False, f"Status: {status_code}", response)
            return False
    
    async def create_service_request(self) -> bool:
        """Customer creates a service request to the provider"""
        # First get provider profile to get provider ID
        status_code, response = await self.make_request(
            "GET", f"/providers/{self.provider_id}", 
            token=self.customer_token
        )
        
        if status_code != 200:
            await self.log_test("Get Provider Profile", False, f"Status: {status_code}", response)
            return False
            
        provider_profile_id = response.get("id") or response.get("_id")
        
        # Create service request
        request_data = {
            "service": "Plumbing",
            "description": "Need to fix a leaky faucet in the kitchen. Water is dripping constantly.",
            "jobTown": "Port of Spain",
            "searchDistanceKm": 16,
            "jobDuration": "1-2 hours"
        }
        
        status_code, response = await self.make_request(
            "POST", f"/service-requests?provider_id={provider_profile_id}",
            token=self.customer_token,
            data=request_data
        )
        
        if status_code in [200, 201] and ("id" in response or "_id" in response):
            self.service_request_id = response.get("id") or response.get("_id")
            await self.log_test("Create Service Request", True, f"Request ID: {self.service_request_id}")
            return True
        else:
            await self.log_test("Create Service Request", False, f"Status: {status_code}", response)
            return False
    
    async def provider_accept_request(self) -> bool:
        """Provider accepts the service request"""
        status_code, response = await self.make_request(
            "PATCH", f"/service-requests/{self.service_request_id}/accept",
            token=self.provider_token
        )
        
        if status_code == 200 and response.get("status") == "accepted":
            job_code = response.get("jobCode")
            await self.log_test("Provider Accept Request", True, f"Status: accepted, Job Code: {job_code}")
            return True
        else:
            await self.log_test("Provider Accept Request", False, f"Status: {status_code}", response)
            return False
    
    async def create_and_send_quote(self, amount: float = 200.0, note: str = "Initial quote for plumbing repair") -> bool:
        """Provider creates and sends a quote"""
        # Create quote
        quote_data = {
            "requestId": self.service_request_id,
            "title": "Plumbing Repair Quote",
            "amount": amount,
            "note": note,
            "currency": "TTD"
        }
        
        status_code, response = await self.make_request(
            "POST", "/quotes",
            token=self.provider_token,
            data=quote_data
        )
        
        if status_code != 200 or not response.get("success"):
            await self.log_test("Create Quote", False, f"Status: {status_code}", response)
            return False
            
        self.quote_id = response["quote"]["_id"]
        await self.log_test("Create Quote", True, f"Quote ID: {self.quote_id}, Amount: ${amount}")
        
        # Send quote
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/send",
            token=self.provider_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            revision = response["quote"]["revision"]
            await self.log_test("Send Quote", True, f"Status: {quote_status}, Revision: {revision}")
            return True
        else:
            await self.log_test("Send Quote", False, f"Status: {status_code}", response)
            return False
    
    async def customer_reject_quote(self) -> bool:
        """Customer rejects the quote"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/reject",
            token=self.customer_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            await self.log_test("Customer Reject Quote", True, f"Status: {quote_status}")
            return True
        else:
            await self.log_test("Customer Reject Quote", False, f"Status: {status_code}", response)
            return False
    
    async def test_reject_idempotency(self) -> bool:
        """Test that rejecting an already rejected quote returns success"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/reject",
            token=self.customer_token
        )
        
        if status_code == 200 and response.get("errorCode") == "ALREADY_REJECTED":
            await self.log_test("Reject Idempotency", True, "Already rejected quote handled correctly")
            return True
        else:
            await self.log_test("Reject Idempotency", False, f"Status: {status_code}", response)
            return False
    
    async def provider_revise_and_resend(self, new_amount: float = 150.0, new_note: str = "Revised price after rejection") -> bool:
        """Provider revises and resends quote after rejection"""
        # Revise quote
        status_code, response = await self.make_request(
            "PATCH", f"/quotes/{self.quote_id}/revise",
            token=self.provider_token,
            data={"amount": new_amount, "note": new_note}
        )
        
        if status_code != 200 or not response.get("success"):
            await self.log_test("Revise Quote After Rejection", False, f"Status: {status_code}", response)
            return False
            
        await self.log_test("Revise Quote After Rejection", True, f"New Amount: ${new_amount}")
        
        # Resend quote
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/send",
            token=self.provider_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            revision = response["quote"]["revision"]
            await self.log_test("Resend Quote After Revision", True, f"Status: {quote_status}, Revision: {revision}")
            return True
        else:
            await self.log_test("Resend Quote After Revision", False, f"Status: {status_code}", response)
            return False
    
    async def customer_counter_quote(self, counter_amount: float = 100.0, counter_note: str = "My budget is $100") -> bool:
        """Customer counters the quote"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/counter",
            token=self.customer_token,
            data={"counterAmount": counter_amount, "counterNote": counter_note}
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            counter_amt = response["quote"]["counterAmount"]
            await self.log_test("Customer Counter Quote", True, f"Status: {quote_status}, Counter: ${counter_amt}")
            return True
        else:
            await self.log_test("Customer Counter Quote", False, f"Status: {status_code}", response)
            return False
    
    async def test_counter_idempotency(self) -> bool:
        """Test that countering with same amount returns success"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/counter",
            token=self.customer_token,
            data={"counterAmount": 100.0, "counterNote": "Same counter"}
        )
        
        if status_code == 200 and response.get("errorCode") == "ALREADY_COUNTERED":
            await self.log_test("Counter Idempotency", True, "Already countered with same amount handled correctly")
            return True
        else:
            await self.log_test("Counter Idempotency", False, f"Status: {status_code}", response)
            return False
    
    async def provider_revise_to_match_counter(self, match_amount: float = 100.0) -> bool:
        """Provider revises quote to match customer's counter"""
        # Revise to match counter
        status_code, response = await self.make_request(
            "PATCH", f"/quotes/{self.quote_id}/revise",
            token=self.provider_token,
            data={"amount": match_amount, "note": "Accepting your counter offer"}
        )
        
        if status_code != 200 or not response.get("success"):
            await self.log_test("Revise to Match Counter", False, f"Status: {status_code}", response)
            return False
            
        await self.log_test("Revise to Match Counter", True, f"Amount: ${match_amount}")
        
        # Resend quote
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/send",
            token=self.provider_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            revision = response["quote"]["revision"]
            counter_amount = response["quote"].get("counterAmount")
            await self.log_test("Resend After Counter Match", True, 
                              f"Status: {quote_status}, Revision: {revision}, Counter cleared: {counter_amount is None}")
            return True
        else:
            await self.log_test("Resend After Counter Match", False, f"Status: {status_code}", response)
            return False
    
    async def customer_accept_quote(self) -> bool:
        """Customer accepts the final quote"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/accept",
            token=self.customer_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            await self.log_test("Customer Accept Quote", True, f"Status: {quote_status}")
            return True
        else:
            await self.log_test("Customer Accept Quote", False, f"Status: {status_code}", response)
            return False
    
    async def customer_pay_quote(self) -> bool:
        """Customer pays the quote (sandbox)"""
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/sandbox-pay",
            token=self.customer_token
        )
        
        if status_code == 200 and response.get("success"):
            quote_status = response["quote"]["status"]
            await self.log_test("Customer Pay Quote", True, f"Status: {quote_status}")
            return True
        else:
            await self.log_test("Customer Pay Quote", False, f"Status: {status_code}", response)
            return False
    
    async def test_authorization_enforcement(self) -> bool:
        """Test that authorization is properly enforced"""
        tests_passed = 0
        total_tests = 2
        
        # Test 1: Customer tries to send quote (should fail)
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/send",
            token=self.customer_token
        )
        
        if status_code == 403:
            await self.log_test("Customer Cannot Send Quote", True, "403 Forbidden as expected")
            tests_passed += 1
        else:
            await self.log_test("Customer Cannot Send Quote", False, f"Expected 403, got {status_code}", response)
        
        # Test 2: Provider tries to reject quote (should fail)
        status_code, response = await self.make_request(
            "POST", f"/quotes/{self.quote_id}/reject",
            token=self.provider_token
        )
        
        if status_code == 403:
            await self.log_test("Provider Cannot Reject Quote", True, "403 Forbidden as expected")
            tests_passed += 1
        else:
            await self.log_test("Provider Cannot Reject Quote", False, f"Expected 403, got {status_code}", response)
        
        return tests_passed == total_tests
    
    async def test_validation_rules(self) -> bool:
        """Test validation rules for quote creation and countering"""
        tests_passed = 0
        total_tests = 3
        
        # Test 1: Create quote with amount=0 (should fail)
        quote_data = {
            "requestId": self.service_request_id,
            "title": "Invalid Quote",
            "amount": 0,
            "note": "Zero amount test"
        }
        
        status_code, response = await self.make_request(
            "POST", "/quotes",
            token=self.provider_token,
            data=quote_data
        )
        
        if status_code == 400:
            await self.log_test("Quote Amount=0 Validation", True, "400 Bad Request as expected")
            tests_passed += 1
        else:
            await self.log_test("Quote Amount=0 Validation", False, f"Expected 400, got {status_code}", response)
        
        # Test 2: Create quote with negative amount (should fail)
        quote_data["amount"] = -50
        
        status_code, response = await self.make_request(
            "POST", "/quotes",
            token=self.provider_token,
            data=quote_data
        )
        
        if status_code == 400:
            await self.log_test("Quote Negative Amount Validation", True, "400 Bad Request as expected")
            tests_passed += 1
        else:
            await self.log_test("Quote Negative Amount Validation", False, f"Expected 400, got {status_code}", response)
        
        # Test 3: Counter with amount=0 (should fail)
        # First create a valid quote to counter
        valid_quote_data = {
            "requestId": self.service_request_id,
            "title": "Valid Quote for Counter Test",
            "amount": 50,
            "note": "For counter validation test"
        }
        
        status_code, response = await self.make_request(
            "POST", "/quotes",
            token=self.provider_token,
            data=valid_quote_data
        )
        
        if status_code == 200:
            test_quote_id = response["quote"]["_id"]
            
            # Send the quote
            await self.make_request("POST", f"/quotes/{test_quote_id}/send", token=self.provider_token)
            
            # Try to counter with 0 amount
            status_code, response = await self.make_request(
                "POST", f"/quotes/{test_quote_id}/counter",
                token=self.customer_token,
                data={"counterAmount": 0, "counterNote": "Zero counter test"}
            )
            
            if status_code == 400:
                await self.log_test("Counter Amount=0 Validation", True, "400 Bad Request as expected")
                tests_passed += 1
            else:
                await self.log_test("Counter Amount=0 Validation", False, f"Expected 400, got {status_code}", response)
        
        return tests_passed == total_tests
    
    async def run_complete_test_suite(self):
        """Run the complete quote negotiation test suite"""
        print("🚀 Starting Quote Negotiation Backend Test Suite")
        print("=" * 60)
        
        # Authentication
        if not await self.authenticate_customer():
            return False
        if not await self.authenticate_provider():
            return False
        
        print("\n📋 STEP 1: Setup - Create Service Request")
        if not await self.create_service_request():
            return False
        if not await self.provider_accept_request():
            return False
        
        print("\n💰 STEP 2: Provider Creates and Sends Quote")
        if not await self.create_and_send_quote():
            return False
        
        print("\n❌ STEP 3: Customer Rejects Quote")
        if not await self.customer_reject_quote():
            return False
        if not await self.test_reject_idempotency():
            return False
        
        print("\n🔄 STEP 4: Provider Revises and Resends After Rejection")
        if not await self.provider_revise_and_resend():
            return False
        
        print("\n💬 STEP 5: Customer Counters Quote")
        if not await self.customer_counter_quote():
            return False
        if not await self.test_counter_idempotency():
            return False
        
        print("\n🤝 STEP 6: Provider Revises to Match Counter and Resends")
        if not await self.provider_revise_to_match_counter():
            return False
        
        print("\n✅ STEP 7: Customer Accepts and Pays")
        if not await self.customer_accept_quote():
            return False
        if not await self.customer_pay_quote():
            return False
        
        print("\n🔒 STEP 8: Authorization Enforcement Tests")
        await self.test_authorization_enforcement()
        
        print("\n✔️ STEP 9: Validation Rules Tests")
        await self.test_validation_rules()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Quote negotiation flow is working correctly.")
        else:
            print(f"\n⚠️  {total - passed} tests failed. See details above.")
            
        return passed == total

async def main():
    """Main test runner"""
    tester = QuoteNegotiationTester()
    success = await tester.run_complete_test_suite()
    
    if success:
        print("\n✅ Quote Negotiation Backend: FULLY FUNCTIONAL")
    else:
        print("\n❌ Quote Negotiation Backend: ISSUES FOUND")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())