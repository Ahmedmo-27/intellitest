"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reqHandler = void 0;
const node_1 = require("@angular/ssr/node");
const express_1 = __importDefault(require("express"));
const node_path_1 = require("node:path");
const browserDistFolder = (0, node_path_1.join)(import.meta.dirname, '../browser');
const app = (0, express_1.default)();
const angularApp = new node_1.AngularNodeAppEngine();
/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */
/**
 * Serve static files from /browser
 */
app.use(express_1.default.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
}));
/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
    angularApp
        .handle(req)
        .then((response) => (response ? (0, node_1.writeResponseToNodeResponse)(response, res) : next()))
        .catch(next);
});
/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if ((0, node_1.isMainModule)(import.meta.url) || process.env['pm_id']) {
    const port = process.env['PORT'] || 4000;
    app.listen(port, (error) => {
        if (error) {
            throw error;
        }
        console.log(`Node Express server listening on http://localhost:${port}`);
    });
}
/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
exports.reqHandler = (0, node_1.createNodeRequestHandler)(app);
//# sourceMappingURL=server.js.map