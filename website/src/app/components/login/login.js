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
exports.Login = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
let Login = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-login',
            imports: [common_1.CommonModule, forms_1.ReactiveFormsModule, router_1.RouterLink],
            templateUrl: './login.html',
            styleUrl: './login.css'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Login = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Login = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        fb;
        auth;
        router;
        route;
        loginForm;
        errorMessage = '';
        isSubmitting = false;
        redirectUrl = '/demo';
        constructor(fb, auth, router, route) {
            this.fb = fb;
            this.auth = auth;
            this.router = router;
            this.route = route;
            this.loginForm = this.fb.group({
                email: ['', [forms_1.Validators.required, forms_1.Validators.email]],
                password: ['', [forms_1.Validators.required]],
            });
        }
        ngOnInit() {
            const redirect = this.route.snapshot.queryParamMap.get('redirect');
            this.redirectUrl = redirect && redirect.startsWith('/') ? redirect : '/demo';
            void this.redirectIfAuthenticated();
        }
        async redirectIfAuthenticated() {
            if (await this.auth.validateSession()) {
                await this.router.navigateByUrl(this.redirectUrl);
            }
        }
        get emailInvalid() {
            const control = this.loginForm.get('email');
            return !!control && control.invalid && (control.touched || control.dirty);
        }
        get passwordInvalid() {
            const control = this.loginForm.get('password');
            return !!control && control.invalid && (control.touched || control.dirty);
        }
        async submit() {
            this.errorMessage = '';
            if (this.loginForm.invalid) {
                this.loginForm.markAllAsTouched();
                return;
            }
            this.isSubmitting = true;
            try {
                const email = String(this.loginForm.value.email || '').trim();
                const password = String(this.loginForm.value.password || '');
                await this.auth.login(email, password);
                await this.router.navigateByUrl(this.redirectUrl);
            }
            catch (error) {
                this.errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
            }
            finally {
                this.isSubmitting = false;
            }
        }
    };
    return Login = _classThis;
})();
exports.Login = Login;
//# sourceMappingURL=login.js.map