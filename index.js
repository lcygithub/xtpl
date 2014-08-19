/**
 * @ignore
 * load tpl from file in nodejs
 * @author yiminghe@gmail.com
 */

var fs = require('fs');
var Path = require('path');
var iconv;
try {
    iconv = require('iconv-lite');
} catch (e) {
}
var XTemplate = require('xtemplate');

var globalConfig = {
    encoding: 'utf-8'
};
var fileCache = {};
var instanceCache = {};
var fnCache = {};

function normalizeSlash(path) {
    if (path.indexOf('\\') !== -1) {
        path = path.replace(/\\/g, '/');
    }
    return path;
}

function getTplFn(path, config, callback) {
    var cache = config.cache;
    if (cache && fnCache[path]) {
        return callback(0, fnCache[path]);
    }
    readFile(path, config, function (error, tpl) {
        if (error) {
            callback(error);
        } else {
            var fn;
            try {
                fn = XTemplate.compile(tpl, path);
            } catch (e) {
                callback(e);
                return;
            }
            if (cache) {
                fnCache[path] = fn;
            }
            callback(undefined, fn);
        }
    });
}

function getInstance(path, config, callback) {
    var cache = config.cache;
    if (cache && instanceCache[path]) {
        return callback(0, instanceCache[path]);
    }
    getTplFn(path, config, function (error, tpl) {
        if (error) {
            callback(error);
        } else {
            var instance = new XTemplate(tpl, config);
            if (cache) {
                instanceCache[path] = instance;
            }
            callback(undefined, instance);
        }
    });
}

function readFile(path, config, callback) {
    var cache = config.cache;
    var encoding = config.encoding;
    if (cache && fileCache[path]) {
        return callback(null, fileCache[path]);
    }
    var content, error;
    try {
        content = fs.readFileSync(path);
    } catch (e) {
        error = e;
    }
    if (content) {
        if (Buffer.isEncoding(encoding)) {
            content = content.toString(encoding);
        } else if (iconv) {
            content = iconv.decode(content, encoding);
        } else {
            error = 'encoding: ' + encoding + ', npm install iconv-lite, please!';
        }
        if (!error && cache) {
            fileCache[path] = content;
        }
    }
    callback(error, content);
}

var loader = {
    load: function (params, callback) {
        var template = params.root;
        var path = params.name;
        template.extName = template.extName || Path.extname(template.config.name);
        var pathExtName = Path.extname(path);
        if (!pathExtName) {
            pathExtName = template.extName;
            path += pathExtName;
        }
        var rootConfig = template.config;
        if (pathExtName && pathExtName !== template.extName) {
            readFile(path, rootConfig, callback);
        } else {
            getTplFn(path, rootConfig, callback);
        }
    }
};

function renderFile(path, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    path = normalizeSlash(path);
    var encoding = options.settings && options.settings['view encoding'];
    try {
        var config = {
            name: path,
            loader: loader,
            cache: options.cache
        };
        encoding = config.encoding = encoding || globalConfig.encoding;
        getInstance(path, config, function (error, engine) {
            if (error) {
                callback(error);
            } else {
                // runtime commands
                engine.render(options, {commands: options.commands}, function (e, content) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (Buffer.isEncoding(encoding)) {
                        callback(e, content);
                    } else {
                        callback(e, iconv.encode(content, encoding));
                    }
                });
            }
        });
    } catch (e) {
        callback(e);
    }
}

function mix(r, s) {
    for (var p in s) {
        if (!(p in r)) {
            r[p] = s[p];
        }
    }
    return r;
}

/**
 * load xtemplate from file on nodejs
 * @singleton
 */
module.exports = {
    config: function (options) {
        mix(globalConfig, options);
    },

    XTemplate: XTemplate,

    __express: renderFile,

    renderFile: renderFile,

    clearCache: function (path) {
        delete instanceCache[path];
        delete fileCache[path];
        delete fnCache[path];
    }
};
