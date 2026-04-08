// Use relative URL so API calls always go through the same domain the user is on.
// This prevents cross-origin issues when accessing via custom domains (e.g., willowhears.me)
// while the REACT_APP_BACKEND_URL might point to a different domain.
const API = process.env.NODE_ENV === 'production' ? '/api' : `${process.env.REACT_APP_BACKEND_URL}/api`;

export default API;
