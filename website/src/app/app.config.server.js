"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const core_1 = require("@angular/core");
const ssr_1 = require("@angular/ssr");
const app_config_1 = require("./app.config");
const app_routes_server_1 = require("./app.routes.server");
const serverConfig = {
    providers: [(0, ssr_1.provideServerRendering)((0, ssr_1.withRoutes)(app_routes_server_1.serverRoutes))],
};
exports.config = (0, core_1.mergeApplicationConfig)(app_config_1.appConfig, serverConfig);
//# sourceMappingURL=app.config.server.js.map