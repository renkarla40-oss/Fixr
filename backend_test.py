#!/usr/bin/env python3
"""
Backend Testing for Post-Payment Workflow Fix
Tests the critical fix where confirm-arrival endpoint now accepts both 'accepted' AND 'paid' statuses
"""

import asyncio
import httpx
import json
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://browse-services.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
    
    def add_test(self, name, passed, details=""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
        if details:
            print(f"   Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")
        return self.failed == 0

async def login_user(email, password):
    """Login and return auth token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_BASE}/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data["token"], data["user"]
        else:
            raise Exception(f"Login failed: {response.status_code} - {response.text}")

async def get_auth_headers(token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {token}"}

async def test_post_payment_workflow():
    """Test the complete post-payment workflow fix"""
    results = TestResults()
    
    try:
        print("🔧 Testing Post-Payment Workflow Fix for Quote Feature")
        print("=" * 60)
        
        # Step 1: Login as provider
        print("\n📋 Step 1: Provider Authentication")
        try:
            provider_token, provider_user = await login_user(PROVIDER_EMAIL, PROVIDER_PASSWORD)
            provider_user_id = provider_user.get('id') or provider_user.get('_id')
            results.add_test("Provider Login", True, f"Provider ID: {provider_user_id}")
        except Exception as e:
            results.add_test("Provider Login", False, str(e))
            return results
        
        # Step 2: Login as customer  
        print("\n📋 Step 2: Customer Authentication")
        try:
            customer_token, customer_user = await login_user(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
            customer_user_id = customer_user.get('id') or customer_user.get('_id')
            results.add_test("Customer Login", True, f"Customer ID: {customer_user_id}")
        except Exception as e:
            results.add_test("Customer Login", False, str(e))
            return results
        
        # Step 3: Get provider profile
        print("\n📋 Step 3: Get Provider Profile")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/providers/me/profile",
                headers=await get_auth_headers(provider_token)
            )
            if response.status_code == 200:
                provider_profile = response.json()
                provider_id = provider_profile.get("id") or provider_profile.get("_id")
                results.add_test("Get Provider Profile", True, f"Provider ID: {provider_id}")
            else:
                results.add_test("Get Provider Profile", False, f"Status: {response.status_code}")
                return results
        
        # Step 4: Create test service request
        print("\n📋 Step 4: Create Service Request")
        async with httpx.AsyncClient() as client:
            request_data = {
                "service": "Plumbing",
                "description": "Test plumbing service for post-payment workflow testing",
                "preferredDateTime": datetime.now().isoformat(),
                "jobTown": "Port of Spain",
                "searchDistanceKm": 20,
                "jobDuration": "1-2 hours"
            }
            
            response = await client.post(
                f"{API_BASE}/service-requests?provider_id={provider_id}",
                headers=await get_auth_headers(customer_token),
                json=request_data
            )
            
            if response.status_code == 200:
                request_response = response.json()
                request_id = request_response.get("id") or request_response.get("_id")
                results.add_test("Create Service Request", True, f"Request ID: {request_id}")
            else:
                results.add_test("Create Service Request", False, f"Status: {response.status_code} - {response.text}")
                return results
        
        # Step 5: Provider accepts request
        print("\n📋 Step 5: Provider Accepts Request")
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{API_BASE}/service-requests/{request_id}/accept",
                headers=await get_auth_headers(provider_token)
            )
            
            if response.status_code == 200:
                accept_response = response.json()
                job_code = accept_response["jobCode"]
                results.add_test("Provider Accept Request", True, f"Job Code: {job_code}")
            else:
                results.add_test("Provider Accept Request", False, f"Status: {response.status_code} - {response.text}")
                return results
        
        # Step 6: Verify request status is "accepted"
        print("\n📋 Step 6: Verify Request Status = 'accepted'")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                request_detail = response.json()
                status = request_detail["status"]
                if status == "accepted":
                    results.add_test("Request Status = 'accepted'", True, f"Status: {status}")
                else:
                    results.add_test("Request Status = 'accepted'", False, f"Expected 'accepted', got '{status}'")
            else:
                results.add_test("Request Status = 'accepted'", False, f"Status: {response.status_code}")
        
        # Step 7: Create and send quote
        print("\n📋 Step 7: Create and Send Quote")
        async with httpx.AsyncClient() as client:
            # Create quote
            quote_data = {
                "requestId": request_id,
                "title": "Plumbing Service Quote",
                "description": "Professional plumbing service including parts and labor",
                "amount": 250.00,
                "currency": "TTD"
            }
            
            response = await client.post(
                f"{API_BASE}/quotes",
                headers=await get_auth_headers(provider_token),
                json=quote_data
            )
            
            if response.status_code == 200:
                quote_response = response.json()
                quote_id = quote_response["quote"]["_id"]
                results.add_test("Create Quote", True, f"Quote ID: {quote_id}")
                
                # Send quote
                response = await client.post(
                    f"{API_BASE}/quotes/{quote_id}/send",
                    headers=await get_auth_headers(provider_token)
                )
                
                if response.status_code == 200:
                    results.add_test("Send Quote", True, "Quote sent to customer")
                else:
                    results.add_test("Send Quote", False, f"Status: {response.status_code} - {response.text}")
                    return results
            else:
                results.add_test("Create Quote", False, f"Status: {response.status_code} - {response.text}")
                return results
        
        # Step 8: Customer accepts quote
        print("\n📋 Step 8: Customer Accepts Quote")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/quotes/{quote_id}/accept",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                results.add_test("Customer Accept Quote", True, "Quote accepted")
            else:
                results.add_test("Customer Accept Quote", False, f"Status: {response.status_code} - {response.text}")
                return results
        
        # Step 9: Customer pays quote (sandbox payment)
        print("\n📋 Step 9: Customer Pays Quote (Sandbox)")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/quotes/{quote_id}/sandbox-pay",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                payment_response = response.json()
                results.add_test("Customer Pay Quote", True, "Sandbox payment completed")
            else:
                results.add_test("Customer Pay Quote", False, f"Status: {response.status_code} - {response.text}")
                return results
        
        # Step 10: Verify request status is now "paid"
        print("\n📋 Step 10: Verify Request Status = 'paid'")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                request_detail = response.json()
                status = request_detail["status"]
                if status == "paid":
                    results.add_test("Request Status = 'paid'", True, f"Status: {status}")
                else:
                    results.add_test("Request Status = 'paid'", False, f"Expected 'paid', got '{status}'")
                    return results
            else:
                results.add_test("Request Status = 'paid'", False, f"Status: {response.status_code}")
                return results
        
        # Step 11: CRITICAL TEST - Start job from PAID status
        print("\n📋 Step 11: 🔥 CRITICAL TEST - Start Job from PAID Status")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/service-requests/{request_id}/confirm-arrival",
                headers=await get_auth_headers(provider_token),
                json={"jobCode": job_code}
            )
            
            if response.status_code == 200:
                results.add_test("🔥 CRITICAL: Start Job from PAID Status", True, "Provider can start job from 'paid' status - FIX WORKING!")
            else:
                results.add_test("🔥 CRITICAL: Start Job from PAID Status", False, f"Status: {response.status_code} - {response.text} - FIX NOT WORKING!")
                return results
        
        # Step 12: Verify status changed to "in_progress"
        print("\n📋 Step 12: Verify Status = 'in_progress'")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                request_detail = response.json()
                status = request_detail["status"]
                if status == "in_progress":
                    results.add_test("Status = 'in_progress'", True, f"Status: {status}")
                    completion_otp = request_detail.get("completionOtp")
                    if completion_otp:
                        results.add_test("Completion OTP Generated", True, f"OTP: {completion_otp}")
                    else:
                        results.add_test("Completion OTP Generated", False, "No completion OTP found")
                else:
                    results.add_test("Status = 'in_progress'", False, f"Expected 'in_progress', got '{status}'")
            else:
                results.add_test("Status = 'in_progress'", False, f"Status: {response.status_code}")
        
        # Step 13: Complete the job
        print("\n📋 Step 13: Complete Job")
        async with httpx.AsyncClient() as client:
            # Get completion OTP from request
            response = await client.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=await get_auth_headers(provider_token)
            )
            
            if response.status_code == 200:
                request_detail = response.json()
                completion_otp = request_detail.get("completionOtp")
                
                if completion_otp:
                    # Complete the job
                    response = await client.patch(
                        f"{API_BASE}/service-requests/{request_id}/complete",
                        headers=await get_auth_headers(provider_token),
                        json={"completionOtp": completion_otp}
                    )
                    
                    if response.status_code == 200:
                        results.add_test("Complete Job", True, "Job completed successfully")
                    else:
                        results.add_test("Complete Job", False, f"Status: {response.status_code} - {response.text}")
                else:
                    results.add_test("Complete Job", False, "No completion OTP available")
            else:
                results.add_test("Complete Job", False, f"Could not get request details: {response.status_code}")
        
        # Step 14: Verify final status is "completed"
        print("\n📋 Step 14: Verify Final Status = 'completed'")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=await get_auth_headers(customer_token)
            )
            
            if response.status_code == 200:
                request_detail = response.json()
                status = request_detail["status"]
                if status == "completed":
                    results.add_test("Final Status = 'completed'", True, f"Status: {status}")
                else:
                    results.add_test("Final Status = 'completed'", False, f"Expected 'completed', got '{status}'")
            else:
                results.add_test("Final Status = 'completed'", False, f"Status: {response.status_code}")
        
        # Additional Test: Verify confirm-arrival still works from "accepted" status
        print("\n📋 Additional Test: Confirm-arrival from 'accepted' status")
        await test_confirm_arrival_from_accepted_status(results, customer_token, provider_token, provider_id)
        
        # Additional Test: Verify confirm-arrival rejects invalid statuses
        print("\n📋 Additional Test: Confirm-arrival rejects invalid statuses")
        await test_confirm_arrival_invalid_statuses(results, customer_token, provider_token, provider_id)
        
    except Exception as e:
        results.add_test("Unexpected Error", False, str(e))
    
    return results

async def test_confirm_arrival_from_accepted_status(results, customer_token, provider_token, provider_id):
    """Test that confirm-arrival still works from 'accepted' status (existing behavior)"""
    try:
        # Create new request
        async with httpx.AsyncClient() as client:
            request_data = {
                "service": "Electrical",
                "description": "Test electrical service for accepted status workflow",
                "preferredDateTime": datetime.now().isoformat(),
                "jobTown": "San Fernando",
                "searchDistanceKm": 20
            }
            
            response = await client.post(
                f"{API_BASE}/service-requests?provider_id={provider_id}",
                headers=await get_auth_headers(customer_token),
                json=request_data
            )
            
            if response.status_code == 200:
                request_id = response.json().get("id") or response.json().get("_id")
                
                # Provider accepts
                response = await client.patch(
                    f"{API_BASE}/service-requests/{request_id}/accept",
                    headers=await get_auth_headers(provider_token)
                )
                
                if response.status_code == 200:
                    job_code = response.json()["jobCode"]
                    
                    # Try to start job from 'accepted' status
                    response = await client.post(
                        f"{API_BASE}/service-requests/{request_id}/confirm-arrival",
                        headers=await get_auth_headers(provider_token),
                        json={"jobCode": job_code}
                    )
                    
                    if response.status_code == 200:
                        results.add_test("Confirm-arrival from 'accepted' status", True, "Existing behavior preserved")
                    else:
                        results.add_test("Confirm-arrival from 'accepted' status", False, f"Status: {response.status_code}")
                else:
                    results.add_test("Confirm-arrival from 'accepted' status", False, "Could not accept request")
            else:
                results.add_test("Confirm-arrival from 'accepted' status", False, "Could not create request")
    except Exception as e:
        results.add_test("Confirm-arrival from 'accepted' status", False, str(e))

async def test_confirm_arrival_invalid_statuses(results, customer_token, provider_token, provider_id):
    """Test that confirm-arrival properly rejects invalid statuses"""
    try:
        # Create new request
        async with httpx.AsyncClient() as client:
            request_data = {
                "service": "Cleaning",
                "description": "Test cleaning service for invalid status testing",
                "preferredDateTime": datetime.now().isoformat(),
                "jobTown": "Chaguanas",
                "searchDistanceKm": 20
            }
            
            response = await client.post(
                f"{API_BASE}/service-requests?provider_id={provider_id}",
                headers=await get_auth_headers(customer_token),
                json=request_data
            )
            
            if response.status_code == 200:
                request_id = response.json().get("id") or response.json().get("_id")
                
                # Try to start job from 'pending' status (should fail)
                response = await client.post(
                    f"{API_BASE}/service-requests/{request_id}/confirm-arrival",
                    headers=await get_auth_headers(provider_token),
                    json={"jobCode": "123456"}
                )
                
                if response.status_code == 400:
                    results.add_test("Reject confirm-arrival from 'pending' status", True, "Properly rejected invalid status")
                else:
                    results.add_test("Reject confirm-arrival from 'pending' status", False, f"Expected 400, got {response.status_code}")
            else:
                results.add_test("Reject confirm-arrival from 'pending' status", False, "Could not create request")
    except Exception as e:
        results.add_test("Reject confirm-arrival from 'pending' status", False, str(e))

async def main():
    """Main test runner"""
    print("🚀 Starting Post-Payment Workflow Fix Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    results = await test_post_payment_workflow()
    
    success = results.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Post-payment workflow fix is working correctly.")
    else:
        print(f"\n⚠️  {results.failed} test(s) failed. Please review the issues above.")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())