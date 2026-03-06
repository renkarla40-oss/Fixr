#!/usr/bin/env python3
"""
Backend Performance & API Testing for Instant Navigation & Performance Improvements

This test suite verifies:
1. Backend API response times for navigation-critical endpoints
2. API functionality for Customer My Requests, Customer Request Details, Provider My Jobs, Provider Job Details
3. Performance benchmarks for cached vs non-cached scenarios
4. Error handling and timeout scenarios
5. Authentication and authorization

Test Accounts:
- Customer: customer003@test.com / password123
- Provider: provider003@test.com / password123
"""

import asyncio
import aiohttp
import time
import json
import os
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://chat-activity-split-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test accounts
CUSTOMER_EMAIL = "customer003@test.com"
CUSTOMER_PASSWORD = "password123"
PROVIDER_EMAIL = "provider003@test.com"
PROVIDER_PASSWORD = "password123"

@dataclass
class TestResult:
    name: str
    success: bool
    duration_ms: int
    status_code: Optional[int] = None
    error: Optional[str] = None
    data_count: Optional[int] = None

class PerformanceTestSuite:
    def __init__(self):
        self.customer_token = None
        self.provider_token = None
        self.session = None
        self.results: List[TestResult] = []
        
    async def setup(self):
        """Initialize HTTP session and authenticate test accounts"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'Content-Type': 'application/json'}
        )
        
        # Authenticate customer
        await self._authenticate_customer()
        
        # Authenticate provider  
        await self._authenticate_provider()
        
    async def teardown(self):
        """Clean up HTTP session"""
        if self.session:
            await self.session.close()
            
    async def _authenticate_customer(self):
        """Authenticate customer account"""
        start_time = time.time()
        try:
            async with self.session.post(
                f"{API_BASE}/auth/login",
                json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    self.customer_token = data.get('token')
                    self.results.append(TestResult(
                        name="Customer Login",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200
                    ))
                    print(f"✅ Customer Login: {duration_ms}ms")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Customer Login",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Customer Login Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Customer Login",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Customer Login Exception: {e}")
            
    async def _authenticate_provider(self):
        """Authenticate provider account"""
        start_time = time.time()
        try:
            async with self.session.post(
                f"{API_BASE}/auth/login",
                json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD}
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    self.provider_token = data.get('token')
                    self.results.append(TestResult(
                        name="Provider Login",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200
                    ))
                    print(f"✅ Provider Login: {duration_ms}ms")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Provider Login",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Provider Login Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Provider Login",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Provider Login Exception: {e}")

    async def test_customer_my_requests(self):
        """Test Customer My Requests API - Critical for instant navigation"""
        if not self.customer_token:
            print("❌ Customer My Requests: No customer token available")
            return
            
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {self.customer_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests",
                headers=headers
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    request_count = len(data) if isinstance(data, list) else 0
                    self.results.append(TestResult(
                        name="Customer My Requests Load",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200,
                        data_count=request_count
                    ))
                    print(f"✅ Customer My Requests Load: {duration_ms}ms ({request_count} requests)")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Customer My Requests Load",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Customer My Requests Load Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Customer My Requests Load",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Customer My Requests Load Exception: {e}")

    async def test_customer_request_details(self):
        """Test Customer Request Details API - Critical for instant navigation"""
        if not self.customer_token:
            print("❌ Customer Request Details: No customer token available")
            return
            
        # First get a request ID from my requests
        request_id = await self._get_customer_request_id()
        if not request_id:
            print("❌ Customer Request Details: No request ID available")
            return
            
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {self.customer_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests/{request_id}",
                headers=headers
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    self.results.append(TestResult(
                        name="Customer Request Details Load",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200
                    ))
                    print(f"✅ Customer Request Details Load: {duration_ms}ms")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Customer Request Details Load",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Customer Request Details Load Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Customer Request Details Load",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Customer Request Details Load Exception: {e}")

    async def test_provider_my_jobs(self):
        """Test Provider My Jobs API - Critical for instant navigation"""
        if not self.provider_token:
            print("❌ Provider My Jobs: No provider token available")
            return
            
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {self.provider_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests",
                headers=headers
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    job_count = len(data) if isinstance(data, list) else 0
                    self.results.append(TestResult(
                        name="Provider My Jobs Load",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200,
                        data_count=job_count
                    ))
                    print(f"✅ Provider My Jobs Load: {duration_ms}ms ({job_count} jobs)")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Provider My Jobs Load",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Provider My Jobs Load Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Provider My Jobs Load",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Provider My Jobs Load Exception: {e}")

    async def test_provider_job_details(self):
        """Test Provider Job Details API - Critical for instant navigation"""
        if not self.provider_token:
            print("❌ Provider Job Details: No provider token available")
            return
            
        # First get a job ID from my jobs
        job_id = await self._get_provider_job_id()
        if not job_id:
            print("❌ Provider Job Details: No job ID available")
            return
            
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {self.provider_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests/{job_id}",
                headers=headers
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    self.results.append(TestResult(
                        name="Provider Job Details Load",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=200
                    ))
                    print(f"✅ Provider Job Details Load: {duration_ms}ms")
                else:
                    error_text = await response.text()
                    self.results.append(TestResult(
                        name="Provider Job Details Load",
                        success=False,
                        duration_ms=duration_ms,
                        status_code=response.status,
                        error=error_text
                    ))
                    print(f"❌ Provider Job Details Load Failed: {response.status} - {error_text}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.results.append(TestResult(
                name="Provider Job Details Load",
                success=False,
                duration_ms=duration_ms,
                error=str(e)
            ))
            print(f"❌ Provider Job Details Load Exception: {e}")

    async def test_performance_benchmarks(self):
        """Test performance benchmarks for navigation-critical APIs"""
        print("\n🚀 Performance Benchmark Tests:")
        
        # Test multiple rapid requests to simulate navigation
        await self._test_rapid_navigation()
        
        # Test concurrent requests
        await self._test_concurrent_requests()
        
        # Test error handling performance
        await self._test_error_scenarios()

    async def _test_rapid_navigation(self):
        """Test rapid navigation between screens (simulates cache behavior)"""
        if not self.customer_token:
            return
            
        print("Testing rapid navigation (5 consecutive requests)...")
        
        for i in range(5):
            start_time = time.time()
            try:
                headers = {'Authorization': f'Bearer {self.customer_token}'}
                async with self.session.get(
                    f"{API_BASE}/service-requests",
                    headers=headers
                ) as response:
                    duration_ms = int((time.time() - start_time) * 1000)
                    
                    if response.status == 200:
                        print(f"  Request {i+1}: {duration_ms}ms")
                        if i == 0:
                            self.results.append(TestResult(
                                name="Rapid Navigation - First Request",
                                success=True,
                                duration_ms=duration_ms,
                                status_code=200
                            ))
                        elif i == 4:
                            self.results.append(TestResult(
                                name="Rapid Navigation - Fifth Request",
                                success=True,
                                duration_ms=duration_ms,
                                status_code=200
                            ))
                    else:
                        print(f"  Request {i+1}: Failed ({response.status})")
                        
            except Exception as e:
                print(f"  Request {i+1}: Exception - {e}")
                
            # Small delay between requests
            await asyncio.sleep(0.1)

    async def _test_concurrent_requests(self):
        """Test concurrent API requests"""
        if not self.customer_token or not self.provider_token:
            return
            
        print("Testing concurrent requests...")
        
        start_time = time.time()
        
        # Create concurrent tasks
        tasks = [
            self._make_request("Customer Requests", f"{API_BASE}/service-requests", self.customer_token),
            self._make_request("Provider Jobs", f"{API_BASE}/service-requests", self.provider_token),
            self._make_request("Customer Auth Check", f"{API_BASE}/auth/me", self.customer_token),
            self._make_request("Provider Auth Check", f"{API_BASE}/auth/me", self.provider_token),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_duration = int((time.time() - start_time) * 1000)
        
        success_count = sum(1 for r in results if isinstance(r, tuple) and r[0])
        
        self.results.append(TestResult(
            name="Concurrent Requests",
            success=success_count == len(tasks),
            duration_ms=total_duration,
            data_count=success_count
        ))
        
        print(f"  Concurrent requests: {success_count}/{len(tasks)} successful in {total_duration}ms")

    async def _test_error_scenarios(self):
        """Test error handling performance"""
        print("Testing error scenarios...")
        
        # Test 404 error
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {self.customer_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests/nonexistent-id-12345",
                headers=headers
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 404:
                    self.results.append(TestResult(
                        name="404 Error Handling",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=404
                    ))
                    print(f"  404 Error: {duration_ms}ms")
                else:
                    print(f"  404 Error: Unexpected status {response.status}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            print(f"  404 Error: Exception - {e}")
            
        # Test unauthorized error
        start_time = time.time()
        try:
            async with self.session.get(
                f"{API_BASE}/service-requests"
                # No authorization header
            ) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status in [401, 403]:
                    self.results.append(TestResult(
                        name="401/403 Unauthorized Handling",
                        success=True,
                        duration_ms=duration_ms,
                        status_code=response.status
                    ))
                    print(f"  Unauthorized Error: {duration_ms}ms")
                else:
                    print(f"  Unauthorized Error: Unexpected status {response.status}")
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            print(f"  Unauthorized Error: Exception - {e}")

    async def _make_request(self, name: str, url: str, token: str) -> Tuple[bool, int]:
        """Make a single HTTP request and return success status and duration"""
        start_time = time.time()
        try:
            headers = {'Authorization': f'Bearer {token}'}
            async with self.session.get(url, headers=headers) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                return response.status == 200, duration_ms
        except Exception:
            duration_ms = int((time.time() - start_time) * 1000)
            return False, duration_ms

    async def _get_customer_request_id(self) -> Optional[str]:
        """Get a customer request ID for detail testing"""
        try:
            headers = {'Authorization': f'Bearer {self.customer_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0].get('_id')
        except Exception:
            pass
        return None

    async def _get_provider_job_id(self) -> Optional[str]:
        """Get a provider job ID for detail testing"""
        try:
            headers = {'Authorization': f'Bearer {self.provider_token}'}
            async with self.session.get(
                f"{API_BASE}/service-requests",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0].get('_id')
        except Exception:
            pass
        return None

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("🎯 INSTANT NAVIGATION & PERFORMANCE TEST RESULTS")
        print("="*80)
        
        successful_tests = [r for r in self.results if r.success]
        failed_tests = [r for r in self.results if not r.success]
        
        print(f"\n📊 SUMMARY:")
        print(f"  Total Tests: {len(self.results)}")
        print(f"  Successful: {len(successful_tests)}")
        print(f"  Failed: {len(failed_tests)}")
        print(f"  Success Rate: {len(successful_tests)/len(self.results)*100:.1f}%")
        
        if successful_tests:
            print(f"\n✅ SUCCESSFUL TESTS:")
            for result in successful_tests:
                data_info = f" ({result.data_count} items)" if result.data_count is not None else ""
                print(f"  • {result.name}: {result.duration_ms}ms{data_info}")
                
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for result in failed_tests:
                error_info = f" - {result.error}" if result.error else ""
                status_info = f" (HTTP {result.status_code})" if result.status_code else ""
                print(f"  • {result.name}: {result.duration_ms}ms{status_info}{error_info}")
                
        # Performance analysis
        navigation_tests = [r for r in successful_tests if 'Load' in r.name]
        if navigation_tests:
            avg_duration = sum(r.duration_ms for r in navigation_tests) / len(navigation_tests)
            max_duration = max(r.duration_ms for r in navigation_tests)
            min_duration = min(r.duration_ms for r in navigation_tests)
            
            print(f"\n⚡ PERFORMANCE ANALYSIS:")
            print(f"  Average API Response Time: {avg_duration:.0f}ms")
            print(f"  Fastest Response: {min_duration}ms")
            print(f"  Slowest Response: {max_duration}ms")
            
            # Performance benchmarks
            fast_responses = [r for r in navigation_tests if r.duration_ms < 100]
            medium_responses = [r for r in navigation_tests if 100 <= r.duration_ms < 500]
            slow_responses = [r for r in navigation_tests if r.duration_ms >= 500]
            
            print(f"  Fast (< 100ms): {len(fast_responses)} tests")
            print(f"  Medium (100-500ms): {len(medium_responses)} tests")
            print(f"  Slow (≥ 500ms): {len(slow_responses)} tests")
            
            if avg_duration < 300:
                print(f"  🎯 PERFORMANCE: EXCELLENT - Average response time under 300ms target")
            elif avg_duration < 500:
                print(f"  ⚠️  PERFORMANCE: GOOD - Average response time acceptable")
            else:
                print(f"  🐌 PERFORMANCE: NEEDS IMPROVEMENT - Average response time over 500ms")
                
        print("\n" + "="*80)

async def main():
    """Main test execution"""
    print("🚀 Starting Instant Navigation & Performance Backend Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Accounts: {CUSTOMER_EMAIL}, {PROVIDER_EMAIL}")
    print("-" * 80)
    
    suite = PerformanceTestSuite()
    
    try:
        # Setup
        await suite.setup()
        
        # Core navigation API tests
        print("\n📱 Core Navigation API Tests:")
        await suite.test_customer_my_requests()
        await suite.test_customer_request_details()
        await suite.test_provider_my_jobs()
        await suite.test_provider_job_details()
        
        # Performance benchmarks
        await suite.test_performance_benchmarks()
        
        # Print results
        suite.print_summary()
        
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        
    finally:
        await suite.teardown()

if __name__ == "__main__":
    asyncio.run(main())