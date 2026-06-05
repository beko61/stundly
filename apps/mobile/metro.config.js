const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Mobile'ın React 19 kopyaları (tek instance garantisi)
// Root'ta React 18 bulunuyor (@react-navigation/core oradan çekiyor),
// resolveRequest ile tüm react importlarını mobile/node_modules'a kilitliyoruz.
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // react, react/jsx-runtime, react/jsx-dev-runtime vb. hepsini yakala
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subPath = moduleName === 'react' ? 'index.js' : moduleName.replace('react/', '') + '.js';
    const filePath = path.join(mobileNodeModules, 'react', subPath);
    return { filePath, type: 'sourceFile' };
  }
  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    const subPath = moduleName === 'react-dom' ? 'index.js' : moduleName.replace('react-dom/', '') + '.js';
    const filePath = path.join(mobileNodeModules, 'react-dom', subPath);
    return { filePath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.disableHierarchicalLookup = false;
config.resolver.resolverMainFields = ['react-native', 'main', 'module', 'browser'];

module.exports = config;
