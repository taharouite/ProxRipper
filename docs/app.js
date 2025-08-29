const proxyFiles = {
    http: 'https://raw.githubusercontent.com/mohammedcha/ProxRipper/main/full_proxies/http.txt',
    https: 'https://raw.githubusercontent.com/mohammedcha/ProxRipper/main/full_proxies/https.txt',
    socks4: 'https://raw.githubusercontent.com/mohammedcha/ProxRipper/main/full_proxies/socks4.txt',
    socks5: 'https://raw.githubusercontent.com/mohammedcha/ProxRipper/main/full_proxies/socks5.txt',
};

let allProxies = { http: [], https: [], socks4: [], socks5: [] };
let filteredProxies = { http: [], https: [], socks4: [], socks5: [] };
let currentTab = 'http';
let currentPages = { http: 1, https: 1, socks4: 1, socks5: 1 };
let ipLocationData = [];
const PROXIES_PER_PAGE = 50;
const ipLookupCache = new Map();

function updateStats() {
    document.getElementById('http-count').textContent = allProxies.http.length;
    document.getElementById('https-count').textContent = allProxies.https.length;
    document.getElementById('socks4-count').textContent = allProxies.socks4.length;
    document.getElementById('socks5-count').textContent = allProxies.socks5.length;
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

async function loadIpLocationData() {
    try {
        const response = await fetch('data/IP2LOCATION.json');
        ipLocationData = response.ok ? await response.json() : [];
    } catch {
        ipLocationData = [];
    }
}

function isValidIPv4(ip) {
    const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!regex.test(ip)) return false;
    const octets = ip.split('.').map(Number);
    return octets.every(octet => octet >= 0 && octet <= 255);
}

function ipToNumber(ip) {
    if (!isValidIPv4(ip)) return 0;
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function getCountryData(ip) {
    if (ipLookupCache.has(ip)) return ipLookupCache.get(ip);
    if (!ipLocationData.length) return { code: '-', country: 'Unknown' };
    const ipNum = ipToNumber(ip);
    let low = 0, high = ipLocationData.length - 1, entry = null;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const current = ipLocationData[mid];
        const start = parseInt(current.start), end = parseInt(current.end);
        if (ipNum >= start && ipNum <= end) {
            entry = current;
            break;
        } else if (ipNum < start) high = mid - 1;
        else low = mid + 1;
    }
    const result = entry ? { code: entry.code, country: entry.country } : { code: '-', country: 'Unknown' };
    ipLookupCache.set(ip, result);
    return result;
}

function renderProxies(type, proxies) {
    const list = document.getElementById(type);
    list.innerHTML = '';
    const currentPage = currentPages[type];
    const start = (currentPage - 1) * PROXIES_PER_PAGE;
    const end = start + PROXIES_PER_PAGE;
    const paginatedProxies = proxies.slice(start, end);
    const totalPages = Math.ceil(proxies.length / PROXIES_PER_PAGE);
    updatePaginationControls(currentPage, totalPages);

    if (!paginatedProxies.length) {
        list.innerHTML = `<li class="text-gray-400 p-4 text-center">${
            document.getElementById('search').value ? 'No matching proxies' : 'No proxies available'
        }</li>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    paginatedProxies.forEach(proxy => {
        const ip = proxy.includes(':') ? proxy.split(':')[0] : proxy;
        const { code, country } = getCountryData(ip);
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-all duration-200 shadow-card hover:shadow-card-hover';
        li.setAttribute('role', 'listitem');
        li.innerHTML = `
        <div class="flex items-center space-x-3">
            ${code && code !== '-' ? `<span class="flag-icon flag-icon-${code.toLowerCase()} w-6 h-4"></span>` : ''}
            <span class="text-gray-100 font-mono text-sm sm:text-base">${proxy}</span>
            <span class="text-gray-400 text-sm">(${country}, ${code})</span>
        </div>
        <div class="relative inline-block text-left">
            <button type="button" class="px-2 py-1 text-gray-200 font-medium rounded-md bg-neutral-700 hover:bg-neutral-600 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all duration-200 flex items-center gap-1 text-sm" id="options-menu-${proxy}" aria-haspopup="true" aria-expanded="false">
                Actions
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div class="origin-top-right absolute right-0 mt-2 w-48 bg-neutral-800 rounded-lg shadow-dropdown animate-dropdown-open ring-1 ring-black ring-opacity-5 hidden z-10" role="menu" aria-orientation="vertical" aria-labelledby="options-menu-${proxy}">
                <div class="py-1" role="none">
                    <button class="copy-btn w-full px-4 py-2 text-left text-gray-100 hover:bg-primary-700 hover:text-white transition-all duration-200 flex items-center gap-2 rounded-lg" data-url="${proxy}" title="Copy proxy to clipboard" role="menuitem">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                        <span class="btn-text">Copy</span>
                    </button>
                    <button class="download-btn w-full px-4 py-2 text-left text-gray-100 hover:bg-primary-700 hover:text-white transition-all duration-200 flex items-center gap-2 rounded-lg" data-url="${proxy}" data-type="${type}" title="Download proxy as text file" role="menuitem">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        <span class="btn-text">Download</span>
                    </button>
                </div>
            </div>
        </div>
        `;
        fragment.appendChild(li);
    });

    list.appendChild(fragment);
}

function updatePaginationControls(currentPage, totalPages) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

async function loadProxies() {
    const loading = document.getElementById('page-loader');
    loading.classList.remove('hidden');
    await loadIpLocationData();

    for (const [type, url] of Object.entries(proxyFiles)) {
        try {
            const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            const text = await response.text();
            allProxies[type] = text.split('\n').filter(line => line.trim());
            filteredProxies[type] = allProxies[type];
        } catch {
            document.getElementById(type).innerHTML = `<li class="text-red-500 p-4 text-center">Failed to load ${type} proxies</li>`;
        }
    }

    updateStats();
    renderProxies(currentTab, filteredProxies[currentTab]);
    loading.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => loading.remove(), 500);
}

function setupEventListeners() {
    const proxyContent = document.getElementById('proxy-content');
    const actionDropdownBtn = document.getElementById('action-dropdown-btn');
    const actionDropdownMenu = document.getElementById('action-dropdown');
    const searchInput = document.getElementById('search');
    const copyAllBtn = document.getElementById('copy-all');
    const downloadAllBtn = document.getElementById('download-all');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'text-white', 'bg-primary-700'));
            btn.classList.add('active', 'text-white', 'bg-primary-700');
            document.querySelectorAll('.proxy-list').forEach(list => list.classList.add('hidden'));
            document.getElementById(currentTab).classList.remove('hidden');
            searchInput.value = '';
            filteredProxies[currentTab] = allProxies[currentTab];
            currentPages[currentTab] = 1;
            renderProxies(currentTab, filteredProxies[currentTab]);
        });
    });

    proxyContent.addEventListener('click', event => {
        const dropdownBtn = event.target.closest('[id^="options-menu-"]');
        const copyBtn = event.target.closest('.copy-btn');
        const downloadBtn = event.target.closest('.download-btn');

        if (dropdownBtn) {
            const parent = dropdownBtn.closest('.relative');
            const menu = parent.querySelector('[role="menu"]');
            document.querySelectorAll('.proxy-list [role="menu"]').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
            menu.classList.toggle('hidden');
            return;
        }

        if (copyBtn) {
            const textSpan = copyBtn.querySelector('.btn-text');
            const originalText = textSpan.textContent;
            navigator.clipboard.writeText(copyBtn.dataset.url).then(() => {
                textSpan.textContent = 'Copied';
                setTimeout(() => textSpan.textContent = originalText, 1500);
            });
            return;
        }

        if (downloadBtn) {
            const textSpan = downloadBtn.querySelector('.btn-text');
            const originalText = textSpan.textContent;
            const blob = new Blob([downloadBtn.dataset.url], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${downloadBtn.dataset.type}_proxy_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
            textSpan.textContent = 'Downloaded';
            setTimeout(() => textSpan.textContent = originalText, 1500);
            return;
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.relative')) {
            document.querySelectorAll('.proxy-list [role="menu"]').forEach(menu => menu.classList.add('hidden'));
        }
    });

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.toLowerCase();
        filteredProxies[currentTab] = allProxies[currentTab].filter(proxy => {
            const ip = proxy.includes(':') ? proxy.split(':')[0] : proxy;
            const { code, country } = getCountryData(ip);
            return proxy.toLowerCase().includes(query) || country.toLowerCase().includes(query) || code.toLowerCase().includes(query);
        });
        currentPages[currentTab] = 1;
        renderProxies(currentTab, filteredProxies[currentTab]);
    }, 300));

    actionDropdownBtn.addEventListener('click', () => actionDropdownMenu.classList.toggle('hidden'));
    document.addEventListener('click', e => { if (!actionDropdownBtn.contains(e.target) && !actionDropdownMenu.contains(e.target)) actionDropdownMenu.classList.add('hidden'); });

    copyAllBtn.addEventListener('click', async () => {
        const proxies = filteredProxies[currentTab];
        await navigator.clipboard.writeText(proxies.join('\n'));
        const textSpan = copyAllBtn.querySelector('.btn-text');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'Copied';
        setTimeout(() => textSpan.textContent = originalText, 1500);
    });

    downloadAllBtn.addEventListener('click', () => {
        const proxies = filteredProxies[currentTab];
        const blob = new Blob([proxies.join('\n')], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${currentTab}_proxies_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        const textSpan = downloadAllBtn.querySelector('.btn-text');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'Downloaded';
        setTimeout(() => textSpan.textContent = originalText, 1500);
    });

    prevBtn.addEventListener('click', () => {
        if (currentPages[currentTab] > 1) {
            currentPages[currentTab]--;
            renderProxies(currentTab, filteredProxies[currentTab]);
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredProxies[currentTab].length / PROXIES_PER_PAGE);
        if (currentPages[currentTab] < totalPages) {
            currentPages[currentTab]++;
            renderProxies(currentTab, filteredProxies[currentTab]);
        }
    });
}

document.getElementById('explore-btn').addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('#proxy-content').scrollIntoView({ behavior: 'smooth' });
});

const backToTopBtn = document.getElementById('back-to-top');
window.addEventListener('scroll', () => window.scrollY > 300 ? backToTopBtn.classList.remove('hidden') : backToTopBtn.classList.add('hidden'));
backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadProxies().then(() => document.querySelector('.tab-btn').click());
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Service Worker registered.', reg))
        .catch(err => console.log('Service Worker registration failed:', err));
    });
}

let deferredPrompt;

const installBtn = document.getElementById('install-btn');
const topBar = document.getElementById('top-bar');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    topBar.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    deferredPrompt = null;
    topBar.classList.add('hidden'); 
});
