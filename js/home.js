import * as utils from '../utils.js';
import { t, initI18n } from '../../i18n.js';

document.addEventListener('DOMContentLoaded', async function() {
    await initI18n();
    if (utils.TEST) return;
    const token = localStorage.getItem('access_token');
    if (!token) window.location.href = '/pages/login.html';
});