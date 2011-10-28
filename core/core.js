/**
 * The framework core that made the dream become true
 * @module ys_core
 * @requires controller, model, ys_routes, substitute, ys_i18n
 */
YUI().add('ys_core', function(Y) {
	
	var NS = 'ys',
		
		Core = function()
		{
			Core.superclass.constructor.apply(this, arguments);
		};
		
	/**
	 * Core object. It extends Y.Controller and manage routes
	 * by updating a Coord
	 * @class Core
	 * @namespace Y.ys
	 * @extends Y.Controller
	 * @constructor
	 */
	Y.namespace(NS).Core = Y.extend(Core, Y.Controller, {
		/**
		 * Callback for path changes which update coord object
		 * @method _updateAttrs
		 * @param {object} attrs Routes statics attributes (set in routes.js)
		 * @param {object} params Dynamic parameters extracted from uri
		 * @protected
		 */
		_updateAttrs: function(attrs, params)
		{
			var attrsp = {},
				coord = this.get('coord');
				
			Y.Object.each(
				attrs,
				function(v, k)
				{
					coord.addAttr(
						k, {}
					);

					if (Y.Lang.isObject(v))
					{
						attrsp[k] = this._substituteObj(v, params);
					}
					else if (Y.Lang.isString(v))
					{
						attrsp[k] = this._substitute(v, params);
					}
					else
					{
						attrsp[k] = v;
					}
				},
				this
			);
			
			/**
			 * Reset attributes unset
			 */
			Y.Object.each(
				coord.getAttrs(),
				function(v, k)
				{
					if (k !== 'initialized' &&
						k !== 'destroyed' &&
						k !== 'clientId' &&
						k !== 'id')
					{
						if (!attrsp[k])
						{
							attrsp[k] = false;
						}
					}
				}
			);
			coord.setAttrs(attrsp);
			
			this.set('coord', coord);
		},
		/**
		 * Y.substitue alias
		 * @method _substitute
		 * @return string with new value
		 * @protected
		 */
		_substitute: function(v, params)
		{
			return Y.substitute(
				v,
				params
			);
		},
		/**
		 * Substitute keywords in a value by values in an object
		 * @method _substituteObj
		 * @param {string} v original value
		 * @param {object} params Values to replace
		 * @return object with new values
		 * @protected
		 */
		_substituteObj: function(v, params)
		{
			var newo = {};
			Y.Object.each(
				v,
				function(i, k)
				{
					newo[k] = this._substitute(i, params);
				},
				this
			);
			return newo;
		},
		/**
		 * Load routes from routes.js
		 * @method loadRoutes
		 * @param {Array} routes Array of objects with a path value and some
		 * arbitrary values associated
		 * @return Y.ys.Coord object wich contains attributes which will
		 * be updated
		 * @public
		 */
		loadRoutes: function(routes)
		{
			routes || (routes = []);
			
			Y.Array.each(
				routes,
				function(r)
				{
					this.route(
						r.path,
						Y.bind(
							function(attrs, req)
							{
								this._updateAttrs(attrs, req.params);
							},
							this,
							r
						)
					);
				},
				this
			);
			
			return this.get('coord');
		},
		/**
		 * Replace click event of a link (`a` tag) to make it call the
		 * Y.Controller.save() method in place of loading its href and update
		 * Y.ys.Coord object
		 * @method enhance
		 * @param {Node|NodeList} links Node or nodeList of `a` elements
		 * @public
		 */
		enhance: function(links)
		{
			if (links._node)
			{
				links = Y.all(links._node);
			}
			
			if (links)
			{
				links.each(
					function(link)
					{
						this._enhance(link)
					},
					this
				);
			}
		},
		/**
		 * Set the click event on the link
		 * @method _enhance
		 * @param {Node} link Node `a` element
		 * @protected
		 */
		_enhance: function(link)
		{
			link.on(
				'click',
				function(e, link)
				{
					if (e.button !== 1 || e.ctrlKey || e.metaKey) {
						return;
					}

					e.preventDefault();

					this.save(
						this.removeRoot(link.get('href'))
					);
				},
				this,
				link
			);
		},
		/**
		 * Load a module, add it to the Y object and execute a callback.
		 * It's an ehnaced version of the Y.use method
		 * @method use
		 * @param {string} module Module to load
		 * @param {Function} callback Callback to execute
		 * @public
		 */
		use: function(module, callback)
		{
			if (Y.Env._used[module])
			{
				callback(Y);
			}
			else
			{
				Y.use(module, Y.bind(
					function(callback) {
						callback(Y);
					},
					Y,
					callback
				));
			}
		}
	},
	{
		NAME: 'Core',
		ATTRS: {
			/**
			 * Coord object which is updated when path change
			 * @property coord
			 * @type Y.Model
			 */
			coord: {
				valueFn: function()
				{
					return new Y.Model();
				}
			}
		}
	});
	
	/**
	 * @class Controller
	 * @namespace Y.ys
	 * @extends Y.ys.Core
	 */
	Y.namespace(NS).Controller = new (Y.namespace(NS).Core)();
	
	/**
	 * Coord object. Listen to its `change` event to know if a route has changed
	 * @class Coord
	 * @namespace Y.ys
	 * @extends Y.Model
	 * @event change event
	 */
	Y.namespace(NS).Coord = Y.namespace(NS).Controller.loadRoutes(Y[NS].routes);
	
	Y.namespace(NS).use = Y.namespace(NS).Controller.use;

}, '1.0', {requires: ["controller", "model", "ys_routes", "substitute", "ys_i18n"]})