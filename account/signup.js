document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const name_input = document.querySelector('.user-name input');
    const email_input = document.querySelector('.user-email input');
    const password_input = document.querySelector('.user-password input');
    const warning = document.querySelector('.warning');
    const signup_btn = document.querySelector('.signup');
    const toggle_password_btn = document.querySelector('.toggle-password');
    const password_strength = document.querySelector('.password-strength');
    const strength_fill = document.querySelector('.strength-fill');
    const strength_text = document.querySelector('.strength-text');

    // Toggle password visibility
    if (toggle_password_btn) {
        toggle_password_btn.addEventListener('click', function() {
            const type = password_input.type === 'password' ? 'text' : 'password';
            password_input.type = type;
            
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

    // Password strength checker
    function checkPasswordStrength(password) {
        if (!password) {
            password_strength.classList.remove('active');
            return null;
        }

        password_strength.classList.add('active');

        let strength = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };

        // Calculate strength
        if (checks.length) strength += 20;
        if (checks.lowercase) strength += 20;
        if (checks.uppercase) strength += 20;
        if (checks.numbers) strength += 20;
        if (checks.special) strength += 20;

        // Update UI
        strength_fill.className = 'strength-fill';
        strength_text.className = 'strength-text';

        if (strength < 40) {
            strength_fill.classList.add('weak');
            strength_text.classList.add('weak');
            strength_text.textContent = 'Weak password';
            return 'weak';
        } else if (strength < 80) {
            strength_fill.classList.add('medium');
            strength_text.classList.add('medium');
            strength_text.textContent = 'Medium password';
            return 'medium';
        } else {
            strength_fill.classList.add('strong');
            strength_text.classList.add('strong');
            strength_text.textContent = 'Strong password';
            return 'strong';
        }
    }

    // Update password strength on input
    password_input.addEventListener('input', function() {
        checkPasswordStrength(this.value);
        if (warning.innerHTML) {
            warning.innerHTML = '';
        }
    });

    // Clear warning when user types
    name_input.addEventListener('input', function() {
        if (warning.innerHTML) {
            warning.innerHTML = '';
        }
        this.classList.remove('error');
    });

    email_input.addEventListener('input', function() {
        if (warning.innerHTML) {
            warning.innerHTML = '';
        }
        this.classList.remove('error');
    });

    // Validation functions
    function validateUsername(username) {
        if (!username || username.length < 3) {
            return { valid: false, message: "Username must be at least 3 characters long" };
        }
        if (username.length > 30) {
            return { valid: false, message: "Username must not exceed 30 characters" };
        }
        return { valid: true };
    }

    function validateEmail(email) {
        if (!email) {
            return { valid: false, message: "Please enter your email" };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, message: "Invalid email address" };
        }
        return { valid: true };
    }

    function validatePassword(password) {
        if (!password) {
            return { valid: false, message: "Please enter your password" };
        }
        if (password.length < 6) {
            return { valid: false, message: "Password must be at least 6 characters long" };
        }
        return { valid: true };
    }

    // Handle Enter key press
    const handleEnterKey = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            signup_btn.click();
        }
    };

    name_input.addEventListener('keypress', handleEnterKey);
    email_input.addEventListener('keypress', handleEnterKey);
    password_input.addEventListener('keypress', handleEnterKey);

    // Signup button click handler
    signup_btn.addEventListener('click', async function (e) {
        e.preventDefault();

        // Prevent double submission
        if (signup_btn.classList.contains('loading')) {
            return;
        }

        const username = name_input.value.trim();
        const email = email_input.value.trim();
        const password = password_input.value.trim();

        // Clear previous error states
        name_input.classList.remove('error');
        email_input.classList.remove('error');
        password_input.classList.remove('error');
        warning.classList.remove('success');

        // Validate all fields
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            warning.innerHTML = usernameValidation.message;
            name_input.classList.add('error');
            name_input.focus();
            return;
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            warning.innerHTML = emailValidation.message;
            email_input.classList.add('error');
            email_input.focus();
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            warning.innerHTML = passwordValidation.message;
            password_input.classList.add('error');
            password_input.focus();
            return;
        }

        // Warn if password is weak
        const passwordStrength = checkPasswordStrength(password);
        if (passwordStrength === 'weak') {
            warning.innerHTML = "⚠ Weak password. Are you sure you want to continue?";
            // Allow user to continue anyway, just warning
        }

        // Add loading state - text becomes transparent, spinner shows
        const originalText = signup_btn.innerHTML;
        signup_btn.classList.add('loading');
        signup_btn.style.pointerEvents = 'none';
        warning.innerHTML = '';

        const signUpData = {
            username: username,
            email: email,
            password: password
        };

        try {
            const response = await Config.fetchWithRetry(`${Config.URL_API}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(signUpData),
            });

            const data = await response.json();

            if (response.ok) {
                // Success - remove loading class, show success text
                signup_btn.classList.remove('loading');
                signup_btn.innerHTML = '✓ SUCCESS';
                warning.innerHTML = 'Sign up successful!';
                warning.classList.add('success');
                localStorage.setItem('access_token', data.access_token);
                
                // Delay redirect for better UX
                setTimeout(() => {
                    window.location.href = "../index.html";
                }, 800);
            } else {
                // Error from server
                let errorMessage = "Sign up failed";
                
                // Handle different error formats
                if (Array.isArray(data.detail)) {
                    errorMessage = data.detail[0].msg || data.detail[0];
                } else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                } else {
                    errorMessage = data.message || errorMessage;
                }

                warning.innerHTML = errorMessage;

                // Highlight relevant input based on error
                if (errorMessage.toLowerCase().includes('email')) {
                    email_input.classList.add('error');
                } else if (errorMessage.toLowerCase().includes('username')) {
                    name_input.classList.add('error');
                } else if (errorMessage.toLowerCase().includes('password')) {
                    password_input.classList.add('error');
                }
                
                // Remove loading state and restore button
                signup_btn.classList.remove('loading');
                signup_btn.style.pointerEvents = 'auto';
                signup_btn.innerHTML = originalText;
            }

        } catch (error) {
            console.error('Connection error:', error);
            warning.innerHTML = "Cannot connect to server! Please try again";
            
            // Remove loading state and restore button
            signup_btn.classList.remove('loading');
            signup_btn.style.pointerEvents = 'auto';
            signup_btn.innerHTML = originalText;
        }
    });

    // Auto-focus first input on load
    if (name_input) {
        setTimeout(() => name_input.focus(), 100);
    }
});