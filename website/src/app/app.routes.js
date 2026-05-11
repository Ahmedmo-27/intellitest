"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const landing_1 = require("./components/landing/landing");
const about_1 = require("./components/about/about");
const faq_1 = require("./components/faq/faq");
const demo_1 = require("./components/demo/demo");
const login_1 = require("./components/login/login");
const auth_guard_1 = require("./guards/auth.guard");
exports.routes = [
    { path: '', component: landing_1.Landing },
    { path: 'about', component: about_1.About },
    { path: 'faq', component: faq_1.Faq },
    { path: 'login', component: login_1.Login },
    { path: 'demo', component: demo_1.Demo, canActivate: [auth_guard_1.authGuard] },
    { path: '**', redirectTo: '' }
];
//# sourceMappingURL=app.routes.js.map