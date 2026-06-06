const form = document.getElementById('loginForm');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const modeBtn = document.getElementById('modeBtn');
const statusMsg = document.getElementById('statusMsg');
const usernameInp = document.getElementById('username');
const passwordInp = document.getElementById('password');

let mode = 'login';

function renderMode() {
  const isLogin = mode === 'login';
  formTitle.textContent = isLogin ? 'Login' : 'Signup';
  submitBtn.textContent = isLogin ? 'Login' : 'Signup';
  modeBtn.textContent = isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in';
  statusMsg.textContent = '';
}

modeBtn.addEventListener('click', () => {
  mode = mode === 'login' ? 'signup' : 'login';
  renderMode();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userName = usernameInp.value.trim();
  const password = passwordInp.value;

  if (!userName || !password) {
    statusMsg.textContent = 'Username and password are required.';
    return;
  }

  const endpoint = mode === 'login' ? '/api/login' : '/api/signup';

  try {
    statusMsg.textContent = 'Please wait...';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userName, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('userName', data.user.userName);
    window.location.href = '/';
  } catch (error) {
    statusMsg.textContent = error.message;
  }
});

renderMode();
