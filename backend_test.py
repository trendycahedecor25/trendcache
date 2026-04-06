#!/usr/bin/env python3
"""
HEARD App Backend API Testing
Tests all backend endpoints including auth, mood, chat, journal, and calendar functionality.
"""

import requests
import sys
import json
import uuid
import time
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

class HEARDAPITester:
    def __init__(self, base_url="https://github-explorer-21.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # MongoDB connection for auth setup
        self.mongo_client = MongoClient("mongodb://localhost:27017")
        self.db = self.mongo_client["test_database"]

    def log_test(self, name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            if expected_status and actual_status:
                print(f"   Expected: {expected_status}, Got: {actual_status}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status
        })

    def setup_test_user(self):
        """Create test user and session in MongoDB"""
        try:
            # Create unique test user
            timestamp = int(datetime.now().timestamp())
            self.user_id = f"test-user-{timestamp}"
            self.session_token = f"test_session_{timestamp}"
            
            # Insert test user with trial access (like new users get)
            user_doc = {
                "user_id": self.user_id,
                "email": f"test.user.{timestamp}@example.com",
                "name": "Test User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "trial_end": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "subscription_status": "trial"
            }
            self.db.users.insert_one(user_doc)
            
            # Insert test session
            session_doc = {
                "user_id": self.user_id,
                "session_token": self.session_token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.db.user_sessions.insert_one(session_doc)
            
            print(f"🔧 Created test user: {self.user_id}")
            print(f"🔧 Session token: {self.session_token}")
            return True
        except Exception as e:
            print(f"❌ Failed to setup test user: {e}")
            return False

    def cleanup_test_user(self):
        """Clean up test user and session"""
        try:
            if self.user_id:
                self.db.users.delete_many({"user_id": self.user_id})
                self.db.user_sessions.delete_many({"user_id": self.user_id})
                # Clean up test data
                self.db.mood_entries.delete_many({"user_id": self.user_id})
                self.db.journal_entries.delete_many({"user_id": self.user_id})
                self.db.calendar_events.delete_many({"user_id": self.user_id})
                self.db.conversations.delete_many({"user_id": self.user_id})
                print(f"🧹 Cleaned up test user: {self.user_id}")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def make_request(self, method, endpoint, data=None, auth_required=True):
        """Make HTTP request with optional auth"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.Timeout as e:
            print(f"❌ Request timeout for {method} {endpoint}: {e}")
            return None
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Connection error for {method} {endpoint}: {e}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed for {method} {endpoint}: {e}")
            return None

    def test_health_check(self):
        """Test health check endpoint"""
        response = self.make_request('GET', 'health', auth_required=False)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('status') == 'healthy' and data.get('app') == 'HEARD'
            self.log_test("Health Check", success, 
                         f"Response: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Health Check", False, "No response or wrong status", 
                         200, response.status_code if response else "No response")

    def test_auth_me(self):
        """Test auth/me endpoint"""
        response = self.make_request('GET', 'auth/me')
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('user_id') == self.user_id
            self.log_test("Auth Me", success,
                         f"User ID mismatch: {data.get('user_id')} != {self.user_id}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Auth Me", False, "Failed to get user info",
                         200, response.status_code if response else "No response")

    def test_mood_logging(self):
        """Test mood logging functionality"""
        # Test mood logging
        mood_data = {
            "mood_score": 4,
            "mood_label": "Good",
            "note": "Test mood entry"
        }
        response = self.make_request('POST', 'mood', mood_data)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('mood_score') == 4 and data.get('mood_label') == 'Good'
            self.log_test("Mood Logging", success,
                         f"Mood data mismatch: {data}" if not success else "",
                         200, response.status_code)
            
            # Test mood history
            response = self.make_request('GET', 'mood')
            if response and response.status_code == 200:
                history = response.json()
                success = len(history) > 0 and any(m.get('mood_label') == 'Good' for m in history)
                self.log_test("Mood History", success,
                             f"No mood entries found: {history}" if not success else "",
                             200, response.status_code)
            else:
                self.log_test("Mood History", False, "Failed to get mood history",
                             200, response.status_code if response else "No response")
        else:
            self.log_test("Mood Logging", False, "Failed to log mood",
                         200, response.status_code if response else "No response")

    def test_mood_insights(self):
        """Test mood insights endpoint"""
        response = self.make_request('GET', 'mood/insights')
        if response and response.status_code == 200:
            data = response.json()
            success = 'total_entries' in data and 'trend' in data
            self.log_test("Mood Insights", success,
                         f"Missing insights data: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Mood Insights", False, "Failed to get mood insights",
                         200, response.status_code if response else "No response")

    def test_chat_functionality(self):
        """Test Willow chat functionality"""
        # Test sending a message (creates new conversation)
        chat_data = {
            "message": "Hello Willow, this is a test message"
        }
        response = self.make_request('POST', 'chat/message', chat_data)
        if response and response.status_code == 200:
            data = response.json()
            success = 'conversation_id' in data and 'willow_response' in data
            conversation_id = data.get('conversation_id')
            self.log_test("Chat Message", success,
                         f"Missing chat response data: {data}" if not success else "",
                         200, response.status_code)
            
            if success and conversation_id:
                # Test getting conversations list
                response = self.make_request('GET', 'chat/conversations')
                if response and response.status_code == 200:
                    conversations = response.json()
                    success = len(conversations) > 0 and any(c.get('conversation_id') == conversation_id for c in conversations)
                    self.log_test("Chat Conversations List", success,
                                 f"Conversation not found in list: {conversations}" if not success else "",
                                 200, response.status_code)
                else:
                    self.log_test("Chat Conversations List", False, "Failed to get conversations",
                                 200, response.status_code if response else "No response")
                
                # Test getting conversation messages
                response = self.make_request('GET', f'chat/conversations/{conversation_id}/messages')
                if response and response.status_code == 200:
                    messages_data = response.json()
                    messages = messages_data.get('messages', [])
                    success = len(messages) >= 2  # User message + Willow response
                    self.log_test("Chat Messages", success,
                                 f"Expected at least 2 messages, got {len(messages)}" if not success else "",
                                 200, response.status_code)
                else:
                    self.log_test("Chat Messages", False, "Failed to get conversation messages",
                                 200, response.status_code if response else "No response")
        else:
            self.log_test("Chat Message", False, "Failed to send chat message",
                         200, response.status_code if response else "No response")

    def test_journal_functionality(self):
        """Test journal CRUD operations"""
        # Test creating journal entry
        journal_data = {
            "title": "Test Journal Entry",
            "content": "This is a test journal entry content.",
            "mood": "Happy"
        }
        response = self.make_request('POST', 'journal', journal_data)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('title') == journal_data['title']
            entry_id = data.get('entry_id')
            self.log_test("Journal Create", success,
                         f"Journal data mismatch: {data}" if not success else "",
                         200, response.status_code)
            
            if success and entry_id:
                # Test getting journal entries
                response = self.make_request('GET', 'journal')
                if response and response.status_code == 200:
                    entries = response.json()
                    success = len(entries) > 0 and any(e.get('entry_id') == entry_id for e in entries)
                    self.log_test("Journal List", success,
                                 f"Entry not found in list: {entries}" if not success else "",
                                 200, response.status_code)
                else:
                    self.log_test("Journal List", False, "Failed to get journal entries",
                                 200, response.status_code if response else "No response")
                
                # Test deleting journal entry
                response = self.make_request('DELETE', f'journal/{entry_id}')
                if response and response.status_code == 200:
                    self.log_test("Journal Delete", True, "", 200, response.status_code)
                else:
                    self.log_test("Journal Delete", False, "Failed to delete journal entry",
                                 200, response.status_code if response else "No response")
        else:
            self.log_test("Journal Create", False, "Failed to create journal entry",
                         200, response.status_code if response else "No response")

    def test_journal_prompts(self):
        """Test AI journal prompts"""
        response = self.make_request('GET', 'journal/prompts')
        if response and response.status_code == 200:
            data = response.json()
            success = 'prompts' in data and len(data.get('prompts', [])) > 0
            self.log_test("Journal Prompts", success,
                         f"No prompts returned: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Journal Prompts", False, "Failed to get journal prompts",
                         200, response.status_code if response else "No response")

    def test_subscription_info(self):
        """Test subscription info endpoint"""
        response = self.make_request('GET', 'subscribe/info')
        if response and response.status_code == 200:
            data = response.json()
            success = 'status' in data and 'is_premium' in data
            self.log_test("Subscription Info", success,
                         f"Missing subscription data: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Subscription Info", False, "Failed to get subscription info",
                         200, response.status_code if response else "No response")

    def test_subscription_checkout(self):
        """Test Stripe checkout session creation"""
        checkout_data = {
            "origin_url": "https://github-explorer-21.preview.emergentagent.com"
        }
        response = self.make_request('POST', 'subscribe/checkout', checkout_data)
        if response and response.status_code == 200:
            data = response.json()
            success = 'url' in data and 'session_id' in data and data['url'].startswith('https://checkout.stripe.com')
            self.log_test("Subscription Checkout", success,
                         f"Invalid checkout response: {data}" if not success else "",
                         200, response.status_code)
            return data.get('session_id')
        else:
            self.log_test("Subscription Checkout", False, "Failed to create checkout session",
                         200, response.status_code if response else "No response")
            return None

    def test_payment_status(self, session_id):
        """Test payment status polling"""
        if not session_id:
            self.log_test("Payment Status", False, "No session ID provided")
            return
        
        response = self.make_request('GET', f'subscribe/status/{session_id}')
        if response and response.status_code == 200:
            data = response.json()
            success = 'status' in data and 'payment_status' in data
            self.log_test("Payment Status", success,
                         f"Missing payment status data: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Payment Status", False, "Failed to get payment status",
                         200, response.status_code if response else "No response")

    def test_stripe_webhook(self):
        """Test Stripe webhook endpoint"""
        # Test webhook with minimal payload (will fail validation but should return 200)
        webhook_data = {"type": "test"}
        response = self.make_request('POST', 'webhook/stripe', webhook_data)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('status') == 'ok'
            self.log_test("Stripe Webhook", success,
                         f"Unexpected webhook response: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Stripe Webhook", False, "Failed to call webhook",
                         200, response.status_code if response else "No response")

    def setup_free_user(self):
        """Create a free user (no trial, no subscription)"""
        try:
            timestamp = int(datetime.now().timestamp())
            user_id = f"free-user-{timestamp}"
            session_token = f"free_session_{timestamp}"
            
            # Insert free user (no trial_end or subscription_end)
            user_doc = {
                "user_id": user_id,
                "email": f"free.user.{timestamp}@example.com",
                "name": "Free User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.db.users.insert_one(user_doc)
            
            # Insert session
            session_doc = {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.db.user_sessions.insert_one(session_doc)
            
            return user_id, session_token
        except Exception as e:
            print(f"❌ Failed to setup free user: {e}")
            return None, None

    def setup_trial_user(self):
        """Create a trial user (trial_end in future)"""
        try:
            timestamp = int(datetime.now().timestamp())
            user_id = f"trial-user-{timestamp}"
            session_token = f"trial_session_{timestamp}"
            
            # Insert trial user
            user_doc = {
                "user_id": user_id,
                "email": f"trial.user.{timestamp}@example.com",
                "name": "Trial User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "trial_end": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
                "subscription_status": "trial"
            }
            self.db.users.insert_one(user_doc)
            
            # Insert session
            session_doc = {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.db.user_sessions.insert_one(session_doc)
            
            return user_id, session_token
        except Exception as e:
            print(f"❌ Failed to setup trial user: {e}")
            return None, None

    def test_free_user_limits_summary(self):
        """Test free user limits (chat and prompts) - Summary test"""
        # Based on backend logs, we can see that:
        # - Free users get 403 on 4th chat message 
        # - Free users get 403 on journal prompts
        # The individual tests have connection issues but the functionality works
        
        # Quick verification test
        free_user_id, free_session_token = self.setup_free_user()
        if not free_user_id:
            self.log_test("Free User Limits", False, "Failed to create free user")
            return
        
        # Store original session
        original_session = self.session_token
        original_user_id = self.user_id
        
        try:
            # Switch to free user
            self.session_token = free_session_token
            self.user_id = free_user_id
            time.sleep(0.5)
            
            # Test prompts (should be blocked)
            response = self.make_request('GET', 'journal/prompts')
            prompts_blocked = response is not None and response.status_code == 403
            
            # Send 3 messages then test 4th
            chat_success = True
            for i in range(3):
                chat_data = {"message": f"Test message {i+1}"}
                response = self.make_request('POST', 'chat/message', chat_data)
                if not (response and response.status_code == 200):
                    chat_success = False
                    break
            
            # Test 4th message (should be blocked)
            fourth_blocked = False
            if chat_success:
                chat_data = {"message": "4th message should fail"}
                response = self.make_request('POST', 'chat/message', chat_data)
                fourth_blocked = response is not None and response.status_code == 403
            
            # Overall success if both limits work
            success = prompts_blocked and fourth_blocked and chat_success
            details = f"Chat 3/3: {chat_success}, Prompts blocked: {prompts_blocked}, 4th chat blocked: {fourth_blocked}"
            
            self.log_test("Free User Limits", success, details if not success else "")
            
        except Exception as e:
            self.log_test("Free User Limits", False, f"Exception: {e}")
        finally:
            # Cleanup
            try:
                self.db.users.delete_many({"user_id": free_user_id})
                self.db.user_sessions.delete_many({"user_id": free_user_id})
                self.db.conversations.delete_many({"user_id": free_user_id})
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")
            
            # Restore original session
            self.session_token = original_session
            self.user_id = original_user_id

    def test_trial_user_access(self):
        """Test that trial users have full access"""
        # Setup trial user
        trial_user_id, trial_session_token = self.setup_trial_user()
        if not trial_user_id:
            self.log_test("Trial User Access Setup", False, "Failed to create trial user")
            return
        
        # Store original session for cleanup
        original_session = self.session_token
        original_user_id = self.user_id
        
        # Switch to trial user
        self.session_token = trial_session_token
        self.user_id = trial_user_id
        
        try:
            # Test prompts access (should work)
            response = self.make_request('GET', 'journal/prompts')
            if response and response.status_code == 200:
                self.log_test("Trial User Prompts Access", True, "Trial user can access prompts")
            else:
                self.log_test("Trial User Prompts Access", False, "Trial user should access prompts",
                             200, response.status_code if response else "No response")
            
            # Test unlimited chat (send 5 messages, should all work)
            success_count = 0
            for i in range(5):
                chat_data = {"message": f"Trial test message {i+1}"}
                response = self.make_request('POST', 'chat/message', chat_data)
                if response and response.status_code == 200:
                    success_count += 1
            
            if success_count == 5:
                self.log_test("Trial User Unlimited Chat", True, "Trial user can send unlimited messages")
            else:
                self.log_test("Trial User Unlimited Chat", False, f"Only {success_count}/5 messages sent")
        
        finally:
            # Cleanup trial user
            self.db.users.delete_many({"user_id": trial_user_id})
            self.db.user_sessions.delete_many({"user_id": trial_user_id})
            self.db.conversations.delete_many({"user_id": trial_user_id})
            
            # Restore original session
            self.session_token = original_session
            self.user_id = original_user_id

    def test_auth_me_subscription(self):
        """Test that auth/me returns subscription info"""
        response = self.make_request('GET', 'auth/me')
        if response and response.status_code == 200:
            data = response.json()
            success = 'subscription' in data and 'status' in data.get('subscription', {})
            self.log_test("Auth Me Subscription", success,
                         f"Missing subscription in auth/me: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Auth Me Subscription", False, "Failed to get user info with subscription",
                         200, response.status_code if response else "No response")

    def test_calendar_functionality(self):
        """Test calendar CRUD operations"""
        # Test creating calendar event
        event_data = {
            "title": "Test Event",
            "description": "This is a test event",
            "start_time": "2024-12-20T10:00:00",
            "end_time": "2024-12-20T11:00:00",
            "event_type": "general",
            "reminder": True
        }
        response = self.make_request('POST', 'calendar/events', event_data)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('title') == event_data['title']
            event_id = data.get('event_id')
            self.log_test("Calendar Create", success,
                         f"Event data mismatch: {data}" if not success else "",
                         200, response.status_code)
            
            if success and event_id:
                # Test getting calendar events
                response = self.make_request('GET', 'calendar/events')
                if response and response.status_code == 200:
                    events = response.json()
                    success = len(events) > 0 and any(e.get('event_id') == event_id for e in events)
                    self.log_test("Calendar List", success,
                                 f"Event not found in list: {events}" if not success else "",
                                 200, response.status_code)
                else:
                    self.log_test("Calendar List", False, "Failed to get calendar events",
                                 200, response.status_code if response else "No response")
                
                # Test deleting calendar event
                response = self.make_request('DELETE', f'calendar/events/{event_id}')
                if response and response.status_code == 200:
                    self.log_test("Calendar Delete", True, "", 200, response.status_code)
                else:
                    self.log_test("Calendar Delete", False, "Failed to delete calendar event",
                                 200, response.status_code if response else "No response")
        else:
            self.log_test("Calendar Create", False, "Failed to create calendar event",
                         200, response.status_code if response else "No response")

    def test_referral_info(self):
        """Test referral info endpoint"""
        response = self.make_request('GET', 'referral/info')
        if response and response.status_code == 200:
            data = response.json()
            success = ('referral_code' in data and 'referral_count' in data and 
                      'referrals' in data and 'reward_days' in data)
            self.log_test("Referral Info", success,
                         f"Missing referral data: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Referral Info", False, "Failed to get referral info",
                         200, response.status_code if response else "No response")

    def test_auth_me_referral_fields(self):
        """Test that auth/me returns referral fields"""
        response = self.make_request('GET', 'auth/me')
        if response and response.status_code == 200:
            data = response.json()
            success = ('referral_code' in data and 'referral_count' in data and 
                      'is_admin' in data)
            self.log_test("Auth Me Referral Fields", success,
                         f"Missing referral fields in auth/me: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Auth Me Referral Fields", False, "Failed to get user info with referral fields",
                         200, response.status_code if response else "No response")

    def test_admin_set_admin(self):
        """Test setting admin access"""
        # First test with wrong secret
        admin_data = {
            "email": f"test.user.{int(datetime.now().timestamp())}@example.com",
            "secret": "wrong_secret"
        }
        response = self.make_request('POST', 'admin/set-admin', admin_data, auth_required=False)
        if response and response.status_code == 403:
            self.log_test("Admin Set Admin (Wrong Secret)", True, "", 403, response.status_code)
        else:
            self.log_test("Admin Set Admin (Wrong Secret)", False, "Should reject wrong secret",
                         403, response.status_code if response else "No response")
        
        # Test with correct secret but non-existent user
        admin_data = {
            "email": "nonexistent@example.com",
            "secret": "HEARD_ADMIN_2026"
        }
        response = self.make_request('POST', 'admin/set-admin', admin_data, auth_required=False)
        if response and response.status_code == 404:
            self.log_test("Admin Set Admin (User Not Found)", True, "", 404, response.status_code)
        else:
            self.log_test("Admin Set Admin (User Not Found)", False, "Should return 404 for non-existent user",
                         404, response.status_code if response else "No response")

    def test_admin_analytics_unauthorized(self):
        """Test admin analytics endpoint without admin access"""
        response = self.make_request('GET', 'admin/analytics')
        if response and response.status_code == 403:
            self.log_test("Admin Analytics (Unauthorized)", True, "", 403, response.status_code)
        else:
            self.log_test("Admin Analytics (Unauthorized)", False, "Should reject non-admin users",
                         403, response.status_code if response else "No response")

    def test_admin_flow(self):
        """Test complete admin flow: set admin, then access analytics"""
        # Get current user email from auth/me
        response = self.make_request('GET', 'auth/me')
        if not (response and response.status_code == 200):
            self.log_test("Admin Flow Setup", False, "Failed to get user info")
            return
        
        user_data = response.json()
        user_email = user_data.get('email')
        if not user_email:
            self.log_test("Admin Flow Setup", False, "No email in user data")
            return
        
        # Set admin access with correct secret
        admin_data = {
            "email": user_email,
            "secret": "HEARD_ADMIN_2026"
        }
        response = self.make_request('POST', 'admin/set-admin', admin_data, auth_required=False)
        if response and response.status_code == 200:
            self.log_test("Admin Set Admin (Success)", True, "", 200, response.status_code)
            
            # Now test admin analytics access
            response = self.make_request('GET', 'admin/analytics')
            if response and response.status_code == 200:
                data = response.json()
                success = ('users' in data and 'revenue' in data and 'referrals' in data and 
                          'engagement' in data and 'recent_signups' in data)
                self.log_test("Admin Analytics (Authorized)", success,
                             f"Missing analytics data: {data}" if not success else "",
                             200, response.status_code)
            else:
                self.log_test("Admin Analytics (Authorized)", False, "Failed to get analytics as admin",
                             200, response.status_code if response else "No response")
        else:
            self.log_test("Admin Set Admin (Success)", False, "Failed to set admin access",
                         200, response.status_code if response else "No response")

    def test_new_user_referral_code(self):
        """Test that new users get referral codes"""
        # Create a new user and check if they get a referral code
        timestamp = int(datetime.now().timestamp())
        user_id = f"new-user-{timestamp}"
        session_token = f"new_session_{timestamp}"
        
        try:
            # Insert new user with referral code (simulating signup)
            user_doc = {
                "user_id": user_id,
                "email": f"new.user.{timestamp}@example.com",
                "name": "New User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "trial_end": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "subscription_status": "trial",
                "referral_code": f"HEARD{timestamp}",  # Simulate generated code
                "referral_count": 0,
                "is_admin": False
            }
            self.db.users.insert_one(user_doc)
            
            # Insert session
            session_doc = {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.db.user_sessions.insert_one(session_doc)
            
            # Store original session
            original_session = self.session_token
            original_user_id = self.user_id
            
            # Switch to new user
            self.session_token = session_token
            self.user_id = user_id
            
            # Test auth/me returns referral code
            response = self.make_request('GET', 'auth/me')
            if response and response.status_code == 200:
                data = response.json()
                success = (data.get('referral_code') and 
                          data.get('referral_count') == 0 and 
                          data.get('is_admin') == False)
                self.log_test("New User Referral Code", success,
                             f"Missing or invalid referral data: {data}" if not success else "",
                             200, response.status_code)
            else:
                self.log_test("New User Referral Code", False, "Failed to get new user info",
                             200, response.status_code if response else "No response")
            
            # Restore original session
            self.session_token = original_session
            self.user_id = original_user_id
            
        except Exception as e:
            self.log_test("New User Referral Code", False, f"Exception: {e}")
        finally:
            # Cleanup
            try:
                self.db.users.delete_many({"user_id": user_id})
                self.db.user_sessions.delete_many({"user_id": user_id})
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")

    def test_logout(self):
        """Test logout functionality"""
        response = self.make_request('POST', 'auth/logout', {})
        if response and response.status_code == 200:
            data = response.json()
            success = data.get('message') == 'Logged out'
            self.log_test("Logout", success,
                         f"Unexpected logout response: {data}" if not success else "",
                         200, response.status_code)
        else:
            self.log_test("Logout", False, "Failed to logout",
                         200, response.status_code if response else "No response")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting HEARD Backend API Tests")
        print(f"🔗 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Setup test user
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return False
        
        try:
            # Run tests in order
            self.test_health_check()
            self.test_auth_me()
            self.test_auth_me_subscription()
            self.test_subscription_info()
            
            # Test subscription features
            session_id = self.test_subscription_checkout()
            self.test_payment_status(session_id)
            self.test_stripe_webhook()
            
            # Test user limits
            self.test_free_user_limits_summary()
            self.test_trial_user_access()
            
            # Test core functionality
            self.test_mood_logging()
            self.test_mood_insights()
            self.test_chat_functionality()
            self.test_journal_functionality()
            self.test_journal_prompts()
            self.test_calendar_functionality()
            
            # Test new referral and admin features
            self.test_referral_info()
            self.test_auth_me_referral_fields()
            self.test_new_user_referral_code()
            self.test_admin_set_admin()
            self.test_admin_analytics_unauthorized()
            self.test_admin_flow()
            
            self.test_logout()
            
        finally:
            # Cleanup
            self.cleanup_test_user()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HEARDAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())