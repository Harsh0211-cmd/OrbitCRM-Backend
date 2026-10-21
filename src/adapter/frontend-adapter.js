// Client-side adapter script served dynamically to hydrate OrbitCRM frontend
// Connects vanilla JS UI to Express backend (/api/v1) without modifying source files on disk.

(function () {
  const API_BASE = '/api/v1';

  async function apiFetch(endpoint, options = {}) {
    const token = sessionStorage.getItem('orbit_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  }

  window.OrbitAPI = {
    apiFetch,
    API_BASE
  };

  // Intercept login form submission in capture phase
  document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'loginForm') {
      e.preventDefault();
      e.stopImmediatePropagation();

      const formData = new FormData(e.target);
      const credentials = Object.fromEntries(formData);

      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            id: credentials.id,
            password: credentials.password
          })
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = (data && data.error && data.error.message) || 'Invalid Login ID or Password.';
          if (typeof window.toast === 'function') {
            window.toast(errMsg);
          }
          return;
        }

        // Store JWT token
        sessionStorage.setItem('orbit_token', data.token);
        window.user = data.user;

        // Hydrate state from backend bootstrap payload
        const bootRes = await apiFetch('/bootstrap');
        if (bootRes.ok) {
          const bootData = await bootRes.json();
          window.state = {
            customers: bootData.customers || [],
            leads: bootData.leads || [],
            projects: bootData.projects || [],
            tickets: bootData.tickets || [],
            tasks: bootData.tasks || [],
            requests: bootData.requests || [],
            issues: bootData.issues || [],
            notifications: bootData.notifications || []
          };
          localStorage.setItem('orbit-crm-demo', JSON.stringify(window.state));
        }

        window.page = 'Dashboard';
        if (typeof window.render === 'function') {
          window.render();
        }
      } catch (err) {
        console.error('Login network error:', err);
        if (typeof window.toast === 'function') {
          window.toast('Cannot reach the server. Retry');
        }
      }
    }
  }, true);

  // Sync demo accounts dynamically if available
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await apiFetch('/auth/demo-accounts');
      if (res.ok) {
        const demos = await res.json();
        const demoEl = document.querySelector('.demo');
        if (demoEl && Array.isArray(demos)) {
          const formatted = demos.map(a => `${a.role}${a.department ? ' · ' + a.department : ''}: <b>${a.id}</b> / ${a.password}`).join('<br>');
          demoEl.innerHTML = `<b>Demo accounts</b><br>${formatted}`;
        }
      }
    } catch (_) {}
  });
})();
