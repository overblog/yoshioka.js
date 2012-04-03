/**
 * Build engine
 * @module tools/build
 */
(function() {

var

APP_PATH = __dirname.replace(/yoshioka\.js.*$/, ''),
BUILD_DIR = 'build/',

fs = require('fs'),
events = require('events'),
exec = require('child_process').exec,
util = require('util'),
rimraf = require('../../lib/rimraf'),

compiler = require('../compiler'),
Maker = require('../make').Maker,
getconfig = require('../make/getconfig'),

Builder = function(config)
{
    Builder.superclass.constructor.apply(this, arguments);
    this.init(config);
};

Builder.prototype = new Maker();
Builder.superclass = Maker.prototype;
Builder.prototype._buildname = null;
Builder.prototype._buildpath = null;
Builder.prototype._coreconfig = null;
Builder.prototype._appconfig = null;
Builder.prototype._ignore = ['config/config.js', 'config/app_config.js', 'config/dev_config.js', 'config/tests_config.js', 'config/tconfig.js', 'yoshioka.js/core/core_config.js'];
Builder.prototype.init = function(config)
{
    var buildname = config && config.buildname || new Date().getTime(),
        buildpath = config && config.buildpath || BUILD_DIR+buildname+'/';
    
    this._configtype = config && config.type
    config || (config = {});
    
    this._buildname = buildname;
    this._buildpath = buildpath;
    
    events.EventEmitter.call(this);
    
    this._appconfig = getconfig.getConfig({
        dev: (this._configtype === 'dev'),
        tests: (this._configtype === 'tests')
    });
    
    this.dirs = ['yoshioka.js/core', 'locales', 'views', 'config'].concat(
        this._appconfig && this._appconfig.plugins
    );
    this._filecount = 0;
    
    this._coreconfig = JSON.parse(
        fs.readFileSync(
            APP_PATH+'yoshioka.js/core/core_config.js'
        ).toString()
    );
    
    if (config.type === 'tests')
    {
        configtype = 'tests_config';
    }
};
Builder.prototype.build = function()
{
    /**
     * Create build main dir
     */
    fs.stat(
        APP_PATH+BUILD_DIR,
        function(err, stats)
        {
            if (err)
            {
                fs.mkdirSync(APP_PATH+BUILD_DIR, 0755);
            }
            
            /**
             * Clean all previous builds
             */
            fs.readdirSync(
                APP_PATH+BUILD_DIR
            ).forEach(function(f)
            {
                var path = APP_PATH+BUILD_DIR+f;
                
                if (f.match(/^[0-9]+$/))
                {
                    rimraf.sync(path);
                }
            });
            
            /**
             * Create build subdir
             */
            fs.stat(
                APP_PATH+this._buildpath,
                function(err, stats)
                {
                    if (err)
                    {
                        fs.mkdirSync(APP_PATH+this._buildpath, 0755);
                    }
                    
                    this.fetch();
                }.bind(this)
            );
            
            
        }.bind(this)
    );
    
    /**
     * index.html
     */
    this._filecount++;
    this._parseHTMLFile('index.html', '../index.html');
    
    /**
     * Make config
     */
    this._makeConfig();
};
Builder.prototype._makeConfig = function()
{
    var Maker = require('../make/').Maker,
        maker = new Maker({
            dirs: ['locales', 'plugins', 'views', 'config'],
            apppath: this._buildpath,
            basepath: (this._appconfig.basepath || '')+'/'+this._buildname+'/',
            buildname: this._buildname,
            dev: (this._configtype === 'dev'),
            tests: (this._configtype === 'tests')
        });
    maker.on(
        'parseEnd',
        function(maker)
        {
            try
            {
                maker.writeConfig({
                    path: APP_PATH+this._buildpath
                });
            }
            catch (e)
            {
                util.log(e);
            }
        }.bind(this, maker)
    );
    try
    {
        maker.fetch();
    }
    catch (e)
    {
        util.log(e);
    }
};
Builder.prototype._parseJSFile = function(path)
{
    var ignore = false,
        c;
    
    this._ignore.forEach(
        function(file)
        {
            if (path.match(file))
            {
                ignore = true;
            }
        }
    );
    
    if (ignore)
    {
        this._filecount--;
        this._checkFileCount();
        return;
    }
    
    this._mkdir(path, APP_PATH+this._buildpath+'/');
    
    if (path.match(/routes.js$/))
    {
        c = new compiler.RoutesCompiler();
        c.parse(function(path, content)
        {
            fs.writeFile(
                APP_PATH+this._buildpath+path,
                content,
                'utf-8',
                function(path, err, data)
                {
                    this._filecount--;
                    this._checkFileCount();
                    return;
                }.bind(this, path)
            );
        }.bind(this, path));
        return;
    }
    else
    {
        c = new compiler.TemplateCompiler({
            file: path,
            basepath: (this._appconfig.basepath || '')+'/'+this._buildname
        });
        
        c.parse(function(path, content)
        {
            var c = new compiler.ModuleCompiler({
                filecontent: content
            });
            c.parse(function(path, content)
            {
                fs.writeFile(
                    APP_PATH+this._buildpath+path,
                    content,
                    'utf-8',
                    function(path, err, data)
                    {
                        this._filecount--;
                        this._checkFileCount();
                        return;
                    }.bind(this, path)
                );
            }.bind(this, path));
        }.bind(this, path));
    }
};
Builder.prototype._parseLocaleFile = function(path)
{
    var c = new compiler.I18nCompiler({
        file: path
    });
    
    this._mkdir(path, APP_PATH+this._buildpath+'/');
    
    c.parse(function(path, content)
    {
        fs.writeFile(
            APP_PATH+this._buildpath+path,
            content,
            'utf-8',
            function(path, err, data)
            {
                this._filecount--;
                this._checkFileCount();
                return;
            }.bind(this, path)
        );
    }.bind(this, path))
};
Builder.prototype._parseCSSFile = function(path)
{
    var c = new compiler.CSSCompiler({
        file: path
    });
    
    this._mkdir(path, APP_PATH+this._buildpath+'/');
    
    c.parse(function(path, content)
    {
        fs.writeFile(
            APP_PATH+this._buildpath+path,
            content,
            function(path, err, data)
            {
                
                this._filecount--;
                this._checkFileCount();
                return;

            }.bind(this, path)
        );
    }.bind(this, path));
    
    this._filecount--;
    this._checkFileCount();
};
Builder.prototype._parseStaticFile = function(path)
{
    var content;
    
    if (path.match(/test\.js$/) ||
        path.match(/tpl\.html/))
    {
        this._filecount--;
        this._checkFileCount();
        return;
    }
    
    this._mkdir(path, APP_PATH+this._buildpath+'/');
    
    /**
     * Simple copy file in build folder
     */
    content = fs.readFileSync(
        APP_PATH+path
    );
    
    fs.writeFileSync(
        APP_PATH+this._buildpath+path,
        content
    );
    
    this._filecount--;
    this._checkFileCount();
};
Builder.prototype._parseHTMLFile = function(path, writepath)
{
    var c = new compiler.HTMLCompiler({
        file: path,
        basepath: (this._appconfig.basepath || '')+'/'+this._buildname,
        type: 'app'
    });
    c.parse(function(path, content)
    {
        fs.writeFile(
            APP_PATH+this._buildpath+path,
            content
        );
        this._filecount--;
        this._checkFileCount();
    }.bind(this, writepath || path));
};
Builder.prototype.insertCopyright = function(path)
{
    var copyright = "/*\n{name} {version}\n{text}\n*/\n",
        data,
        filecontent = fs.readFileSync(APP_PATH+this._buildpath+path).toString();
    
    if (path.match(/yoshioka\.js/))
    {
        data = this._coreconfig.copyright;
    }
    else
    {
        data = this._appconfig.copyright;
    }
    
    if (data)
    {
        filecontent = copyright
            .replace(/\{name\}/, data.name)
            .replace(/\{version\}/, data.version)
            .replace(/\{text\}/, data.text)
            + filecontent;
    }
    fs.writeFileSync(
        APP_PATH+this._buildpath+path,
        filecontent
    );
}

exports.Builder = Builder;

})();