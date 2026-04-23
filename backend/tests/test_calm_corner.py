"""
Test suite for Calm Corner feature and Willow Memory endpoints
Tests: GET /api/calm-corner/activities, PUT/DELETE /api/profile/willow-memory
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ─── Fixtures ───

@pytest.fixture(scope="module")
def session_token():
    """Create a test user and session for authenticated tests"""
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        var userId = 'pytest-calm-' + Date.now();
        var sessionToken = 'pytest_session_' + Date.now();
        db.users.insertOne({ 
            user_id: userId, 
            email: 'pytest_calm@example.com', 
            name: 'Pytest Calm Mom', 
            picture: '', 
            created_at: new Date(), 
            trial_end: new Date(Date.now() + 7*24*60*60*1000), 
            subscription_status: 'trial' 
        });
        db.user_sessions.insertOne({ 
            user_id: userId, 
            session_token: sessionToken, 
            expires_at: new Date(Date.now() + 7*24*60*60*1000), 
            created_at: new Date() 
        });
        print(sessionToken);
        '''
    ], capture_output=True, text=True)
    token = result.stdout.strip().split('\n')[-1]
    yield token
    # Cleanup
    subprocess.run([
        'mongosh', '--quiet', '--eval', f'''
        use('test_database');
        db.users.deleteOne({{ email: 'pytest_calm@example.com' }});
        db.user_sessions.deleteOne({{ session_token: '{token}' }});
        db.user_profiles.deleteOne({{ user_id: /pytest-calm-/ }});
        '''
    ], capture_output=True)


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_client(api_client, session_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {session_token}"})
    return api_client


# ─── Calm Corner Activities Tests ───

class TestCalmCornerActivities:
    """Tests for GET /api/calm-corner/activities endpoint (public, no auth required)"""
    
    def test_get_activities_returns_200(self, api_client):
        """Verify endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/calm-corner/activities returns 200")
    
    def test_get_activities_returns_13_activities(self, api_client):
        """Verify exactly 13 activities are returned"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        assert "activities" in data, "Response missing 'activities' key"
        assert len(data["activities"]) == 13, f"Expected 13 activities, got {len(data['activities'])}"
        print(f"✅ Returns 13 activities: {[a['id'] for a in data['activities']]}")
    
    def test_get_activities_returns_5_categories(self, api_client):
        """Verify exactly 5 categories are returned"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        assert "categories" in data, "Response missing 'categories' key"
        assert len(data["categories"]) == 5, f"Expected 5 categories, got {len(data['categories'])}"
        expected_categories = ["grounding", "breathing", "physical", "creative", "sensory"]
        actual_categories = [c["id"] for c in data["categories"]]
        assert set(actual_categories) == set(expected_categories), f"Categories mismatch: {actual_categories}"
        print(f"✅ Returns 5 categories: {actual_categories}")
    
    def test_activity_structure(self, api_client):
        """Verify each activity has required fields"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        required_fields = ["id", "title", "category", "duration", "description", "steps", "when"]
        
        for activity in data["activities"]:
            for field in required_fields:
                assert field in activity, f"Activity {activity.get('id', 'unknown')} missing field: {field}"
        print("✅ All activities have required fields")
    
    def test_box_breathing_has_guided_flag(self, api_client):
        """Verify box_breathing activity has guided=True"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        box_breathing = next((a for a in data["activities"] if a["id"] == "box_breathing"), None)
        assert box_breathing is not None, "box_breathing activity not found"
        assert box_breathing.get("guided") == True, "box_breathing should have guided=True"
        print("✅ box_breathing has guided=True")
    
    def test_grounding_activities_count(self, api_client):
        """Verify 5 grounding activities exist"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        grounding = [a for a in data["activities"] if a["category"] == "grounding"]
        assert len(grounding) == 5, f"Expected 5 grounding activities, got {len(grounding)}"
        print(f"✅ 5 grounding activities: {[a['id'] for a in grounding]}")
    
    def test_breathing_activities_count(self, api_client):
        """Verify 3 breathing activities exist"""
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        breathing = [a for a in data["activities"] if a["category"] == "breathing"]
        assert len(breathing) == 3, f"Expected 3 breathing activities, got {len(breathing)}"
        print(f"✅ 3 breathing activities: {[a['id'] for a in breathing]}")


# ─── Willow Memory Tests (Authenticated) ───

class TestWillowMemory:
    """Tests for PUT/DELETE /api/profile/willow-memory endpoints (auth required)"""
    
    def test_update_willow_memory_success(self, authenticated_client):
        """Test updating willow memory with valid fields"""
        payload = {
            "preferred_name": "Test Mama",
            "goals": "Stay calm and centered",
            "children": "2 kids, ages 5 and 8"
        }
        response = authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["preferred_name"] == "Test Mama"
        assert data["goals"] == "Stay calm and centered"
        assert data["children"] == "2 kids, ages 5 and 8"
        assert data["has_profile"] == True
        print("✅ PUT /api/profile/willow-memory updates memory successfully")
    
    def test_update_willow_memory_invalid_field(self, authenticated_client):
        """Test that invalid fields are rejected"""
        payload = {"invalid_field": "should not work"}
        response = authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json=payload
        )
        assert response.status_code == 400, f"Expected 400 for invalid field, got {response.status_code}"
        print("✅ PUT /api/profile/willow-memory rejects invalid fields")
    
    def test_delete_specific_field(self, authenticated_client):
        """Test clearing a specific memory field"""
        # First set a field
        authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"triggers": "Loud noises"}
        )
        
        # Then delete it
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"field": "triggers"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "triggers" not in data or data.get("triggers") is None
        print("✅ DELETE /api/profile/willow-memory clears specific field")
    
    def test_delete_invalid_field(self, authenticated_client):
        """Test that deleting invalid field returns 400"""
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"field": "invalid_field"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid field, got {response.status_code}"
        print("✅ DELETE /api/profile/willow-memory rejects invalid field")
    
    def test_delete_entire_memory(self, authenticated_client):
        """Test clearing entire memory (no field specified)"""
        # First set some data
        authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"wins": "Got through a tough day"}
        )
        
        # Delete entire profile
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("has_profile") == False or "has_profile" not in data
        print("✅ DELETE /api/profile/willow-memory clears entire memory")
    
    def test_update_without_auth_fails(self, api_client):
        """Test that unauthenticated requests fail"""
        response = api_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"preferred_name": "Should fail"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ PUT /api/profile/willow-memory requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
