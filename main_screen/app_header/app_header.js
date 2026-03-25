document.addEventListener('DOMContentLoaded', function() {
    // ========== STATE ==========
    let currentUser = {
        username: 'Guest',
        email: 'guest@example.com'
    };

    // ========== DOM ELEMENTS ==========
    const userProfile = document.getElementById('userProfile');
    const profileDropdown = document.getElementById('profileDropdown');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');
    const nameInput = document.getElementById('nameInput');
    const btnSaveName = document.getElementById('btnSaveName');
    const btnCancelName = document.getElementById('btnCancelName');
    const btnLogout = document.getElementById('btnLogout');

    // Password elements
    const passwordHeader = document.getElementById('passwordHeader');
    const passwordContent = document.getElementById('passwordContent');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const btnSavePassword = document.getElementById('btnSavePassword');
    const btnCancelPassword = document.getElementById('btnCancelPassword');
    const toggleCurrent = document.getElementById('toggleCurrent');
    const toggleNew = document.getElementById('toggleNew');
    const toggleConfirm = document.getElementById('toggleConfirm');

    // ========== FETCH USER DATA ==========
    async function fetchUserData() {
        try {
            if (Config.TEST) {
                // Test data
                currentUser = {
                    username: 'Admin Taskora',
                    email: 'admin.taskora@example.com'
                };
                updateUI();
                return;
            }
            const response = await Config.fetchWithAuth(`${Config.URL_API}/account`);
            if (!response.ok) 
                throw new Error('Failed to fetch user data');
            currentUser = await response.json();
            updateUI();
        } catch (error) {
            console.error('Error fetching user data:', error);
            usernameDisplay.textContent = 'Error';
        }
    }

    // ========== UPDATE UI ==========
    function updateUI() {
        usernameDisplay.textContent = currentUser.username || 'User';
        dropdownName.textContent = currentUser.username || 'User';
        dropdownEmail.textContent = currentUser.email || 'No email';
        nameInput.value = currentUser.username || '';
    }

    // ========== TOGGLE DROPDOWN ==========
    userProfile.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = profileDropdown.classList.contains('active');
        
        if (isActive) closeDropdown();
        else openDropdown();
    });

    function openDropdown() {
        profileDropdown.classList.add('active');
        userProfile.classList.add('active');
    }

    function closeDropdown() {
        profileDropdown.classList.remove('active');
        userProfile.classList.remove('active');
    }

    // ========== CLOSE ON OUTSIDE CLICK ==========
    document.addEventListener('click', function(e) {
        if (!profileDropdown.contains(e.target) && !userProfile.contains(e.target)) {
            closeDropdown();
        }
    });

    // Prevent dropdown click from closing
    profileDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // ========== SAVE NAME ==========
    btnSaveName.addEventListener('click', async function() {
        const newName = nameInput.value.trim();
        
        if (!newName) {
            Config.showWarning('Please enter a name');
            return;
        }
        try {
            if (Config.TEST) {
                // Test mode - just update locally
                currentUser.username = newName;
                updateUI();
                Config.showWarning('Name updated successfully!');
                return;
            }
            const response = await Config.fetchWithAuth(`${Config.URL_API}/account`, {
                method: 'PATCH',
                body: JSON.stringify({ username: newName })
            });
            if (!response.ok) {
                throw new Error('Failed to update name');
            }
            currentUser.username = newName;
            updateUI();
            Config.showWarning('Name updated successfully!');
        } catch (error) {
            console.error('Error updating name:', error);
            Config.showWarning('Failed to update name');
        }
    });

    // Cancel name change
    btnCancelName.addEventListener('click', function() {
        nameInput.value = currentUser.username || '';
    });

    // ========== PASSWORD SECTION TOGGLE ==========
    passwordHeader.addEventListener('click', function() {
        const isActive = passwordContent.classList.contains('active');
        
        if (isActive) {
            passwordContent.classList.remove('active');
            passwordHeader.classList.remove('active');
        } else {
            passwordContent.classList.add('active');
            passwordHeader.classList.add('active');
        }
    });

    // ========== PASSWORD TOGGLE VISIBILITY ==========
    function togglePasswordVisibility(input, icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            input.type = 'password';
            icon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    }

    toggleCurrent.addEventListener('click', function() {
        togglePasswordVisibility(currentPassword, toggleCurrent);
    });

    toggleNew.addEventListener('click', function() {
        togglePasswordVisibility(newPassword, toggleNew);
    });

    toggleConfirm.addEventListener('click', function() {
        togglePasswordVisibility(confirmPassword, toggleConfirm);
    });

    // ========== CHANGE PASSWORD ==========
    btnSavePassword.addEventListener('click', async function() {
        const current = currentPassword.value;
        const newPass = newPassword.value;
        const confirm = confirmPassword.value;
        // Validation
        if (!current || !newPass || !confirm) {
            showWarning('Please fill in all password fields');
            return;
        }
        if (newPass.length < 6) {
            showWarning('New password must be at least 6 characters');
            return;
        }
        if (newPass !== confirm) {
            showWarning('New passwords do not match');
            return;
        }
        try {
            if (Config.TEST) {
                // Test mode - just show success
                showWarning('Password changed successfully!');
                currentPassword.value = '';
                newPassword.value = '';
                confirmPassword.value = '';
                passwordContent.classList.remove('active');
                passwordHeader.classList.remove('active');
                return;
            }

            const response = await Config.fetchWithAuth(`${Config.URL_API}/account/password`, {
                method: 'PATCH',
                body: JSON.stringify({
                    current_password: current,
                    new_password: newPass,
                    confirm_password: confirm
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to change password');
            }
            
            Config.showWarning('Password changed successfully!');
            currentPassword.value = '';
            newPassword.value = '';
            confirmPassword.value = '';
            passwordContent.classList.remove('active');
            passwordHeader.classList.remove('active');
        } catch (error) {
            console.error('Error changing password:', error);
            Config.showWarning('Failed to change password');
        }
    });

    // Cancel password change
    btnCancelPassword.addEventListener('click', function() {
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
        passwordContent.classList.remove('active');
        passwordHeader.classList.remove('active');
    });

    // ========== LOGOUT ==========
    btnLogout.addEventListener('click', function() {
        localStorage.removeItem('access_token');
        window.location.href = './account/login.html';
    });

    // ========== INITIALIZE ==========
    fetchUserData();
});