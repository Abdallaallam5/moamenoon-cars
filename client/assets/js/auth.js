/**
 * auth.js
 * -----------------------------------------------------------------------
 * Handles: login form submit, register form submit, logout, updating the
 * navbar to reflect logged-in state, and the profile page's tabs/forms.
 * Relies on the global `api` object from api.js.
 * -----------------------------------------------------------------------
 */

(function () {
  // ---------------- Redirect helper ----------------
  function redirectTo(path) {
    window.location.href = path;
  }

  // ---------------- LOGIN FORM ----------------
  function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const errorBox = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    // Toggle password visibility
    const toggleBtn = document.getElementById('toggleLoginPassword');
    const passwordInput = document.getElementById('loginPassword');
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        toggleBtn.querySelector('i').className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submitBtn.disabled = true;

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await api.post('/auth/login', { email, password });
        api.setToken(res.token);
        api.setUser(res.data);
        redirectTo(res.data.role === 'admin' ? 'dashboard.html' : 'profile.html');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------- REGISTER FORM ----------------
  function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const errorBox = document.getElementById('registerError');
    const submitBtn = document.getElementById('registerSubmitBtn');

    const toggleBtn = document.getElementById('toggleRegisterPassword');
    const passwordInput = document.getElementById('registerPassword');
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        toggleBtn.querySelector('i').className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submitBtn.disabled = true;

      const payload = {
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        phone: document.getElementById('registerPhone').value.trim(),
        password: document.getElementById('registerPassword').value,
      };

      try {
        const res = await api.post('/auth/register', payload);
        api.setToken(res.token);
        api.setUser(res.data);
        redirectTo('profile.html');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------- NAVBAR AUTH STATE ----------------
  function syncNavbarAuthState() {
    const loginBtn = document.getElementById('navLoginBtn') || document.querySelector('.navbar__actions a[href="login.html"]');
    const registerBtn = document.getElementById('navRegisterBtn') || document.querySelector('.navbar__actions a[href="register.html"]');

    if (!api.isLoggedIn()) return; // leave default guest buttons as-is

    const user = api.getUser();
    if (!user) return;

    if (loginBtn) {
      loginBtn.textContent = user.name.split(' ')[0];
      loginBtn.href = user.role === 'admin' ? 'dashboard.html' : 'profile.html';
    }
    if (registerBtn) {
      registerBtn.textContent = 'Log Out';
      registerBtn.href = '#';
      registerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }
  }

  function logout() {
    api.clearToken();
    api.clearUser();
    redirectTo('index.html');
  }

  // ---------------- LOGOUT BUTTON (profile/dashboard pages) ----------------
  function initLogoutButton() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', logout);
  }

  // ---------------- ROUTE GUARDS ----------------
  function guardProfilePage() {
    if (!document.body.classList.contains('page-profile')) return;
    if (!api.isLoggedIn()) {
      redirectTo('login.html');
      return;
    }
    populateProfile();
  }

  function guardDashboardPage() {
    if (!document.body.classList.contains('page-dashboard')) return;
    const user = api.getUser();
    if (!api.isLoggedIn() || !user || user.role !== 'admin') {
      redirectTo('login.html');
    }
  }

  // ---------------- PROFILE PAGE: populate + tabs + forms ----------------
  async function populateProfile() {
    const user = api.getUser();
    if (!user) return;

    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const roleEl = document.getElementById('profileRole');
    const avatarEl = document.getElementById('profileAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (roleEl) roleEl.textContent = user.role;
    if (avatarEl) avatarEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=C1121F&color=fff`;

    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const cityInput = document.getElementById('profileCityInput');
    const countryInput = document.getElementById('profileCountryInput');
    if (nameInput) nameInput.value = user.name || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (cityInput) cityInput.value = (user.location && user.location.city) || '';
    if (countryInput) countryInput.value = (user.location && user.location.country) || '';

    // Tabs
    document.querySelectorAll('.profile-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.profile-nav-btn').forEach((b) => b.classList.remove('is-active'));
        document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('is-active'));
        btn.classList.add('is-active');
        document.getElementById(btn.dataset.target).classList.add('is-active');
      });
    });

    // Info form
    const infoForm = document.getElementById('profileInfoForm');
    if (infoForm) {
      infoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const res = await api.put('/auth/profile', {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            location: { city: cityInput.value.trim(), country: countryInput.value.trim() },
          });
          api.setUser(res.data);
          alert('Profile updated successfully');
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const res = await api.put('/auth/password', {
            currentPassword: document.getElementById('currentPasswordInput').value,
            newPassword: document.getElementById('newPasswordInput').value,
          });
          api.setToken(res.token);
          alert('Password updated successfully');
          passwordForm.reset();
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // My listings
    loadMyListings();
    loadMyMessages();
  }

  async function loadMyListings() {
    const container = document.getElementById('myListingsTable');
    if (!container) return;
    try {
      const res = await api.get('/vehicles/my-listings');
      if (res.data.length === 0) {
        container.innerHTML = `<p class="text-muted">You haven't listed any vehicles yet.</p>`;
        return;
      }
      container.innerHTML = `
        <table>
          <thead><tr><th>Vehicle</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${res.data
              .map(
                (v) => `
              <tr>
                <td><a href="vehicle-details.html?id=${v._id}">${v.title}</a></td>
                <td>${v.price} ${v.currency}</td>
                <td><span class="badge badge--${v.status}">${v.status}</span></td>
                <td class="table-actions"><button onclick="location.href='vehicle-details.html?id=${v._id}'"><i class="fa-solid fa-eye"></i></button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    } catch (err) {
      container.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  async function loadMyMessages() {
    const container = document.getElementById('messagesList');
    if (!container) return;
    try {
      const res = await api.get('/messages/inbox');
      if (res.data.length === 0) {
        container.innerHTML = `<p class="text-muted">No messages yet.</p>`;
        return;
      }
      container.innerHTML = res.data
        .map(
          (m) => `
        <div class="details-card">
          <strong>${m.sender ? m.sender.name : m.name}</strong> — <span class="text-muted">${m.vehicle ? m.vehicle.title : ''}</span>
          <p>${m.content}</p>
        </div>`
        )
        .join('');
    } catch (err) {
      container.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initRegisterForm();
    initLogoutButton();
    syncNavbarAuthState();
    guardProfilePage();
    guardDashboardPage();
  });

  window.moamenoonAuth = { logout };
})();
