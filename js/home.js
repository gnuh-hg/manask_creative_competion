import * as utils from '../utils.js';

document.addEventListener('DOMContentLoaded', function() {
    if (utils.TEST) return;
    const token = localStorage.getItem('access_token');
    if (!token) window.location.href = '/pages/login.html';
});