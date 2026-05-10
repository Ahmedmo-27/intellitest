"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const landing_1 = require("./components/landing/landing");
const about_1 = require("./components/about/about");
const faq_1 = require("./components/faq/faq");
const demo_1 = require("./components/demo/demo");
exports.routes = [
    { path: '', component: landing_1.Landing },
    { path: 'about', component: about_1.About },
    { path: 'faq', component: faq_1.Faq },
    { path: 'demo', component: demo_1.Demo },
    { path: '**', redirectTo: '' }
];
//# sourceMappingURL=app.routes.js.map