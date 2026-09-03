// === Auth Page Logic ===
(function () {
  const user = getUser();
  const token = getToken();
  if (token && user) redirectByRole(user.role);
})();

function redirectByRole(role) {
  if (role === 'admin') window.location.href = '/pages/admin.html';
  else window.location.href = '/pages/student.html';
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('registerForm').classList.toggle('active', tab === 'register');
}

function toggleAdminCode() {
  const role = document.getElementById('regRole').value;
  document.getElementById('adminCodeGroup').classList.toggle('hidden', role !== 'admin');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in...';
  document.getElementById('loginError').classList.add('hidden');
  try {
    const data = await authAPI.login({
      email:    document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value,
    });
    setAuth(data.token, data.user);
    btn.querySelector('span').textContent = '✓ Success!';
    setTimeout(() => redirectByRole(data.user.role), 500);
  } catch (err) {
    const el = document.getElementById('loginError');
    el.textContent = err.message;
    el.classList.remove('hidden');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Creating account...';
  document.getElementById('registerError').classList.add('hidden');
  document.getElementById('registerSuccess').classList.add('hidden');
  try {
    const role = document.getElementById('regRole').value;
    const data = await authAPI.register({
      name:           document.getElementById('regName').value.trim(),
      email:          document.getElementById('regEmail').value.trim(),
      password:       document.getElementById('regPassword').value,
      roomNumber:     document.getElementById('regRoom').value.trim(),
      foodPreference: document.getElementById('regFoodPref').value,
      role,
      adminCode: role === 'admin' ? document.getElementById('adminCode').value : undefined,
    });
    const successEl = document.getElementById('registerSuccess');
    successEl.textContent = 'Account created! Redirecting...';
    successEl.classList.remove('hidden');
    setAuth(data.token, data.user);
    setTimeout(() => redirectByRole(data.user.role), 800);
  } catch (err) {
    const el = document.getElementById('registerError');
    el.textContent = err.message;
    el.classList.remove('hidden');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create Account';
  }
}
