(async () => {
  try {
    const baseURL = 'http://localhost:5000/api';
    
    console.log('Registering...');
    await fetch(`${baseURL}/auth/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: 'Test', email: 'test3@example.com', password: 'password123' }) }).catch(() => {});

    console.log('Logging in...');
    const loginRes = await fetch(`${baseURL}/auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'test3@example.com', password: 'password123' }) });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Token received');

    console.log('Fetching profile...');
    const profileRes = await fetch(`${baseURL}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const profileData = await profileRes.json();
    console.log('Profile:', profileData.name);

    console.log('Creating group...');
    const groupRes = await fetch(`${baseURL}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Test Group', members: [] }) });
    const groupData = await groupRes.json();
    console.log('Group created:', groupData.name || groupData.message);
  } catch (err) {
    console.error('Error:', err);
  }
})();
