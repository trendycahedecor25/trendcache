"""
Test suite for Calm Corner feature and Willow Memory endpoints
Tests: GET /api/calm-corner/activities, PUT/DELETE /api/profile/willow-memory
"""
import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def session_token():
    """Create a test user and session for authenticated tests"""
    import subprocess
    token_value = f"pytest_{secrets.token_urlsafe(24)}"
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', f'''
        use('test_database');
        var userId = 'pytest-calm-' + Date.now();
        var sessionToken = '{token_value}';
        db.users.insertOne({{
            user_id: userId,
            email: 'pytest_calm@example.com',
            name: 'Pytest Calm Mom',
            picture: '',
            created_at: new Date(),
            trial_end: new Date(Date.now() + 7*24*60*60*1000),
            subscription_status: 'trial'
        }});
        db.user_sessions.insertOne({{
            user_id: userId,
            session_token: sessionToken,
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        print(sessionToken);
        '''
    ], capture_output=True, text=True)
    token = result.stdout.strip().split('\n')[-1]
    yield token
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


class TestCalmCornerActivities:
    """Tests for GET /api/calm-corner/activities endpoint (public, no auth required)"""

    def test_get_activities_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        assert response.status_code == 200

    def test_get_activities_returns_13_activities(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        assert "activities" in data
        assert len(data["activities"]) == 13

    def test_get_activities_returns_5_categories(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) == 5
        expected_categories = {"grounding", "breathing", "physical", "creative", "sensory"}
        actual_categories = {c["id"] for c in data["categories"]}
        assert actual_categories == expected_categories

    def test_activity_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        required_fields = ["id", "title", "category", "duration", "description", "steps", "when"]
        for activity in data["activities"]:
            for field in required_fields:
                assert field in activity, f"Activity {activity.get('id', 'unknown')} missing field: {field}"

    def test_box_breathing_has_guided_flag(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        box_breathing = next((a for a in data["activities"] if a["id"] == "box_breathing"), None)
        assert box_breathing is not None
        assert box_breathing.get("guided")

    def test_grounding_activities_count(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        grounding = [a for a in data["activities"] if a["category"] == "grounding"]
        assert len(grounding) == 5

    def test_breathing_activities_count(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/calm-corner/activities")
        data = response.json()
        breathing = [a for a in data["activities"] if a["category"] == "breathing"]
        assert len(breathing) == 3


class TestWillowMemory:
    """Tests for PUT/DELETE /api/profile/willow-memory endpoints (auth required)"""

    def test_update_willow_memory_success(self, authenticated_client):
        payload = {
            "preferred_name": "Test Mama",
            "goals": "Stay calm and centered",
            "children": "2 kids, ages 5 and 8"
        }
        response = authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["preferred_name"] == "Test Mama"
        assert data["goals"] == "Stay calm and centered"
        assert data["children"] == "2 kids, ages 5 and 8"
        assert data.get("has_profile")

    def test_update_willow_memory_invalid_field(self, authenticated_client):
        payload = {"invalid_field": "should not work"}
        response = authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json=payload
        )
        assert response.status_code == 400

    def test_delete_specific_field(self, authenticated_client):
        authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"triggers": "Loud noises"}
        )
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"field": "triggers"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "triggers" not in data or data.get("triggers") is None

    def test_delete_invalid_field(self, authenticated_client):
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"field": "invalid_field"}
        )
        assert response.status_code == 400

    def test_delete_entire_memory(self, authenticated_client):
        authenticated_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"wins": "Got through a tough day"}
        )
        response = authenticated_client.delete(
            f"{BASE_URL}/api/profile/willow-memory",
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert not data.get("has_profile")

    def test_update_without_auth_fails(self, api_client):
        response = api_client.put(
            f"{BASE_URL}/api/profile/willow-memory",
            json={"preferred_name": "Should fail"}
        )
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
