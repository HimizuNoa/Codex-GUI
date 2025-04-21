window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('key');
  const saveBtn = document.getElementById('save');
  const errorEl = document.createElement('div');
  errorEl.id = 'error';
  errorEl.style.color = 'red';
  saveBtn.insertAdjacentElement('afterend', errorEl);
  const toggle = document.getElementById('toggle');
  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  saveBtn.addEventListener('click', async () => {
  console.log('[ONBOARDING] Save button clicked. Attempting to save key...');
    const key = input.value.trim();
    const result = await window.onboardAPI.saveKey(key);
    if (result.success) {
      window.onboardAPI.complete();
    } else {
      errorEl.innerText = result.error;
    }
  });
});