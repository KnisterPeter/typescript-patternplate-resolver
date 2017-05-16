import findRoot = require('find-root');
import * as path from 'path';
import * as ts_module from 'typescript/lib/tsserverlibrary';

function init(modules: { typescript: typeof ts_module }):
    { create(info: ts.server.PluginCreateInfo): ts.LanguageService } {
  const ts = modules.typescript;

  function resolveToPattern(info: ts.server.PluginCreateInfo, moduleName: string, containingFile: string,
      parts: string[], patternJson: string): ts_module.ResolvedModule {
    if (moduleName === 'Pattern' && containingFile.endsWith('demo.tsx')) {
      const resolvedFileName = path.sep + path.join(...parts, 'index.tsx');
      info.project.projectService.logger.info(`Resolved Pattern to ${resolvedFileName}`);
      return { resolvedFileName };
    } else {
      const pkg = JSON.parse(ts.sys.readFile(patternJson));
      // info.project.projectService.logger.info(`Dependency to ${moduleName}`);
      if (pkg.patterns && moduleName in pkg.patterns) {
        const root = findRoot(patternJson);
        // info.project.projectService.logger.info(`Root path ${root}`);
        const resolvedFileName = path.join(root, 'patterns', pkg.patterns[moduleName], 'index.tsx');
        return { resolvedFileName };
      }
    }
    return undefined as any;
  }

  function defaultTypescriptResolver(moduleName: string, containingFile: string,
      info: ts.server.PluginCreateInfo, resolveModuleNames: any): ts_module.ResolvedModule | undefined {
    if (!moduleName.startsWith('.') && resolveModuleNames) {
      // info.project.projectService.logger.info(`Resolve ${moduleName} on orig LSHost`);
      const result = resolveModuleNames.call(info.languageServiceHost, [moduleName],
        containingFile) as ts_module.ResolvedModule[];
      if (result && result.length > 0) {
        return result[0];
      }
    }
    return undefined;
  }

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    info.project.projectService.logger.info('Configuring patternplate resolver for typescript');
    const resolveModuleNames = info.languageServiceHost.resolveModuleNames;
    info.languageServiceHost.resolveModuleNames = function(moduleNames: string[], containingFile: string):
        ts_module.ResolvedModule[] {

      const resolvedNames = moduleNames.map(moduleName => {
        // info.project.projectService.logger.info(`Resolve ${moduleName} in ${containingFile}`);
        const parts = containingFile.split(path.sep);
        parts.pop();
        const patternJson = path.sep + path.join(...parts, 'pattern.json');
        // info.project.projectService.logger.info(`Pattern? to resolve ${patternJson}`);
        if (ts.sys.fileExists(patternJson)) {
          const resolvedModule = resolveToPattern(info, moduleName, containingFile, parts, patternJson);
          if (resolvedModule) {
            return resolvedModule;
          }
        }
        return defaultTypescriptResolver(moduleName, containingFile, info, resolveModuleNames);
      });
      if (resolvedNames && resolvedNames.length > 0) {
        return resolvedNames as any;
      }

      if (resolveModuleNames) {
        info.project.projectService.logger.info(`Resolve all on orig LSHost`);
        return resolveModuleNames.call(info.languageServiceHost, moduleNames, containingFile);
      }

      // fallback to standard resolving
      return moduleNames.map(moduleName => {
        const result = ts.resolveModuleName(moduleName, containingFile,
          info.project.getCompilerOptions(),
            { fileExists: ts.sys.fileExists, readFile: ts.sys.readFile });
        if (result.resolvedModule) {
          return result.resolvedModule;
        }

        // note: as any is a quirk here, since the CompilerHost interface does not allow strict null checks
        return undefined as any;
      });
    };
    return info.languageService;
  }

  return { create };
}

export = init;
