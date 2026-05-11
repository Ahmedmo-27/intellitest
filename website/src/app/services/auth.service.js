"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
let AuthService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({
            providedIn: 'root'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AuthService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AuthService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        config;
        tokenKey = 'intellitest.auth.token';
        userKey = 'intellitest.auth.user';
        isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
        token = this.readToken();
        lastValidatedAt = 0;
        validationTtlMs = 5 * 60 * 1000;
        userSubject = new rxjs_1.BehaviorSubject(this.readUser());
        user$ = this.userSubject.asObservable();
        authStateSubject = new rxjs_1.BehaviorSubject(!!this.token);
        isAuthenticated$ = this.authStateSubject.asObservable();
        constructor(config) {
            this.config = config;
        }
        getToken() {
            return this.token;
        }
        isAuthenticated() {
            return !!this.token;
        }
        async login(email, password) {
            const response = await fetch(this.config.getApiUrl(this.config.ENDPOINTS.AUTH_LOGIN), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) {
                throw new Error(await this.readErrorMessage(response));
            }
            const data = (await response.json());
            if (!data?.token) {
                throw new Error('Login failed. Missing token.');
            }
            const user = data.user ?? { email };
            this.setAuth(data.token, user);
            this.lastValidatedAt = Date.now();
            return user;
        }
        logout() {
            this.setAuth(null, null);
        }
        async validateSession(force = false) {
            if (!this.token) {
                this.setAuth(null, null);
                return false;
            }
            if (!force && Date.now() - this.lastValidatedAt < this.validationTtlMs) {
                return true;
            }
            try {
                const response = await fetch(this.config.getApiUrl(this.config.ENDPOINTS.AUTH_ME), {
                    headers: this.buildAuthHeaders(),
                });
                if (!response.ok) {
                    this.setAuth(null, null);
                    return false;
                }
                const data = (await response.json());
                this.setAuth(this.token, data.user ?? this.userSubject.value);
                this.lastValidatedAt = Date.now();
                return true;
            }
            catch {
                return !!this.token;
            }
        }
        buildAuthHeaders() {
            const headers = {};
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            return headers;
        }
        setAuth(token, user) {
            this.token = token;
            this.authStateSubject.next(!!token);
            this.userSubject.next(user);
            if (!this.isBrowser) {
                return;
            }
            if (token) {
                window.localStorage.setItem(this.tokenKey, token);
            }
            else {
                window.localStorage.removeItem(this.tokenKey);
            }
            if (user) {
                window.localStorage.setItem(this.userKey, JSON.stringify(user));
            }
            else {
                window.localStorage.removeItem(this.userKey);
            }
        }
        readToken() {
            if (!this.isBrowser) {
                return null;
            }
            return window.localStorage.getItem(this.tokenKey);
        }
        readUser() {
            if (!this.isBrowser) {
                return null;
            }
            const raw = window.localStorage.getItem(this.userKey);
            if (!raw) {
                return null;
            }
            try {
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }
        async readErrorMessage(response) {
            const fallback = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                return data.message || data.error || fallback;
            }
            catch {
                return fallback;
            }
        }
    };
    return AuthService = _classThis;
})();
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map