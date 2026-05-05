const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { transformSync } = require('@babel/core');

function resolveFile(baseDir, request) {
  if (request.startsWith('.')) {
    const abs = path.resolve(baseDir, request);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
    if (fs.existsSync(`${abs}.js`)) return `${abs}.js`;
    if (fs.existsSync(path.join(abs, 'index.js'))) return path.join(abs, 'index.js');
  }
  return request;
}

function loadModule(filePath, mocks = {}) {
  const absPath = path.resolve(filePath);
  const code = fs.readFileSync(absPath, 'utf8');
  const { code: transformed } = transformSync(code, {
    filename: absPath,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    babelrc: false,
    configFile: false,
  });

  const module = { exports: {} };
  const dirname = path.dirname(absPath);

  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    const resolved = resolveFile(dirname, request);
    if (Object.prototype.hasOwnProperty.call(mocks, resolved)) return mocks[resolved];
    if (resolved.endsWith('.js') && path.isAbsolute(resolved)) {
      return loadModule(resolved, mocks);
    }
    return require(request);
  };

  const wrapped = `(function (exports, require, module, __filename, __dirname) {${transformed}\n})`;
  const script = new vm.Script(wrapped, { filename: absPath });
  script.runInThisContext()(module.exports, localRequire, module, absPath, dirname);

  return module.exports;
}

module.exports = { loadModule };
