"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const auth_service_1 = require("../services/auth.service");
const authGuard = async (_route, state) => {
    const auth = (0, core_1.inject)(auth_service_1.AuthService);
    const router = (0, core_1.inject)(router_1.Router);
    const ok = await auth.validateSession();
    if (ok) {
        return true;
    }
    return router.createUrlTree(['/login'], {
        queryParams: { redirect: state.url }
    });
};
exports.authGuard = authGuard;
//# sourceMappingURL=auth.guard.js.map