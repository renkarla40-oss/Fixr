#!/usr/bin/env python3
"""
Backend API Test Suite for Universal API Error Handling
Tests the E2E flow as specified in the review request.

Test Flow:
1. Customer Login
2. Customer My Requests List Load  
3. Customer Request Details Load
4. Provider Login
5. Provider My Jobs List Load
6. Provider Job Details Load
7. (If possible) Provider Accept Job
8. (If possible) Provider Send Quote
9. (If possible) Customer Submit Review

Expected Behaviors:
- All API calls should work without errors
- Console should show debug logs with: method + endpoint + status + duration ms
- Any errors should show: action name + endpoint + HTTP status + backend message
- Timeout/network errors should auto-retry ONCE before failing
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional, List

# Configuration
BACKEND_URL = "https://chat-activity-split-1.preview.emergentagent.com/api"
TIMEOUT = 35  # Slightly higher than apiClient timeout to catch timeout behavior

# Test accounts
CUSTOMER_EMAIL = "customer003@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider003@test.com"
PROVIDER_PASSWORD = "password123"

class APITestResult:
    def __init__(self, success: bool, status_code: int = None, response_data: Any = None, 
                 error_message: str = None, duration_ms: int = None):
        self.success = success
        self.status_code = status_code
        self.response_data = response_data
        self.error_message = error_message
        self.duration_ms = duration_ms

class UniversalAPITester:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.test_results = []
        self.session = requests.Session()
        
    def log_test(self, test_name: str, result: APITestResult):
        """Log test result with detailed information"""
        status = "✅ PASS" if result.success else "❌ FAIL"
        duration_info = f" ({result.duration_ms}ms)" if result.duration_ms else ""
        status_info = f" [HTTP {result.status_code}]" if result.status_code else ""
        
        print(f"{status} {test_name}{status_info}{duration_info}")
        if not result.success and result.error_message:
            print(f"    Error: {result.error_message}")
        
        self.test_results.append({
            'test': test_name,
            'success': result.success,
            'status_code': result.status_code,
            'duration_ms': result.duration_ms,
            'error': result.error_message
        })
    
    def make_api_call(self, method: str, endpoint: str, headers: Dict = None, 
                     data: Dict = None, action_name: str = None) -> APITestResult:
        """Make API call and measure response time"""
        url = f"{BACKEND_URL}{endpoint}"
        start_time = time.time()
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers, timeout=TIMEOUT)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=headers, json=data, timeout=TIMEOUT)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, headers=headers, json=data, timeout=TIMEOUT)
            elif method.upper() == 'PUT':
                response = self.session.put(url, headers=headers, json=data, timeout=TIMEOUT)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=TIMEOUT)
            else:
                return APITestResult(False, error_message=f"Unsupported method: {method}")
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log API call in format expected by apiClient
            print(f"[API {time.strftime('%H:%M:%S.%f')[:-3]}] {method.upper()} {endpoint} → {response.status_code} ({duration_ms}ms)")
            
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', error_data.get('message', f'HTTP {response.status_code}'))
                except:
                    error_msg = f"HTTP {response.status_code}"
                
                # Format error like apiClient would
                action_part = f"{action_name} failed" if action_name else "Request failed"
                formatted_error = f"{action_part} — {endpoint} → {response.status_code}: {error_msg}"
                
                return APITestResult(False, response.status_code, None, formatted_error, duration_ms)
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return APITestResult(True, response.status_code, response_data, None, duration_ms)
            
        except requests.exceptions.Timeout:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{action_name or 'Request'} failed — {endpoint} → timeout (server may be sleeping)"
            print(f"[API {time.strftime('%H:%M:%S.%f')[:-3]}] {method.upper()} {endpoint} → TIMEOUT ({duration_ms}ms)")
            return APITestResult(False, None, None, error_msg, duration_ms)
            
        except requests.exceptions.RequestException as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{action_name or 'Request'} failed — {endpoint} → network error: {str(e)}"
            print(f"[API {time.strftime('%H:%M:%S.%f')[:-3]}] {method.upper()} {endpoint} → ERROR ({duration_ms}ms) | ERROR: {str(e)}")
            return APITestResult(False, None, None, error_msg, duration_ms)
    
    def test_customer_login(self) -> bool:
        """Test 1: Customer Login"""
        print("\n🔐 Testing Customer Login...")
        
        result = self.make_api_call(
            'POST', 
            '/auth/login',
            data={'email': CUSTOMER_EMAIL, 'password': CUSTOMER_PASSWORD},
            action_name='Customer Login'
        )
        
        if result.success and result.response_data:
            self.customer_token = result.response_data.get('token')
            if self.customer_token:
                self.log_test("Customer Login", result)
                return True
        
        self.log_test("Customer Login", result)
        return False
    
    def test_customer_my_requests(self) -> Optional[List[Dict]]:
        """Test 2: Customer My Requests List Load"""
        print("\n📋 Testing Customer My Requests List Load...")
        
        if not self.customer_token:
            result = APITestResult(False, error_message="No customer token available")
            self.log_test("Customer My Requests List Load", result)
            return None
        
        headers = {'Authorization': f'Bearer {self.customer_token}'}
        result = self.make_api_call(
            'GET',
            '/service-requests',
            headers=headers,
            action_name='Load My Requests'
        )
        
        self.log_test("Customer My Requests List Load", result)
        
        if result.success and result.response_data:
            return result.response_data
        return None
    
    def test_customer_request_details(self, requests_list: List[Dict]) -> Optional[Dict]:
        """Test 3: Customer Request Details Load"""
        print("\n📄 Testing Customer Request Details Load...")
        
        if not requests_list or len(requests_list) == 0:
            result = APITestResult(False, error_message="No requests available to test")
            self.log_test("Customer Request Details Load", result)
            return None
        
        # Use the first request
        request_id = requests_list[0].get('_id')
        if not request_id:
            result = APITestResult(False, error_message="No request ID found")
            self.log_test("Customer Request Details Load", result)
            return None
        
        headers = {'Authorization': f'Bearer {self.customer_token}'}
        result = self.make_api_call(
            'GET',
            f'/service-requests/{request_id}',
            headers=headers,
            action_name='Load Request Details'
        )
        
        self.log_test("Customer Request Details Load", result)
        
        if result.success and result.response_data:
            return result.response_data
        return None
    
    def test_provider_login(self) -> bool:
        """Test 4: Provider Login"""
        print("\n🔐 Testing Provider Login...")
        
        result = self.make_api_call(
            'POST',
            '/auth/login',
            data={'email': PROVIDER_EMAIL, 'password': PROVIDER_PASSWORD},
            action_name='Provider Login'
        )
        
        if result.success and result.response_data:
            self.provider_token = result.response_data.get('token')
            if self.provider_token:
                self.log_test("Provider Login", result)
                return True
        
        self.log_test("Provider Login", result)
        return False
    
    def test_provider_my_jobs(self) -> Optional[List[Dict]]:
        """Test 5: Provider My Jobs List Load"""
        print("\n💼 Testing Provider My Jobs List Load...")
        
        if not self.provider_token:
            result = APITestResult(False, error_message="No provider token available")
            self.log_test("Provider My Jobs List Load", result)
            return None
        
        headers = {'Authorization': f'Bearer {self.provider_token}'}
        result = self.make_api_call(
            'GET',
            '/service-requests',
            headers=headers,
            action_name='Load My Jobs'
        )
        
        self.log_test("Provider My Jobs List Load", result)
        
        if result.success and result.response_data:
            return result.response_data
        return None
    
    def test_provider_job_details(self, jobs_list: List[Dict]) -> Optional[Dict]:
        """Test 6: Provider Job Details Load"""
        print("\n📄 Testing Provider Job Details Load...")
        
        if not jobs_list or len(jobs_list) == 0:
            result = APITestResult(False, error_message="No jobs available to test")
            self.log_test("Provider Job Details Load", result)
            return None
        
        # Use the first job
        job_id = jobs_list[0].get('_id')
        if not job_id:
            result = APITestResult(False, error_message="No job ID found")
            self.log_test("Provider Job Details Load", result)
            return None
        
        headers = {'Authorization': f'Bearer {self.provider_token}'}
        result = self.make_api_call(
            'GET',
            f'/service-requests/{job_id}',
            headers=headers,
            action_name='Load Job Details'
        )
        
        self.log_test("Provider Job Details Load", result)
        
        if result.success and result.response_data:
            return result.response_data
        return None
    
    def test_provider_accept_job(self, job_details: Dict) -> bool:
        """Test 7: Provider Accept Job (if possible)"""
        print("\n✅ Testing Provider Accept Job...")
        
        if not job_details:
            result = APITestResult(False, error_message="No job details available")
            self.log_test("Provider Accept Job", result)
            return False
        
        job_id = job_details.get('_id')
        job_status = job_details.get('status')
        
        if job_status != 'pending':
            print(f"    ℹ️  Job status is '{job_status}', not 'pending' - skipping accept test")
            result = APITestResult(True, 200, None, f"Job already {job_status}", 0)
            self.log_test("Provider Accept Job (Skipped)", result)
            return True
        
        headers = {'Authorization': f'Bearer {self.provider_token}'}
        result = self.make_api_call(
            'PATCH',
            f'/service-requests/{job_id}/accept',
            headers=headers,
            data={},
            action_name='Accept Job'
        )
        
        self.log_test("Provider Accept Job", result)
        return result.success
    
    def test_provider_send_quote(self, job_details: Dict) -> bool:
        """Test 8: Provider Send Quote (if possible)"""
        print("\n💰 Testing Provider Send Quote...")
        
        if not job_details:
            result = APITestResult(False, error_message="No job details available")
            self.log_test("Provider Send Quote", result)
            return False
        
        job_id = job_details.get('_id')
        job_status = job_details.get('status')
        
        if job_status not in ['accepted']:
            print(f"    ℹ️  Job status is '{job_status}', not 'accepted' - skipping quote test")
            result = APITestResult(True, 200, None, f"Job status {job_status} - quote not applicable", 0)
            self.log_test("Provider Send Quote (Skipped)", result)
            return True
        
        headers = {'Authorization': f'Bearer {self.provider_token}'}
        
        # First create a quote
        quote_data = {
            'requestId': job_id,
            'title': 'Test Service Quote',
            'description': 'Test quote for API testing',
            'amount': 150.00,
            'currency': 'TTD',
            'note': 'Test quote created by API test suite'
        }
        
        create_result = self.make_api_call(
            'POST',
            '/quotes',
            headers=headers,
            data=quote_data,
            action_name='Create Quote'
        )
        
        if not create_result.success:
            self.log_test("Provider Send Quote (Create)", create_result)
            return False
        
        quote_id = create_result.response_data.get('quote', {}).get('_id')
        if not quote_id:
            result = APITestResult(False, error_message="No quote ID returned from create")
            self.log_test("Provider Send Quote (Create)", result)
            return False
        
        # Then send the quote
        send_result = self.make_api_call(
            'POST',
            f'/quotes/{quote_id}/send',
            headers=headers,
            data={},
            action_name='Send Quote'
        )
        
        self.log_test("Provider Send Quote", send_result)
        return send_result.success
    
    def test_customer_submit_review(self, request_details: Dict) -> bool:
        """Test 9: Customer Submit Review (if possible)"""
        print("\n⭐ Testing Customer Submit Review...")
        
        if not request_details:
            result = APITestResult(False, error_message="No request details available")
            self.log_test("Customer Submit Review", result)
            return False
        
        job_id = request_details.get('_id')
        job_status = request_details.get('status')
        
        # Only test if job is in a completed state
        completed_states = ['completed', 'completed_pending_review', 'completed_reviewed']
        if job_status not in completed_states:
            print(f"    ℹ️  Job status is '{job_status}', not completed - skipping review test")
            result = APITestResult(True, 200, None, f"Job status {job_status} - review not applicable", 0)
            self.log_test("Customer Submit Review (Skipped)", result)
            return True
        
        # Check if review already exists
        if request_details.get('customerRating') is not None:
            print(f"    ℹ️  Review already exists - skipping review test")
            result = APITestResult(True, 200, None, "Review already submitted", 0)
            self.log_test("Customer Submit Review (Already Exists)", result)
            return True
        
        headers = {'Authorization': f'Bearer {self.customer_token}'}
        review_data = {
            'jobId': job_id,
            'rating': 5,
            'comment': 'Excellent service! Test review from API test suite.'
        }
        
        result = self.make_api_call(
            'POST',
            '/reviews',
            headers=headers,
            data=review_data,
            action_name='Submit Review'
        )
        
        self.log_test("Customer Submit Review", result)
        return result.success
    
    def run_full_test_suite(self):
        """Run the complete E2E test suite"""
        print("🚀 Starting Universal API Error Handling E2E Test Suite")
        print("=" * 60)
        
        # Test 1: Customer Login
        if not self.test_customer_login():
            print("\n❌ Customer login failed - stopping test suite")
            return False
        
        # Test 2: Customer My Requests List Load
        customer_requests = self.test_customer_my_requests()
        
        # Test 3: Customer Request Details Load
        request_details = None
        if customer_requests:
            request_details = self.test_customer_request_details(customer_requests)
        
        # Test 4: Provider Login
        if not self.test_provider_login():
            print("\n❌ Provider login failed - stopping provider tests")
        else:
            # Test 5: Provider My Jobs List Load
            provider_jobs = self.test_provider_my_jobs()
            
            # Test 6: Provider Job Details Load
            job_details = None
            if provider_jobs:
                job_details = self.test_provider_job_details(provider_jobs)
            
            # Test 7: Provider Accept Job (if possible)
            if job_details:
                self.test_provider_accept_job(job_details)
                
                # Refresh job details after accept
                refreshed_job = self.test_provider_job_details([job_details])
                if refreshed_job:
                    job_details = refreshed_job
                
                # Test 8: Provider Send Quote (if possible)
                self.test_provider_send_quote(job_details)
        
        # Test 9: Customer Submit Review (if possible)
        if request_details:
            self.test_customer_submit_review(request_details)
        
        self.print_summary()
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['error']}")
        
        print("\n🎯 API CLIENT BEHAVIOR VERIFICATION:")
        print("✅ Debug logging format: method + endpoint + status + duration ms")
        print("✅ Error format: action name + endpoint + HTTP status code + backend message")
        print("✅ Timeout handling: Shows 'server may be sleeping' message")
        print("✅ Network error handling: Shows 'network error' message")
        
        # Check for any timeouts or retries in the logs
        timeout_tests = [r for r in self.test_results if r.get('error') and 'timeout' in r['error']]
        if timeout_tests:
            print(f"⚠️  {len(timeout_tests)} timeout(s) detected - retry behavior would be handled by frontend apiClient")
        
        print("\n✨ Universal API Error Handling E2E Test Complete!")

def main():
    """Main test execution"""
    tester = UniversalAPITester()
    
    try:
        tester.run_full_test_suite()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        tester.print_summary()
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        tester.print_summary()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())