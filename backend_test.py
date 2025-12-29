#!/usr/bin/env python3
"""
Backend API Testing Script for Beta Bypass Fix (@test.com emails)

Tests the following scenarios:
1. New @test.com user signup gets beta access (isBetaUser: true)
2. Existing @test.com user login updates to beta access (retroactive)
3. Non-@test.com emails get isBetaUser: false
4. Provider onboarding flow works for @test.com users
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://fixr-services.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request and return response"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "PATCH":
            response = requests.patch(url, json=data, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"📡 {method} {endpoint}")
        print(f"   Status: {response.status_code}")
        if data:
            print(f"   Request: {json.dumps(data, indent=2)}")
        
        try:
            response_data = response.json()
            print(f"   Response: {json.dumps(response_data, indent=2, default=str)}")
        except:
            print(f"   Response: {response.text}")
        
        return response
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        return None

def test_1_new_test_email_signup():
    """Test 1: New @test.com user signup gets beta access"""
    print_test_header("TEST 1: New @test.com user signup gets beta access")
    
    signup_data = {
        "email": "newprovider2@test.com",
        "password": "testpass123",
        "name": "New Test Provider",
        "phone": "8681234567",
        "currentRole": "provider"
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if not response:
        print_result(False, "Request failed")
        return None
    
    if response.status_code == 201 or response.status_code == 200:
        try:
            data = response.json()
            user = data.get("user", {})
            is_beta_user = user.get("isBetaUser", False)
            
            if is_beta_user:
                print_result(True, f"@test.com email correctly got isBetaUser: true")
                return data.get("token")  # Return token for Test 4
            else:
                print_result(False, f"@test.com email should have isBetaUser: true, got: {is_beta_user}")
                return None
        except Exception as e:
            print_result(False, f"Failed to parse response: {str(e)}")
            return None
    else:
        print_result(False, f"Signup failed with status {response.status_code}")
        return None

def test_2_existing_test_email_login():
    """Test 2: Existing @test.com user login updates to beta access"""
    print_test_header("TEST 2: Existing @test.com user login updates to beta access")
    
    login_data = {
        "email": "provider@test.com",
        "password": "password123"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if not response:
        print_result(False, "Request failed")
        return None
    
    if response.status_code == 200:
        try:
            data = response.json()
            user = data.get("user", {})
            is_beta_user = user.get("isBetaUser", False)
            
            if is_beta_user:
                print_result(True, f"Existing @test.com user correctly updated to isBetaUser: true")
                return data.get("token")
            else:
                print_result(False, f"Existing @test.com user should have isBetaUser: true, got: {is_beta_user}")
                return None
        except Exception as e:
            print_result(False, f"Failed to parse response: {str(e)}")
            return None
    else:
        print_result(False, f"Login failed with status {response.status_code}")
        return None

def test_3_non_test_email_signup():
    """Test 3: Non-test email does NOT get beta bypass"""
    print_test_header("TEST 3: Non-@test.com email does NOT get beta bypass")
    
    signup_data = {
        "email": "regularuser123@gmail.com",
        "password": "testpass123",
        "name": "Regular User",
        "phone": "8681234567",
        "currentRole": "customer"
    }
    
    response = make_request("POST", "/auth/signup", signup_data)
    
    if not response:
        print_result(False, "Request failed")
        return
    
    if response.status_code == 201 or response.status_code == 200:
        try:
            data = response.json()
            user = data.get("user", {})
            is_beta_user = user.get("isBetaUser", True)  # Default to True to catch failures
            
            if not is_beta_user:
                print_result(True, f"Non-@test.com email correctly got isBetaUser: false")
            else:
                print_result(False, f"Non-@test.com email should have isBetaUser: false, got: {is_beta_user}")
        except Exception as e:
            print_result(False, f"Failed to parse response: {str(e)}")
    else:
        print_result(False, f"Signup failed with status {response.status_code}")

def test_4_provider_onboarding_flow(token):
    """Test 4: Provider onboarding flow with @test.com email"""
    print_test_header("TEST 4: Provider onboarding flow with @test.com email")
    
    if not token:
        print_result(False, "No token available from Test 1")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 1: Provider setup
    setup_data = {
        "services": ["electrical", "plumbing"],
        "bio": "Test provider for beta bypass testing",
        "baseTown": "Port of Spain",
        "travelRadiusMiles": 15,
        "travelAnywhere": False
    }
    
    print("\n📋 Step 1: Provider Setup")
    response = make_request("POST", "/users/provider-setup", setup_data, headers)
    
    if not response or response.status_code not in [200, 201]:
        print_result(False, f"Provider setup failed with status {response.status_code if response else 'No response'}")
        return
    
    try:
        user_data = response.json()
        print_result(True, "Provider setup completed successfully")
    except Exception as e:
        print_result(False, f"Failed to parse provider setup response: {str(e)}")
        return
    
    # Step 2: Get provider profile
    print("\n📋 Step 2: Get Provider Profile")
    response = make_request("GET", "/providers/me/profile", headers=headers)
    
    if not response or response.status_code != 200:
        print_result(False, f"Get provider profile failed with status {response.status_code if response else 'No response'}")
        return
    
    try:
        provider_data = response.json()
        verification_status = provider_data.get("verificationStatus")
        setup_complete = provider_data.get("setupComplete")
        
        # Check Phase 4 requirements
        if verification_status == "unverified" and setup_complete == False:
            print_result(True, f"Provider correctly starts with verificationStatus: 'unverified' and setupComplete: false")
        else:
            print_result(False, f"Provider should start unverified and incomplete, got verificationStatus: {verification_status}, setupComplete: {setup_complete}")
        
    except Exception as e:
        print_result(False, f"Failed to parse provider profile response: {str(e)}")

def main():
    """Run all beta bypass tests"""
    print("🚀 Starting Beta Bypass Fix Tests for @test.com emails")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run tests
    token = test_1_new_test_email_signup()
    test_2_existing_test_email_login()
    test_3_non_test_email_signup()
    test_4_provider_onboarding_flow(token)
    
    print(f"\n{'='*60}")
    print("🏁 Beta Bypass Testing Complete")
    print(f"⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()