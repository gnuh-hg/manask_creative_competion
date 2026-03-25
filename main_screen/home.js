document.addEventListener('DOMContentLoaded', function() {
    if (Config.TEST) return;
    const token = localStorage.getItem('access_token');
    if (!token) window.location.href = './account/login.html';
});