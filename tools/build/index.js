(function() {

var

APP_PATH = __dirname.replace(/yoshioka\.js.*$/, ''),
BUILD_DIR = 'build/',

fs = require('fs'),
events = require('events'),
exec = require('child_process').exec,
util = require('util'),
TemplateCompiler = require('../compiler/templates').TemplateCompiler,
L10nCompiler = require('../compiler/l10n').L10nCompiler,
Maker = require('../make').Maker,

Builder = function(config)
{
	Builder.superclass.constructor.apply(this, arguments);
	this.init(config);
};

Builder.prototype = new Maker();
Builder.superclass = Maker.prototype;
Builder.prototype._buildname = null;
Builder.prototype._buildpath = null;
Builder.prototype._ignore = ['config/config.js', 'config/app_config.js', 'yoshioka.js/core/core_config.js'];
Builder.prototype.init = function(config)
{
	events.EventEmitter.call(this);
	
	this.dirs = ['yoshioka.js/core', 'locales', 'plugins', 'views', 'config'];
	this._filecount = 0;
	this._buildname = new Date().getTime();
	this._buildpath = BUILD_DIR+this._buildname+'/';
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
	fs.readFile(
		APP_PATH+'index.html',
		function(err, data)
		{
			fs.writeFile(
				BUILD_DIR+'index.html',
				data.toString().replace(/\{\$basepath\}/gi, '/'+this._buildname)
			);
		}.bind(this)
	);
	
	/**
	 * Make config
	 */
	this._makeConfig();
};
Builder.prototype._makeConfig = function()
{
	var Maker = require('../make/').Maker,
		maker = new Maker({
			dirs: ['locales', 'plugins', 'views'],
			apppath: this._buildpath,
			basepath: this._buildname+'/'
		});
	maker.on(
		'parseEnd',
		function(maker)
		{
			maker.writeConfig(
				this._buildpath
			);
		}.bind(this, maker)
	)
	maker.fetch();
};
Builder.prototype._parseJSFile = function(path)
{
	var ignore = false,
		compiler;
	
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
	
	compiler = new TemplateCompiler({
		file: path
	});
	
	this._mkdir(path);
	
	fs.writeFile(
		this._buildpath+path,
		compiler.parse(),
		'utf-8',
		function(path, err, data)
		{
			/**
			 * Compress build file with YUICompressor
			 */
			this.compressJS(
				path,
				function(err, stdout, stderr)
				{
					this._filecount--;
					this._checkFileCount();
				}.bind(this)
			);
		}.bind(this, path)
	);
};
Builder.prototype._parseLocaleFile = function(path)
{
	var compiler = new L10nCompiler({
		file: path
	});
	
	this._mkdir(path);
	
	fs.writeFile(
		this._buildpath+path,
		compiler.parse(),
		'utf-8',
		function(path, err, data)
		{
			/**
			 * Compress build file with YUICompressor
			 */
			this.compressJS(
				path,
				function(err, stdout, stderr)
				{
					this._filecount--;
					this._checkFileCount();
				}.bind(this)
			);
		}.bind(this, path)
	);
};
Builder.prototype._parseCSSFile = function(path)
{
	this._mkdir(path);
	
	fs.readFile(
		APP_PATH+path,
		function(path, err, data)
		{
			if (err)
			{
				util.print(err);
				this._filecount--;
				this._checkFileCount();
				return;
			}
			/**
			 * Copy original file into build dir
			 */
			fs.writeFile(
				this._buildpath+path,
				data.toString(),
				function(path, err, data)
				{
					/**
					 * Compress build file with YUICompressor
					 */
					this.compressCSS(
						path,
						function()
						{
							this._filecount--;
							this._checkFileCount();
						}.bind(this)
					);
					
				}.bind(this, path)
			);
		}.bind(this, path)
	);
	
	//console.log(path);
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
	
	this._mkdir(path);
	
	/**
	 * Simple copy file in build folder
	 */
	content = fs.readFileSync(
		APP_PATH+path
	);
	
	fs.writeFileSync(
		this._buildpath+path,
		content
	);
	
	this._filecount--;
	this._checkFileCount();
};
Builder.prototype._mkdir = function(path)
{
	var file = (file = path.split(/\//)) && file[file.length - 1],
		dir = path.replace(file, ''),
		parts = this._buildpath;
	
	dir.split(/\//).forEach(
		function(part)
		{
			parts+=part+'/';
			try
			{
				fs.statSync(parts);
			}
			catch (e)
			{
				fs.mkdirSync(parts, 0755)
			}
		}
	);
};
Builder.prototype.compressJS = function(path, callback)
{
	var cmd = exec(
			'java -jar '+__dirname+'/yuicompressor-2.4.6.jar --type js --charset utf8 '+this._buildpath+path+' -o '+this._buildpath+path,
			function(callback, path, err, stdout, stderr)
			{
				if (err)
				{
					util.print('YUICompressor detects errors in '+path+" :\n");
					util.print(stderr);
				}
				callback && callback(err, stdout, stderr);
			}.bind(this, callback, path)
		);
};
Builder.prototype.compressCSS = function(path, callback)
{
	var cmd = exec(
			'java -jar '+__dirname+'/yuicompressor-2.4.6.jar --type css --charset utf8 '+this._buildpath+path+' -o '+this._buildpath+path,
			function(callback, path, err, stdout, stderr)
			{
				if (err)
				{
					util.print('YUICompressor detects errors in '+path+" :\n");
					util.print(stderr);
				}
				callback && callback(err, stdout, stderr);
			}.bind(this, callback, path)
		);
};

exports.Builder = Builder;

})();