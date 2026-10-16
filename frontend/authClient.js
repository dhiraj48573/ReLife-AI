/**
 * ReLife Unified Authentication & Authorization Client
 * 
 * Provides:
 * - Real API-driven OTP login via POST /api/auth/send-otp & verify-otp
 * - 1-Click Instant Persona Sign-In (Member, Moderator, Admin) via POST /api/auth/demo-login
 * - Real User Profile Dropdown with Avatar, Role Badges, and Logout
 * - Multi-page session persistence across all frontend portals
 */

(function (window) {
    'use strict';

    const TOKEN_KEYS = ['authToken', 'token', 'relife_token'];
    const USER_KEY = 'relife_user';

    const AuthClient = {
        getToken() {
            for (const key of TOKEN_KEYS) {
                const val = localStorage.getItem(key);
                if (val && val.trim().length > 10) return val.trim();
            }
            return '';
        },

        getUser() {
            try {
                const raw = localStorage.getItem(USER_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },

        isAuthenticated() {
            return Boolean(this.getToken());
        },

        getRole() {
            const user = this.getUser();
            return (user?.role || user?.userType || 'user').toLowerCase();
        },

        setSession(token, user) {
            if (token) {
                TOKEN_KEYS.forEach(k => localStorage.setItem(k, token));
            }
            if (user) {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
            window.dispatchEvent(new CustomEvent('relife:authChange', { detail: { isAuthenticated: true, user } }));
            this.renderNavWidget();
        },

        clearSession() {
            TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(USER_KEY);
            window.dispatchEvent(new CustomEvent('relife:authChange', { detail: { isAuthenticated: false, user: null } }));
            this.renderNavWidget();
        },

        passwordMode: 'signin',

        // Open unified login dialog
        openModal(initialTab = 'password', personaRole = null) {
            const modal = document.getElementById('relifeGlobalAuthModal');
            if (modal) {
                modal.classList.remove('hidden');
                const targetTab = personaRole ? 'personas' : initialTab;
                this.switchTab(targetTab);
                if (personaRole) {
                    const personaBtn = document.getElementById(`personaBtn_${personaRole}`);
                    if (personaBtn) {
                        personaBtn.focus();
                        personaBtn.classList.add('ring-2', 'ring-blue-500');
                        setTimeout(() => personaBtn.classList.remove('ring-2', 'ring-blue-500'), 1500);
                    }
                }
                if (window.lucide) window.lucide.createIcons();
            }
        },

        closeModal() {
            const modal = document.getElementById('relifeGlobalAuthModal');
            if (modal) modal.classList.add('hidden');
        },

        switchTab(tabName) {
            const tabs = ['password', 'otp', 'personas', 'token'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tabBtn_${t}`);
                const panel = document.getElementById(`tabPanel_${t}`);
                if (btn && panel) {
                    if (t === tabName) {
                        btn.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-blue-600 text-blue-600 whitespace-nowrap px-2';
                        panel.classList.remove('hidden');
                    } else {
                        btn.className = 'flex-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent whitespace-nowrap px-2';
                        panel.classList.add('hidden');
                    }
                }
            });
            if (window.lucide) window.lucide.createIcons();
        },

        togglePasswordMode(mode) {
            this.passwordMode = mode;
            const isSignUp = mode === 'signup';
            const signupFields = document.getElementById('passwordSignupFields');
            const submitBtn = document.getElementById('passwordSubmitBtn');
            const togglePrompt = document.getElementById('passwordTogglePrompt');

            if (signupFields) signupFields.classList.toggle('hidden', !isSignUp);
            if (submitBtn) submitBtn.textContent = isSignUp ? 'Create Account & Sign In' : 'Sign In with Password';
            if (togglePrompt) {
                togglePrompt.innerHTML = isSignUp
                    ? 'Already have an account? <button type="button" onclick="AuthClient.togglePasswordMode(\'signin\')" class="text-blue-600 font-bold hover:underline">Sign In</button>'
                    : 'New to ReLife? <button type="button" onclick="AuthClient.togglePasswordMode(\'signup\')" class="text-blue-600 font-bold hover:underline">Create an account</button>';
            }
        },

        togglePasswordVisibility(inputId = 'authPasswordInput') {
            const input = document.getElementById(inputId);
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        },

        async loginWithPassword() {
            const identifier = document.getElementById('authEmailInput')?.value?.trim();
            const password = document.getElementById('authPasswordInput')?.value?.trim();
            const feedbackEl = document.getElementById('authModalFeedback');

            if (!identifier || !password) {
                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-rose-600 font-medium">Please enter your email and password.</span>';
                return;
            }

            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-blue-600 font-medium">Signing in...</span>';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Login failed');
                }

                this.setSession(data.token, data.user);
                this.closeModal();
                this.showToast(data.message || `Welcome back, ${data.user.name}!`, 'success');

                if (typeof window.onAuthSuccess === 'function') {
                    window.onAuthSuccess(data);
                }
            } catch (err) {
                if (feedbackEl) feedbackEl.innerHTML = `<span class="text-rose-600 font-medium">${err.message}</span>`;
            }
        },

        async registerWithPassword() {
            const email = document.getElementById('authEmailInput')?.value?.trim();
            const password = document.getElementById('authPasswordInput')?.value?.trim();
            const fullName = document.getElementById('authFullNameInput')?.value?.trim() || 'Member';
            const userType = document.getElementById('authRoleSelect')?.value || 'user';
            const feedbackEl = document.getElementById('authModalFeedback');

            if (!email || !password) {
                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-rose-600 font-medium">Please provide an email and password.</span>';
                return;
            }

            if (password.length < 6) {
                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-rose-600 font-medium">Password must be at least 6 characters long.</span>';
                return;
            }

            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-blue-600 font-medium">Creating your account...</span>';

            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || 'Member';
            const lastName = nameParts.slice(1).join(' ') || '';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, firstName, lastName, userType })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Registration failed');
                }

                this.setSession(data.token, data.user);
                this.closeModal();
                this.showToast(`Account created! Welcome, ${data.user.name}!`, 'success');

                if (typeof window.onAuthSuccess === 'function') {
                    window.onAuthSuccess(data);
                }
            } catch (err) {
                if (feedbackEl) feedbackEl.innerHTML = `<span class="text-rose-600 font-medium">${err.message}</span>`;
            }
        },

        handlePasswordSubmit() {
            if (this.passwordMode === 'signup') {
                this.registerWithPassword();
            } else {
                this.loginWithPassword();
            }
        },

        // 1-Click Demo Login across roles
        async loginDemoRole(role = 'user') {
            const feedbackEl = document.getElementById('authModalFeedback');
            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-blue-600 font-medium">Signing in...</span>';

            try {
                const res = await fetch('/api/auth/demo-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Demo login failed');
                }

                this.setSession(data.token, data.user);
                this.closeModal();
                this.showToast(`Signed in as ${data.user.name} (${data.user.role.toUpperCase()})`, 'success');

                // Trigger page refresh or callback
                if (typeof window.onAuthSuccess === 'function') {
                    window.onAuthSuccess(data);
                }
            } catch (err) {
                console.error('Demo login error:', err);
                if (feedbackEl) feedbackEl.innerHTML = `<span class="text-rose-600 font-medium">${err.message}</span>`;
            }
        },

        // Send OTP via real API
        async sendOtp() {
            const mobileInput = document.getElementById('authMobileInput');
            const mobileNumber = mobileInput?.value?.trim();
            const feedbackEl = document.getElementById('authModalFeedback');

            if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-rose-600">Please enter a valid 10-digit Indian mobile number.</span>';
                return;
            }

            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-blue-600">Sending OTP...</span>';

            try {
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Failed to send OTP');
                }

                // Show OTP section
                document.getElementById('otpInputSection')?.classList.remove('hidden');
                document.getElementById('sendOtpBtn')?.classList.add('hidden');
                document.getElementById('verifyOtpBtn')?.classList.remove('hidden');

                // If demoOtp provided (dev/demo mode), display auto-fill chip
                if (data.demoOtp) {
                    const demoOtpEl = document.getElementById('demoOtpHint');
                    if (demoOtpEl) {
                        demoOtpEl.innerHTML = `💡 Demo OTP: <strong class="font-mono text-blue-700">${data.demoOtp}</strong> <button onclick="AuthClient.autoFillOtp('${data.demoOtp}')" class="underline text-blue-800 ml-1 font-bold">Auto-Fill</button>`;
                        demoOtpEl.classList.remove('hidden');
                    }
                }

                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-emerald-600">OTP sent successfully. Check your phone.</span>';
            } catch (err) {
                if (feedbackEl) feedbackEl.innerHTML = `<span class="text-rose-600">${err.message}</span>`;
            }
        },

        autoFillOtp(code) {
            const otpInput = document.getElementById('authOtpInput');
            if (otpInput) otpInput.value = code;
        },

        // Verify OTP via real API
        async verifyOtp() {
            const mobileInput = document.getElementById('authMobileInput');
            const otpInput = document.getElementById('authOtpInput');
            const feedbackEl = document.getElementById('authModalFeedback');

            const mobileNumber = mobileInput?.value?.trim();
            const otp = otpInput?.value?.trim();

            if (!otp || otp.length !== 6) {
                if (feedbackEl) feedbackEl.innerHTML = '<span class="text-rose-600">Please enter the 6-digit OTP code.</span>';
                return;
            }

            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-blue-600">Verifying code...</span>';

            try {
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber, otp })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'OTP verification failed');
                }

                const user = {
                    id: data.user.id,
                    name: data.user.name || `User (${mobileNumber.slice(-4)})`,
                    mobileNumber: data.user.mobileNumber,
                    role: data.user.userType || 'user',
                    userType: data.user.userType || 'user'
                };

                this.setSession(data.token, user);
                this.closeModal();
                this.showToast(`Welcome back, ${user.name}!`, 'success');

                if (typeof window.onAuthSuccess === 'function') {
                    window.onAuthSuccess({ token: data.token, user });
                }
            } catch (err) {
                if (feedbackEl) feedbackEl.innerHTML = `<span class="text-rose-600">${err.message}</span>`;
            }
        },

        // Render Top Navigation Widget on all pages
        renderNavWidget() {
            const containers = document.querySelectorAll('.relife-auth-slot, #authStatusIndicator, #authNavWidget');
            const isAuthed = this.isAuthenticated();
            const user = this.getUser();
            const role = this.getRole();

            containers.forEach(container => {
                if (!container) return;

                if (isAuthed) {
                    const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ME';
                    const roleLabel = role === 'admin' ? 'Admin' : (role === 'moderator' ? 'Moderator' : 'Member');
                    const roleBadgeColor = role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-300' : (role === 'moderator' ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300');

                    container.innerHTML = `
                        <div class="relative inline-block text-left" id="userMenuDropdownRoot">
                            <button onclick="AuthClient.toggleUserMenu(event)" class="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-white pl-2 pr-3 py-1.5 rounded-full border border-slate-700 shadow-sm transition-all text-xs">
                                <span class="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-[10px] ring-2 ring-emerald-400">
                                    ${initials}
                                </span>
                                <span class="font-semibold hidden sm:inline max-w-[120px] truncate">${user?.name || 'My Account'}</span>
                                <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${roleBadgeColor} uppercase">${roleLabel}</span>
                                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>

                            <!-- Dropdown Menu -->
                            <div id="userMenuDropdown" class="hidden absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-fade-in text-xs">
                                <div class="px-3.5 py-2.5 border-b border-slate-100">
                                    <div class="font-bold text-slate-900 truncate">${user?.name || 'ReLife Member'}</div>
                                    <div class="text-[11px] text-slate-500 font-mono">${user?.mobileNumber || user?.email || 'Authenticated'}</div>
                                    <div class="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${roleBadgeColor}">${roleLabel} Privileges</div>
                                </div>
                                <div class="py-1">
                                    <a href="dashboard.html" class="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 transition-colors">
                                        <span>📊</span> Dashboard
                                    </a>
                                    <a href="journal.html" class="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 transition-colors">
                                        <span>📖</span> Mood Journal & Trends
                                    </a>
                                    <a href="support-chat.html" class="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 transition-colors">
                                        <span>🤖</span> AI Support Assistant
                                    </a>
                                </div>
                                <div class="border-t border-slate-100 pt-1">
                                    <button onclick="AuthClient.openModal('personas')" class="w-full text-left px-3.5 py-1.5 text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center justify-between">
                                        <span>Switch Test Persona</span>
                                        <span>⚡</span>
                                    </button>
                                    <button onclick="AuthClient.logout()" class="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-semibold flex items-center gap-1.5">
                                        <span>🚪</span> Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="flex items-center gap-2">
                            <button onclick="AuthClient.openModal('otp')" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                                <span>Sign In</span>
                            </button>
                            <button onclick="AuthClient.openModal('personas')" class="hidden sm:inline-flex bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all items-center gap-1">
                                <span>⚡ Demo Logins</span>
                            </button>
                        </div>
                    `;
                }
            });

            // Re-render authBtnLabel if existing
            const authBtnLabel = document.getElementById('authBtnLabel');
            if (authBtnLabel) {
                authBtnLabel.textContent = isAuthed ? (user?.name || 'Account') : 'Sign In';
            }
        },

        toggleUserMenu(e) {
            e.stopPropagation();
            const dropdown = document.getElementById('userMenuDropdown');
            if (dropdown) dropdown.classList.toggle('hidden');
        },

        logout() {
            this.clearSession();
            this.showToast('You have signed out successfully.', 'info');
            setTimeout(() => {
                if (window.location.pathname.includes('journal') || window.location.pathname.includes('support-chat')) {
                    window.location.reload();
                }
            }, 600);
        },

        showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer') || document.body;
            const toast = document.createElement('div');
            let bg = 'bg-slate-900 text-white';
            if (type === 'success') bg = 'bg-emerald-600 text-white';
            if (type === 'error') bg = 'bg-rose-600 text-white';
            if (type === 'info') bg = 'bg-blue-600 text-white';

            toast.className = `fixed bottom-4 right-4 z-50 ${bg} px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2 animate-fade-in pointer-events-auto`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3500);
        },

        // Inject Modal into page body
        injectModal() {
            if (document.getElementById('relifeGlobalAuthModal')) return;

            const modalHtml = `
            <div id="relifeGlobalAuthModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in relative text-slate-800">
                    
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                🔑
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-slate-900">Sign In to ReLife</h3>
                                <p class="text-[11px] text-slate-500">Secure, role-based divorce & emotional support</p>
                            </div>
                        </div>
                        <button onclick="AuthClient.closeModal()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-lg">✕</button>
                    </div>

                    <!-- Navigation Tabs -->
                    <div class="flex border-b border-slate-200 mb-4 overflow-x-auto">
                        <button id="tabBtn_password" onclick="AuthClient.switchTab('password')" class="flex-1 py-2 text-xs font-bold border-b-2 border-blue-600 text-blue-600 whitespace-nowrap px-2">🔑 Password</button>
                        <button id="tabBtn_otp" onclick="AuthClient.switchTab('otp')" class="flex-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent whitespace-nowrap px-2">📱 Mobile OTP</button>
                        <button id="tabBtn_personas" onclick="AuthClient.switchTab('personas')" class="flex-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent whitespace-nowrap px-2">⚡ 1-Click Fast</button>
                        <button id="tabBtn_token" onclick="AuthClient.switchTab('token')" class="flex-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent whitespace-nowrap px-2">🛠 Token</button>
                    </div>

                    <div id="authModalFeedback" class="mb-3 text-xs text-center min-h-[18px]"></div>

                    <!-- Tab 1: Real Email / Username & Password (Sign In + Sign Up) -->
                    <div id="tabPanel_password" class="space-y-3">
                        <div id="passwordSignupFields" class="hidden space-y-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                                <input type="text" id="authFullNameInput" placeholder="Ananya Rao" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                                <select id="authRoleSelect" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                                    <option value="user">Member (Seeking Support & Journal)</option>
                                    <option value="moderator">Support Moderator (Group Facilitator)</option>
                                    <option value="admin">Platform Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1">Email or Mobile Number</label>
                            <input type="text" id="authEmailInput" placeholder="name@example.com" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>

                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="block text-xs font-semibold text-slate-700">Password</label>
                                <button type="button" onclick="AuthClient.togglePasswordVisibility('authPasswordInput')" class="text-[11px] text-blue-600 hover:underline">Show/Hide</button>
                            </div>
                            <input type="password" id="authPasswordInput" placeholder="••••••••" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>

                        <button id="passwordSubmitBtn" onclick="AuthClient.handlePasswordSubmit()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-sm">
                            Sign In with Password
                        </button>

                        <div id="passwordTogglePrompt" class="text-center text-[11px] text-slate-500 pt-1">
                            New to ReLife? <button type="button" onclick="AuthClient.togglePasswordMode('signup')" class="text-blue-600 font-bold hover:underline">Create an account</button>
                        </div>
                    </div>

                    <!-- Tab 2: Real Mobile OTP -->
                    <div id="tabPanel_otp" class="hidden space-y-3.5">
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (India)</label>
                            <div class="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                                <span class="bg-slate-100 text-slate-500 px-3 py-2 text-xs font-semibold flex items-center border-r border-slate-300">+91</span>
                                <input type="tel" id="authMobileInput" maxlength="10" placeholder="9876543210" class="flex-1 px-3 py-2 text-xs focus:outline-none" value="9876543210" />
                            </div>
                        </div>

                        <div id="otpInputSection" class="hidden space-y-2">
                            <label class="block text-xs font-semibold text-slate-700">Enter 6-Digit Verification Code</label>
                            <input type="text" id="authOtpInput" maxlength="6" placeholder="123456" class="w-full px-3 py-2 text-center text-sm font-mono tracking-widest border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            <div id="demoOtpHint" class="hidden text-[11px] p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-center"></div>
                        </div>

                        <button id="sendOtpBtn" onclick="AuthClient.sendOtp()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-sm">
                            Send Verification Code
                        </button>

                        <button id="verifyOtpBtn" onclick="AuthClient.verifyOtp()" class="hidden w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-sm">
                            Verify & Sign In
                        </button>
                    </div>

                    <!-- Tab 2: 1-Click Demo Personas -->
                    <div id="tabPanel_personas" class="hidden space-y-2.5">
                        <p class="text-[11px] text-slate-500 mb-2">Instantly evaluate different role authorizations with pre-configured personas:</p>
                        
                        <!-- Persona 1: Member -->
                        <div onclick="AuthClient.loginDemoRole('user')" class="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 cursor-pointer transition-all flex items-center justify-between group">
                            <div class="flex items-center gap-2.5">
                                <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">SM</span>
                                <div>
                                    <div class="font-bold text-xs text-slate-800 group-hover:text-emerald-800">Sarah Miller</div>
                                    <div class="text-[10px] text-slate-500">Regular Member • Private Journal & AI Assistant</div>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">Sign In</span>
                        </div>

                        <!-- Persona 2: Moderator -->
                        <div onclick="AuthClient.loginDemoRole('moderator')" class="p-3 rounded-xl border border-slate-200 hover:border-purple-500 bg-slate-50 hover:bg-purple-50/50 cursor-pointer transition-all flex items-center justify-between group">
                            <div class="flex items-center gap-2.5">
                                <span class="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">PS</span>
                                <div>
                                    <div class="font-bold text-xs text-slate-800 group-hover:text-purple-800">Dr. Priya Sharma</div>
                                    <div class="text-[10px] text-slate-500">Moderator • Group Facilitation & Community Access</div>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase">Sign In</span>
                        </div>

                        <!-- Persona 3: Admin -->
                        <div onclick="AuthClient.loginDemoRole('admin')" class="p-3 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/50 cursor-pointer transition-all flex items-center justify-between group">
                            <div class="flex items-center gap-2.5">
                                <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs">RS</span>
                                <div>
                                    <div class="font-bold text-xs text-slate-800 group-hover:text-amber-800">Rajesh Sethi</div>
                                    <div class="text-[10px] text-slate-500">System Admin • Platform Metrics & Admin Controls</div>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">Sign In</span>
                        </div>
                    </div>

                    <!-- Tab 3: Custom Token Input -->
                    <div id="tabPanel_token" class="hidden space-y-3">
                        <p class="text-[11px] text-slate-500">Paste an existing JWT Bearer token:</p>
                        <textarea id="customJwtInput" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." class="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
                        <button onclick="AuthClient.saveCustomToken()" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs transition-colors">
                            Save Token
                        </button>
                    </div>

                    <p class="text-[10px] text-slate-400 mt-4 text-center">
                        🔒 Authenticated with secure JSON Web Tokens. Your private sessions are strictly isolated.
                    </p>
                </div>
            </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Close menu on click outside
            window.addEventListener('click', () => {
                const dropdown = document.getElementById('userMenuDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            });
        },

        saveCustomToken() {
            const input = document.getElementById('customJwtInput');
            const token = input?.value?.trim();
            if (token) {
                // Decode payload for user details
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const user = {
                        id: payload.userId || 'custom',
                        name: `User (${(payload.userId || '').slice(-4)})`,
                        role: payload.userType || payload.role || 'user',
                        userType: payload.userType || payload.role || 'user'
                    };
                    this.setSession(token, user);
                } catch {
                    this.setSession(token, { id: 'custom', name: 'API User', role: 'user' });
                }
                this.closeModal();
                this.showToast('Custom token applied successfully.', 'success');
                if (typeof window.onAuthSuccess === 'function') window.onAuthSuccess();
            } else {
                this.clearSession();
                this.closeModal();
                this.showToast('Token cleared.', 'info');
            }
        },

        async fetchCurrentUser() {
            const token = this.getToken();
            if (!token) return null;
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        this.setSession(token, data.user);
                        return data.user;
                    }
                }
            } catch (err) {
                // Offline or local mock
            }
            return this.getUser();
        },

        requireRole(allowedRoles = ['user', 'moderator', 'admin']) {
            const user = this.getUser();
            const role = this.getRole();
            if (!this.isAuthenticated()) {
                this.openModal('personas');
                return false;
            }
            if (!allowedRoles.includes(role)) {
                this.showToast(`Access Restricted: requires ${allowedRoles.join(' or ')} privileges.`, 'error');
                return false;
            }
            return true;
        },

        init() {
            this.injectModal();
            this.renderNavWidget();

            if (this.isAuthenticated() && !this.getUser()) {
                this.fetchCurrentUser();
            }

            document.addEventListener('click', (e) => {
                const dropdown = document.getElementById('userMenuDropdown');
                const root = document.getElementById('userMenuDropdownRoot');
                if (dropdown && !dropdown.classList.contains('hidden')) {
                    if (!root || !root.contains(e.target)) {
                        dropdown.classList.add('hidden');
                    }
                }
            });
        }
    };

    window.AuthClient = AuthClient;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AuthClient.init());
    } else {
        AuthClient.init();
    }

})(window);
