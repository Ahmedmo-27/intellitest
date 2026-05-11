"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platform_browser_1 = require("@angular/platform-browser");
const app_1 = require("./app/app");
const app_config_server_1 = require("./app/app.config.server");
const bootstrap = (context) => (0, platform_browser_1.bootstrapApplication)(app_1.AppComponent, app_config_server_1.config, context);
exports.default = bootstrap;
//# sourceMappingURL=main.server.js.map