#!/usr/bin/env python3
"""
Backend Testing for Fixr App - Phase 5: Complete Booking Lifecycle
Tests the complete service request status flow and transitions.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://fixr-notify-fix.preview.emergentagent.com/api"

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider@test.com"
PROVIDER_PASSWORD = "password123"

class BookingLifecycleTest:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.customer_id = None
        self.provider_id = None
        self.test_request_id = None
        self.job_code = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        
    def authenticate_customer(self):
        """Authenticate customer and get token"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.customer_token = data["token"]
                self.customer_id = data["user"]["_id"]
                self.log(f"✅ Customer authentication successful - ID: {self.customer_id}")
                return True
            else:
                self.log(f"❌ Customer authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Customer authentication error: {str(e)}", "ERROR")
            return False
            
    def authenticate_provider(self):
        """Authenticate provider and get token"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": PROVIDER_EMAIL,
                "password": PROVIDER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.provider_token = data["token"]
                provider_user_id = data["user"]["_id"]
                
                # Get provider profile to get provider ID
                headers = {"Authorization": f"Bearer {self.provider_token}"}
                profile_response = self.session.get(f"{BACKEND_URL}/providers/me/profile", headers=headers)
                
                if profile_response.status_code == 200:
                    provider_data = profile_response.json()
                    self.provider_id = provider_data["_id"]
                    self.log(f"✅ Provider authentication successful - ID: {self.provider_id}")
                    return True
                else:
                    self.log(f"❌ Failed to get provider profile: {profile_response.status_code}", "ERROR")
                    return False
            else:
                self.log(f"❌ Provider authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Provider authentication error: {str(e)}", "ERROR")
            return False
            
    def create_service_request(self):
        """Test 1: Create a new service request (should be pending)"""
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            
            request_data = {
                "service": "plumbing",
                "description": "Kitchen sink is leaking and needs repair",
                "preferredDateTime": "2024-01-15T10:00:00Z",
                "jobTown": "Port of Spain",
                "searchDistanceKm": 16,
                "jobDuration": "1-2 hours"
            }
            
            # Add provider ID to make it a direct request
            response = self.session.post(
                f"{BACKEND_URL}/service-requests?provider_id={self.provider_id}", 
                json=request_data, 
                headers=headers
            )
            
            if response.status_code == 201:
                data = response.json()
                self.test_request_id = data.get("id") or data.get("_id")
                status = data.get("status")
                
                if status == "pending":
                    self.log(f"✅ TEST 1 PASSED: Service request created with status 'pending' - ID: {self.test_request_id}")
                    return True
                else:
                    self.log(f"❌ TEST 1 FAILED: Expected status 'pending', got '{status}'", "ERROR")
                    return False
            else:
                self.log(f"❌ TEST 1 FAILED: Request creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 1 ERROR: {str(e)}", "ERROR")
            return False
            
    def provider_accepts_request(self):
        """Test 2: Provider accepts request (pending → accepted)"""
        try:
            headers = {"Authorization": f"Bearer {self.provider_token}"}
            
            response = self.session.patch(
                f"{BACKEND_URL}/service-requests/{self.test_request_id}/accept",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("success")
                self.job_code = data.get("jobCode")
                
                if success and self.job_code:
                    self.log(f"✅ TEST 2 PASSED: Provider accepted request, job code generated: {self.job_code}")
                    
                    # Verify status changed to accepted
                    detail_response = self.session.get(
                        f"{BACKEND_URL}/service-requests/{self.test_request_id}",
                        headers=headers
                    )
                    
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        if detail_data.get("status") == "accepted":
                            self.log("✅ Status correctly updated to 'accepted'")
                            return True
                        else:
                            self.log(f"❌ Status not updated correctly: {detail_data.get('status')}", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Failed to verify status: {detail_response.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ TEST 2 FAILED: Missing success or job code in response", "ERROR")
                    return False
            else:
                self.log(f"❌ TEST 2 FAILED: Accept request failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 2 ERROR: {str(e)}", "ERROR")
            return False
            
    def provider_enters_job_code(self):
        """Test 3: Provider enters job code (accepted → in_progress)"""
        try:
            headers = {"Authorization": f"Bearer {self.provider_token}"}
            
            response = self.session.post(
                f"{BACKEND_URL}/service-requests/{self.test_request_id}/confirm-arrival",
                json={"jobCode": self.job_code},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("success")
                
                if success:
                    self.log("✅ TEST 3 PASSED: Job code confirmed, job started")
                    
                    # Verify status changed to in_progress
                    detail_response = self.session.get(
                        f"{BACKEND_URL}/service-requests/{self.test_request_id}",
                        headers=headers
                    )
                    
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        if detail_data.get("status") == "in_progress":
                            self.log("✅ Status correctly updated to 'in_progress'")
                            return True
                        else:
                            self.log(f"❌ Status not updated correctly: {detail_data.get('status')}", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Failed to verify status: {detail_response.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ TEST 3 FAILED: Job code confirmation failed", "ERROR")
                    return False
            else:
                self.log(f"❌ TEST 3 FAILED: Confirm arrival failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 3 ERROR: {str(e)}", "ERROR")
            return False
            
    def provider_completes_job(self):
        """Test 4: Provider completes job (in_progress → completed)"""
        try:
            headers = {"Authorization": f"Bearer {self.provider_token}"}
            
            response = self.session.patch(
                f"{BACKEND_URL}/service-requests/{self.test_request_id}/complete",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("success")
                
                if success:
                    self.log("✅ TEST 4 PASSED: Job completed successfully")
                    
                    # Verify status changed to completed
                    detail_response = self.session.get(
                        f"{BACKEND_URL}/service-requests/{self.test_request_id}",
                        headers=headers
                    )
                    
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        if detail_data.get("status") == "completed":
                            self.log("✅ Status correctly updated to 'completed'")
                            return True
                        else:
                            self.log(f"❌ Status not updated correctly: {detail_data.get('status')}", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Failed to verify status: {detail_response.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ TEST 4 FAILED: Job completion failed", "ERROR")
                    return False
            else:
                self.log(f"❌ TEST 4 FAILED: Complete job failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 4 ERROR: {str(e)}", "ERROR")
            return False
            
    def test_invalid_transitions(self):
        """Test 5: Test invalid transitions (should be blocked)"""
        try:
            headers = {"Authorization": f"Bearer {self.provider_token}"}
            customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
            test_results = []
            
            # Test 5a: Try to accept a completed request (should fail)
            response = self.session.patch(
                f"{BACKEND_URL}/service-requests/{self.test_request_id}/accept",
                headers=headers
            )
            
            if response.status_code == 400:
                self.log("✅ TEST 5a PASSED: Cannot accept completed request (correctly blocked)")
                test_results.append(True)
            else:
                self.log(f"❌ TEST 5a FAILED: Should not be able to accept completed request: {response.status_code}", "ERROR")
                test_results.append(False)
                
            # Create a new request for remaining invalid transition tests
            new_request_data = {
                "service": "electrical",
                "description": "Test request for invalid transitions",
                "jobTown": "San Juan"
            }
            
            new_request_response = self.session.post(
                f"{BACKEND_URL}/service-requests?provider_id={self.provider_id}",
                json=new_request_data,
                headers=customer_headers
            )
            
            if new_request_response.status_code == 201:
                new_request_id = new_request_response.json().get("id") or new_request_response.json().get("_id")
                
                # Test 5b: Try to start a pending request without accepting (should fail)
                response = self.session.post(
                    f"{BACKEND_URL}/service-requests/{new_request_id}/confirm-arrival",
                    json={"jobCode": "123456"},
                    headers=headers
                )
                
                if response.status_code == 400:
                    self.log("✅ TEST 5b PASSED: Cannot start pending request without accepting (correctly blocked)")
                    test_results.append(True)
                else:
                    self.log(f"❌ TEST 5b FAILED: Should not be able to start pending request: {response.status_code}", "ERROR")
                    test_results.append(False)
                    
                # Test 5c: Try to complete a pending request (should fail)
                response = self.session.patch(
                    f"{BACKEND_URL}/service-requests/{new_request_id}/complete",
                    headers=headers
                )
                
                if response.status_code == 400:
                    self.log("✅ TEST 5c PASSED: Cannot complete pending request (correctly blocked)")
                    test_results.append(True)
                else:
                    self.log(f"❌ TEST 5c FAILED: Should not be able to complete pending request: {response.status_code}", "ERROR")
                    test_results.append(False)
                    
            # Test 5d: Try to cancel a completed request (should fail)
            response = self.session.patch(
                f"{BACKEND_URL}/service-requests/{self.test_request_id}/cancel",
                headers=customer_headers
            )
            
            if response.status_code == 400:
                self.log("✅ TEST 5d PASSED: Cannot cancel completed request (correctly blocked)")
                test_results.append(True)
            else:
                self.log(f"❌ TEST 5d FAILED: Should not be able to cancel completed request: {response.status_code}", "ERROR")
                test_results.append(False)
                
            return all(test_results)
            
        except Exception as e:
            self.log(f"❌ TEST 5 ERROR: {str(e)}", "ERROR")
            return False
            
    def test_cancel_endpoint(self):
        """Test 6: Test cancel endpoint (pending → cancelled)"""
        try:
            # Create a new request for cancellation test
            customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
            
            request_data = {
                "service": "handyman",
                "description": "Test request for cancellation",
                "jobTown": "Chaguanas"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/service-requests?provider_id={self.provider_id}",
                json=request_data,
                headers=customer_headers
            )
            
            if response.status_code == 201:
                cancel_request_id = response.json().get("id") or response.json().get("_id")
                
                # Cancel the request
                cancel_response = self.session.patch(
                    f"{BACKEND_URL}/service-requests/{cancel_request_id}/cancel",
                    headers=customer_headers
                )
                
                if cancel_response.status_code == 200:
                    # Verify status changed to cancelled
                    detail_response = self.session.get(
                        f"{BACKEND_URL}/service-requests/{cancel_request_id}",
                        headers=customer_headers
                    )
                    
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        if detail_data.get("status") == "cancelled":
                            self.log("✅ TEST 6 PASSED: Request cancelled successfully, status updated to 'cancelled'")
                            return True
                        else:
                            self.log(f"❌ TEST 6 FAILED: Status not updated to cancelled: {detail_data.get('status')}", "ERROR")
                            return False
                    else:
                        self.log(f"❌ TEST 6 FAILED: Failed to verify cancellation status: {detail_response.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ TEST 6 FAILED: Cancel request failed: {cancel_response.status_code} - {cancel_response.text}", "ERROR")
                    return False
            else:
                self.log(f"❌ TEST 6 FAILED: Failed to create request for cancellation test: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 6 ERROR: {str(e)}", "ERROR")
            return False
            
    def run_all_tests(self):
        """Run complete booking lifecycle test suite"""
        self.log("🚀 Starting Complete Booking Lifecycle Tests (Phase 5)")
        self.log("=" * 60)
        
        # Authentication
        if not self.authenticate_customer():
            return False
            
        if not self.authenticate_provider():
            return False
            
        self.log("=" * 60)
        
        # Test sequence
        tests = [
            ("Create Service Request (pending)", self.create_service_request),
            ("Provider Accepts (pending → accepted)", self.provider_accepts_request),
            ("Provider Enters Job Code (accepted → in_progress)", self.provider_enters_job_code),
            ("Provider Completes Job (in_progress → completed)", self.provider_completes_job),
            ("Test Invalid Transitions (should be blocked)", self.test_invalid_transitions),
            ("Test Cancel Endpoint (pending → cancelled)", self.test_cancel_endpoint)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n🧪 Running: {test_name}")
            if test_func():
                passed_tests += 1
            else:
                self.log(f"❌ {test_name} FAILED", "ERROR")
                
        self.log("=" * 60)
        self.log(f"📊 TEST RESULTS: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL TESTS PASSED - Complete booking lifecycle working correctly!")
            return True
        else:
            self.log(f"⚠️  {total_tests - passed_tests} tests failed - Issues found in booking lifecycle", "ERROR")
            return False

def main():
    """Main test execution"""
    tester = BookingLifecycleTest()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ PHASE 5 BOOKING LIFECYCLE: ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ PHASE 5 BOOKING LIFECYCLE: SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()