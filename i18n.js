// i18n.js
const STORAGE_KEY = 'lang';

let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';
let translations = {};
let LANGS = {};

export async function initI18n() {
    if (Object.keys(LANGS).length === 0) {
        const base = new URL('./locales/', import.meta.url).href;
        const [en, vi] = await Promise.all([
            fetch(base + 'en.json').then(r => r.json()),
            fetch(base + 'vi.json').then(r => r.json()),
        ]);
        LANGS = { en, vi };
    }
    translations = LANGS[currentLang];
    applyDOM();
}

export function t(key, vars = {}) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], translations);
    if (!value) {
        console.warn(`[i18n] Missing key: "${key}" (${currentLang})`);
        return key;
    }
    return Object.entries(vars).reduce(
        (str, [k, v]) => str.replaceAll(`{{${k}}}`, v),
        value
    );
}

function applyDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const val = t(el.getAttribute('data-i18n'));
        if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const val = t(el.getAttribute('data-i18n-placeholder'));
        if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const val = t(el.getAttribute('data-i18n-title'));
        if (val) el.title = val;
    });
    document.documentElement.lang = currentLang;
}

export function setLang(lang) {
    if (!(lang in LANGS) || lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    translations = LANGS[lang];
    applyDOM();

    window.dispatchEvent(new CustomEvent('langChanged', { detail: lang }));
}

export function getLang() { return currentLang; }