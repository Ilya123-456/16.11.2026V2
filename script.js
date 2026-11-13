(function () {
    'use strict';

    var SESSION_KEY = 'granfort_admin_session';
    var ADMIN_USER = 'admin';
    var ADMIN_PASS_B64 = 'MTIzNDU2Nzg='; // btoa('12345678')

    var body = document.body;
    var isAdminPage = !!(body && body.classList.contains('admin-page'));

    function isAuthed() {
        try {
            return sessionStorage.getItem(SESSION_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    if (isAdminPage) {
        if (!isAuthed()) {
            window.location.replace('index.html#login');
            return;
        }

        body.classList.add('is-auth-ready');

        window.addEventListener('pageshow', function (event) {
            if (event.persisted && !isAuthed()) {
                window.location.replace('index.html#login');
            }
        });
    }

    function initSite() {
        if (isAdminPage || !body) return;

        var mobileMenu = document.querySelector('.mobile-menu');

        if (mobileMenu) {
            mobileMenu.querySelectorAll('nav a').forEach(function (link) {
                link.addEventListener('click', function () {
                    mobileMenu.open = false;
                });
            });

            document.addEventListener('click', function (event) {
                if (mobileMenu.open && !mobileMenu.contains(event.target)) {
                    mobileMenu.open = false;
                }
            });
        }

        var revealItems = document.querySelectorAll(
            '.products__intro, .model, .advantages__feature, .advantages__list .advantage, .custom__content, .contacts__grid'
        );

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries, currentObserver) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        currentObserver.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.12,
                rootMargin: '0px 0px -35px 0px'
            });

            revealItems.forEach(function (item) {
                item.classList.add('js-reveal');
                observer.observe(item);
            });
        } else {
            revealItems.forEach(function (item) {
                item.classList.add('is-visible');
            });
        }

        initLogin();
    }

    function initLogin() {
        var loginModal = document.getElementById('login-modal');
        var loginForm = document.getElementById('login-form');
        var loginError = document.getElementById('login-error');
        var loginUser = document.getElementById('login-user');
        var loginPass = document.getElementById('login-pass');

        var lastFocused = null;

        function openLogin() {
            if (!loginModal) return;

            if (isAuthed()) {
                window.location.href = 'admin.html';
                return;
            }

            lastFocused = document.activeElement;
            loginModal.hidden = false;
            document.body.classList.add('has-modal');

            if (loginError) loginError.hidden = true;
            if (loginForm) loginForm.reset();

            window.setTimeout(function () {
                if (loginUser) loginUser.focus();
            }, 30);
        }

        function closeLogin() {
            if (!loginModal || loginModal.hidden) return;

            loginModal.hidden = true;
            document.body.classList.remove('has-modal');

            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        document.querySelectorAll('[data-login-open]').forEach(function (btn) {
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                var menu = btn.closest('.mobile-menu');
                if (menu) menu.open = false;
                openLogin();
            });
        });

        document.querySelectorAll('[data-login-close]').forEach(function (el) {
            el.addEventListener('click', closeLogin);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeLogin();
            }
        });

        if (loginForm) {
            loginForm.addEventListener('submit', function (event) {
                event.preventDefault();

                var user = loginUser ? loginUser.value.trim() : '';
                var pass = loginPass ? loginPass.value : '';

                var ok = false;
                try {
                    ok = user === ADMIN_USER && btoa(pass) === ADMIN_PASS_B64;
                } catch (e) {
                    ok = false;
                }

                if (ok) {
                    try {
                        sessionStorage.setItem(SESSION_KEY, '1');
                    } catch (e) { /* ignore */ }
                    window.location.href = 'admin.html';
                } else {
                    if (loginError) loginError.hidden = false;
                    if (loginPass) {
                        loginPass.value = '';
                        loginPass.focus();
                    }
                }
            });
        }

        if (window.location.hash === '#login') {
            openLogin();
        }
    }

    function initAdmin() {
        if (!isAdminPage) return;

        var STATUS_LABEL = { 'new': 'Новая', work: 'В работе', done: 'Завершена' };

        var state = {
            view: 'requests',
            filter: 'all',
            model: 'all',
            query: '',
            selectedId: null,
            requests: [] // заявок нет — список наполняется из формы на сайте
        };

        function $(id) { return document.getElementById(id); }

        var els = {
            title: $('page-title'),
            search: $('search'),
            exportBtn: $('export'),
            logout: $('logout'),
            navLinks: [].slice.call(document.querySelectorAll('[data-view]')),
            panels: [].slice.call(document.querySelectorAll('[data-view-panel]')),
            requestsBody: $('requests-body'),
            clientsBody: $('clients-body'),
            detail: $('detail'),
            chips: [].slice.call(document.querySelectorAll('[data-filter]')),
            modelSelect: $('model-filter'),
            requestsBadge: $('requests-badge'),
            clientsBadge: $('clients-badge'),
            statTotal: $('stat-total'),
            statNew: $('stat-new'),
            statWork: $('stat-work'),
            statDone: $('stat-done')
        };

        function escapeHtml(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
            });
        }

        function emptyRow(colspan, title, text) {
            return '<tr class="empty-row"><td colspan="' + colspan + '">' +
                '<strong>' + escapeHtml(title) + '</strong>' +
                '<p>' + escapeHtml(text) + '</p></td></tr>';
        }

        function getClients() {
            var map = Object.create(null);
            state.requests.forEach(function (r) {
                var key = r.phone || r.id;
                if (!map[key]) {
                    map[key] = { name: r.name, phone: r.phone || '', email: r.email || '', total: 0, active: 0 };
                }
                map[key].total += 1;
                if (r.status !== 'done') map[key].active += 1;
            });
            return Object.keys(map).map(function (k) { return map[k]; });
        }

        function matchesQuery(values) {
            var q = state.query.trim().toLowerCase();
            if (!q) return true;
            return values.join(' ').toLowerCase().indexOf(q) !== -1;
        }

        function filteredRequests() {
            return state.requests.filter(function (r) {
                if (state.filter !== 'all' && r.status !== state.filter) return false;
                if (state.model !== 'all' && r.car !== state.model) return false;
                return matchesQuery([r.name, r.phone, r.email, r.carLabel]);
            });
        }

        function filteredClients() {
            return getClients().filter(function (c) {
                return matchesQuery([c.name, c.phone, c.email]);
            });
        }

        function renderStats() {
            var counts = { all: state.requests.length, 'new': 0, work: 0, done: 0 };
            state.requests.forEach(function (r) {
                if (counts[r.status] !== undefined) counts[r.status] += 1;
            });
            if (els.statTotal) els.statTotal.textContent = counts.all;
            if (els.statNew) els.statNew.textContent = counts['new'];
            if (els.statWork) els.statWork.textContent = counts.work;
            if (els.statDone) els.statDone.textContent = counts.done;
        }

        function renderRequests() {
            if (!els.requestsBody) return;
            var rows = filteredRequests();

            if (state.requests.length === 0) {
                els.requestsBody.innerHTML = emptyRow(5, 'Заявок пока нет', 'Когда посетитель отправит форму на сайте, заявка появится в этом списке.');
            } else if (rows.length === 0) {
                els.requestsBody.innerHTML = emptyRow(5, 'Ничего не найдено', 'Измените поисковый запрос или сбросьте фильтры.');
            } else {
                els.requestsBody.innerHTML = rows.map(function (r) {
                    return '<tr data-id="' + escapeHtml(r.id) + '"' + (r.id === state.selectedId ? ' class="is-selected"' : '') + '>' +
                        '<td>#' + escapeHtml(r.id) + '</td>' +
                        '<td>' + escapeHtml(r.date) + '<br><span class="muted">' + escapeHtml(r.time) + '</span></td>' +
                        '<td><strong>' + escapeHtml(r.name) + '</strong><br><span class="muted">' + escapeHtml(r.phone) + '</span></td>' +
                        '<td>' + escapeHtml(r.carLabel) + '</td>' +
                        '<td><span class="status status--' + escapeHtml(r.status) + '">' + escapeHtml(STATUS_LABEL[r.status] || r.status) + '</span></td>' +
                        '</tr>';
                }).join('');
            }

            renderStats();
            renderDetail();
        }

        function renderClients() {
            if (!els.clientsBody) return;
            var list = filteredClients();

            if (list.length === 0) {
                els.clientsBody.innerHTML = state.requests.length === 0
                    ? emptyRow(5, 'Клиентов пока нет', 'Клиенты появятся автоматически после первой заявки с сайта.')
                    : emptyRow(5, 'Ничего не найдено', 'Измените поисковый запрос.');
            } else {
                els.clientsBody.innerHTML = list.map(function (c) {
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(c.name) + '</strong></td>' +
                        '<td>' + escapeHtml(c.phone) + '</td>' +
                        '<td>' + escapeHtml(c.email || '—') + '</td>' +
                        '<td>' + escapeHtml(c.total) + '</td>' +
                        '<td>' + escapeHtml(c.active) + '</td>' +
                        '</tr>';
                }).join('');
            }

            if (els.clientsBadge) els.clientsBadge.textContent = getClients().length;
        }

        function renderDetail() {
            if (!els.detail) return;
            var request = null;
            if (state.selectedId) {
                request = state.requests.filter(function (r) { return r.id === state.selectedId; })[0] || null;
            }

            if (!request) {
                els.detail.innerHTML =
                    '<div class="empty-state">' +
                    '<strong>Заявка не выбрана</strong>' +
                    '<p>Выберите заявку в списке, чтобы увидеть детали.</p>' +
                    '</div>';
                return;
            }

            els.detail.innerHTML =
                '<div class="detail__head">' +
                '<p class="eyebrow">ЗАЯВКА #' + escapeHtml(request.id) + '</p>' +
                '<span class="status status--' + escapeHtml(request.status) + '">' + escapeHtml(STATUS_LABEL[request.status] || request.status) + '</span>' +
                '</div>' +
                '<h2>' + escapeHtml(request.name) + '</h2>' +
                '<dl class="detail__list">' +
                '<div><dt>ТЕЛЕФОН</dt><dd>' + escapeHtml(request.phone) + '</dd></div>' +
                '<div><dt>ЭЛЕКТРОННАЯ ПОЧТА</dt><dd>' + escapeHtml(request.email || '—') + '</dd></div>' +
                '<div><dt>АВТОМОБИЛЬ</dt><dd>' + escapeHtml(request.carLabel) + '</dd></div>' +
                '<div><dt>ДАТА</dt><dd>' + escapeHtml(request.date) + ', ' + escapeHtml(request.time) + '</dd></div>' +
                '</dl>' +
                (request.message ? '<div class="detail__message"><p class="eyebrow">ЗАДАЧА</p><p>' + escapeHtml(request.message) + '</p></div>' : '') +
                '<div class="detail__actions">' +
                '<button class="btn btn--ghost" type="button" data-detail-close>Закрыть</button>' +
                '</div>';
        }

        function render() {
            if (els.requestsBadge) els.requestsBadge.textContent = state.requests.length;
            renderRequests();
            renderClients();
        }

        function setView(view) {
            state.view = view;
            state.selectedId = null;

            els.navLinks.forEach(function (link) {
                var active = link.getAttribute('data-view') === view;
                link.classList.toggle('is-active', active);
                if (active) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            els.panels.forEach(function (panel) {
                panel.hidden = panel.getAttribute('data-view-panel') !== view;
            });

            if (els.title) els.title.textContent = view === 'clients' ? 'Клиенты' : 'Заявки';

            if (els.search) {
                els.search.value = '';
                state.query = '';
                els.search.placeholder = view === 'clients'
                    ? 'Поиск по имени, телефону, e-mail'
                    : 'Поиск по имени, телефону, модели';
            }

            try {
                history.replaceState(null, '', view === 'clients' ? '#clients' : '#requests');
            } catch (e) { /* ignore */ }

            render();
        }

        els.navLinks.forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                setView(link.getAttribute('data-view') === 'clients' ? 'clients' : 'requests');
            });
        });

        els.chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                state.filter = chip.getAttribute('data-filter') || 'all';
                els.chips.forEach(function (other) {
                    other.classList.toggle('is-active', other === chip);
                });
                renderRequests();
            });
        });

        if (els.modelSelect) {
            els.modelSelect.addEventListener('change', function () {
                state.model = els.modelSelect.value;
                renderRequests();
            });
        }

        if (els.search) {
            els.search.addEventListener('input', function () {
                state.query = els.search.value;
                if (state.view === 'clients') {
                    renderClients();
                } else {
                    renderRequests();
                }
            });
        }

        if (els.requestsBody) {
            els.requestsBody.addEventListener('click', function (event) {
                var row = event.target.closest('tr[data-id]');
                if (!row) return;
                state.selectedId = row.getAttribute('data-id');
                renderRequests();
            });
        }

        if (els.detail) {
            els.detail.addEventListener('click', function (event) {
                if (event.target.closest('[data-detail-close]')) {
                    state.selectedId = null;
                    renderRequests();
                }
            });
        }

        if (els.exportBtn) {
            els.exportBtn.addEventListener('click', function () {
                var headers, rows, filename;

                if (state.view === 'clients') {
                    var clients = filteredClients();
                    headers = ['Клиент', 'Телефон', 'E-mail', 'Всего заявок', 'Активных'];
                    rows = clients.map(function (c) { return [c.name, c.phone, c.email, c.total, c.active]; });
                    filename = 'granfort-klienty.csv';
                } else {
                    var requests = filteredRequests();
                    headers = ['№', 'Дата', 'Время', 'Клиент', 'Телефон', 'E-mail', 'Автомобиль', 'Статус'];
                    rows = requests.map(function (r) {
                        return [r.id, r.date, r.time, r.name, r.phone, r.email || '', r.carLabel, STATUS_LABEL[r.status] || r.status];
                    });
                    filename = 'granfort-zayavki.csv';
                }

                var lines = [headers].concat(rows).map(function (row) {
                    return row.map(function (cell) {
                        return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
                    }).join(';');
                });

                var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                var url = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            });
        }

        if (els.logout) {
            els.logout.addEventListener('click', function () {
                try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
                window.location.href = 'index.html';
            });
        }

        setView(window.location.hash === '#clients' ? 'clients' : 'requests');
    }

    function onReady() {
        initSite();
        initAdmin();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();