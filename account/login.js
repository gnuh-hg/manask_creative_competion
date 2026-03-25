document.addEventListener('DOMContentLoaded', function() {
    const email_input = document.querySelector('.user-email input');
    const password_input = document.querySelector('.user-password input');
    const warning = document.querySelector('.warning');
    const login_btn = document.querySelector('.login');
    const toggle_password_btn = document.querySelector('.toggle-password');

    // Toggle password visibility
    if (toggle_password_btn) {
        toggle_password_btn.addEventListener('click', function() {
            const type = password_input.type === 'password' ? 'text' : 'password';
            password_input.type = type;
            
            // Update icon
            const eyeIcon = toggle_password_btn.querySelector('.eye-icon');
            if (type === 'text') {
                // Eye with slash (password visible)
                eyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                // Normal eye (password hidden)
                eyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }

    // Clear warning when user types
    email_input.addEventListener('input', function() {
        if (warning.innerHTML) {
            warning.innerHTML = '';
        }
    });

    password_input.addEventListener('input', function() {
        if (warning.innerHTML) {
            warning.innerHTML = '';
        }
    });

    // Handle Enter key press
    const handleEnterKey = function(e) {
        if (e.key === 'Enter') {
            login_btn.click();
        }
    };

    email_input.addEventListener('keypress', handleEnterKey);
    password_input.addEventListener('keypress', handleEnterKey);

    // Login button click handler
    login_btn.addEventListener('click', async function (e) {
        e.preventDefault();

        // Prevent double submission
        if (login_btn.classList.contains('loading')) return;

        const email = email_input.value.trim();
        const password = password_input.value.trim();

        // Validation
        if (!email || !password) {
            warning.innerHTML = "Please enter all required information";
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            warning.innerHTML = "Invalid email address";
            return;
        }

        // Add loading state - text becomes transparent, spinner shows
        const originalText = login_btn.innerHTML;
        login_btn.classList.add('loading');
        login_btn.style.pointerEvents = 'none';
        warning.innerHTML = '';

        const loginData = {
            email: email,
            password: password
        };

        try {
            const response = await Config.fetchWithRetry(`${Config.URL_API}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
            });

            const data = await response.json();

            if (response.ok) {
                // Success - remove loading class, show success text
                login_btn.classList.remove('loading');
                login_btn.innerHTML = '✓ SUCCESS';
                localStorage.setItem('access_token', data.access_token);
                
                // Delay redirect for better UX
                setTimeout(() => {
                    window.location.href = "../index.html";
                }, 500);
            } else {
                // Error from server
                warning.innerHTML = data.detail || "Login failed";
                
                // Remove loading state and restore button
                login_btn.classList.remove('loading');
                login_btn.style.pointerEvents = 'auto';
                login_btn.innerHTML = originalText;
            }

        } catch (error) {
            console.error('Error:', error);
            warning.innerHTML = "Connection error! Please try again";
            
            // Remove loading state and restore button
            login_btn.classList.remove('loading');
            login_btn.style.pointerEvents = 'auto';
            login_btn.innerHTML = originalText;
        }
    });
});