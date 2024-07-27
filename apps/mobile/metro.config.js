// Metro config for a pnpm monorepo: watch the workspace packages and let
// TypeScript-style ".js" specifiers inside @learnly/* resolve to their ".ts" sources.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

const packagesDir = path.resolve(workspaceRoot, "packages");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromWorkspacePackage = context.originModulePath.startsWith(packagesDir);
  if (fromWorkspacePackage && moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ".ts"), platform);
    } catch {
      // fall through to the default resolution below
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
