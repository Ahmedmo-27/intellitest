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
exports.Demo = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
let Demo = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-demo',
            standalone: true,
            imports: [common_1.CommonModule, forms_1.ReactiveFormsModule],
            templateUrl: './demo.html',
            styleUrl: './demo.css'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Demo = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Demo = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        fb;
        demoService;
        demoForm;
        generatedTestCases = [];
        testCodeScript = null;
        isLoading = false;
        loadingMessage = '';
        errorMessage = '';
        constructor(fb, demoService) {
            this.fb = fb;
            this.demoService = demoService;
            this.demoForm = this.fb.group({
                language: ['', forms_1.Validators.required],
                framework: ['', forms_1.Validators.required],
                codeInput: ['', forms_1.Validators.required],
                promptInput: ['', forms_1.Validators.required],
            });
        }
        showLoading(message) {
            this.isLoading = true;
            this.loadingMessage = message;
        }
        hideLoading() {
            this.isLoading = false;
        }
        showError(message) {
            this.errorMessage = message;
            this.generatedTestCases = [];
            this.testCodeScript = null;
        }
        clearResults() {
            this.generatedTestCases = [];
            this.testCodeScript = null;
            this.errorMessage = '';
        }
        async generateTestCases() {
            if (this.demoForm.invalid) {
                this.demoForm.markAllAsTouched();
                return;
            }
            this.clearResults();
            this.showLoading('Generating test cases...');
            const payload = {
                type: 'function',
                language: this.demoForm.value.language,
                framework: this.demoForm.value.framework,
                prompt: this.demoForm.value.promptInput,
                modules: [this.demoForm.value.codeInput],
            };
            try {
                this.generatedTestCases = await this.demoService.requestTestCases(payload);
            }
            catch (error) {
                this.showError(`Failed to generate test cases: ${error.message}`);
            }
            finally {
                this.hideLoading();
            }
        }
        async generateTestCode() {
            if (this.generatedTestCases.length === 0) {
                this.showError('Please generate test cases first.');
                return;
            }
            this.showLoading('Generating test code...');
            const payload = {
                type: 'function',
                language: this.demoForm.value.language,
                framework: this.demoForm.value.framework,
                prompt: this.demoForm.value.promptInput,
                modules: [this.demoForm.value.codeInput],
                testCases: this.generatedTestCases,
            };
            try {
                this.testCodeScript = await this.demoService.requestTestCode(payload);
            }
            catch (error) {
                this.showError(`Failed to generate test code: ${error.message}`);
            }
            finally {
                this.hideLoading();
            }
        }
        copyCode() {
            if (!this.testCodeScript?.code)
                return;
            navigator.clipboard.writeText(this.testCodeScript.code).catch(err => {
                this.showError('Failed to copy code to clipboard.');
            });
        }
    };
    return Demo = _classThis;
})();
exports.Demo = Demo;
//# sourceMappingURL=demo.js.map