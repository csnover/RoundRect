(function ($, undefined) {
	/**
	 * RoundRect. Makes funny looking square boxes into funny looking round
	 * boxes in your funny looking Microsoft browser.
	 *
	 * (Not DD_roundies.)
	 *
	 * Original DD_roundies © 2008 Drew Diller <drew.diller@gmail.com>
	 * RoundRect © 2010 Colin Snover <http://zetafleet.com>
	 *
	 * Released under MIT license.
	 */

	// you can change these to something else if you don’t like them (for
	// example, if you are a dork and think CS_undies is a better name).

	// ns is used as the element that gets inserted to the DOM as a
	// wrapper around the VML, and the xmlns is the namespace prefix that
	// VML is registered to.
	var ns = 'RoundRect',
		xmlns = 'rr',

		// you can change these if you want to specify a prefix in your CSS
		// or something, but really they are here because I am lazy and these
		// are long strings!
		br = 'border-radius',
		btl = 'border-top-left-radius',
		btr = 'border-top-right-radius',
		bbr = 'border-bottom-right-radius',
		bbl = 'border-bottom-left-radius',

		expando = ns + new Date().getTime(),
		uuid = 0,
		collection = {},
		ie8 = document.documentMode === 8,
		imageMap = {};

	/**
	 * Enables VML for the current page.
	 * @private
	 */
	function enableVml() {
		var css, rule;

		// IE will throw confused errors if document.namespaces
		// is not ready for our sweet sweet lovin’
		try {
			if (ie8) {
				document.namespaces.add(xmlns, 'urn:schemas-microsoft-com:vml', '#default#VML');
			}
			else {
				document.namespaces.add(xmlns, 'urn:schemas-microsoft-com:vml');
			}
		}
		catch (e) {
			setTimeout(enableVml, 10);
		}

		// Technically not part of enabling VML, but it is important to
		// prevent all sorts of havoc
		try {
			document.execCommand('BackgroundImageCache', false, true);
		}
		catch (e) {}

		// luckily, IE does not care that styles are going into the body
		css = document.createElement('style');
		document.body.appendChild(css);

		rule = 'behavior:url(#default#VML);display:inline-block';
		css.styleSheet.addRule(xmlns + '\\:shape', rule);
		css.styleSheet.addRule(xmlns + '\\:group', rule);
		css.styleSheet.addRule(xmlns + '\\:fill', rule);
	}

	// That’s not IE! Getouttahere.
	if (!window.attachEvent) {
		return;
	}

	enableVml();

	/**
	 * Only you can prevent horrible memory leaks in IE—because Microsoft
	 * doesn’t. (j/k guys i am sure ie9 will be leak-free.)
	 */
	window.attachEvent('onunload', function () {
		for (var i in collection) {
			if (collection.hasOwnProperty(i)) {
				try {
					collection[i].destroy();
				}
				catch (e) {}
			}
		}

		collection = null;
	});

	/**
	 * Creates a new RoundRect object.
	 * @class RoundRect
	 * @constructor
	 * @param {Element} element
	 * @param {boolean} dynamic
	 */
	function RoundRect(element, dynamic) {
		if (element[expando] && collection[element[expando]]) {
			throw new Error('Can’t round already rounded rectangles (use RoundRect.create)');
		}

		collection[element[expando] = (++uuid)] = this;

		this.element = element;
		this.onPropertyChangeProxy = $.proxy(function () {
			var self = this,
				property = window.event.propertyName;

			//console.log('PROPCHANGE ' + property);

			setTimeout(function () {
				self.onPropertyChange.call(self, property);
			});
		}, this);

		this.onStateChangeProxy = $.proxy(function () {
			var self = this,
				eventType = window.event.type;

			//console.log('STATECHANGE ' + eventType);

			setTimeout(function () {
				self.onStateChange.call(self, eventType);
			});
		}, this);

		this.onVmlStateChangeProxy = $.proxy(function () {
			//console.log('VMLSTATECHANGE' + event.type);

			this.onVmlStateChange(window.event.type);
		}, this);

		$(document).ready($.proxy(function () {
			this.render();

			if (dynamic) {
				this.start();
			}
		}, this));
	}

	/**
	 * @type {string}
	 */
	RoundRect.expando = expando;

	/**
	 * A hash map of nodeNames that will fail if we try to round them. What a
	 * bummer.
	 * @type {Object.<string, boolean>}
	 */
	RoundRect.disallowed = { INPUT: false, BODY: true, TABLE: true, TR: true, TD: true, SELECT: !ie8, OPTION: true };

	/**
	 * Creates a new RoundRect object, or returns the one that already exists
	 * in the collection for the given element. This is the preferred method of
	 * RoundRect instantiation.
	 * @param {Element} element
	 * @param {boolean} dynamic
	 * @return {RoundRect}
	 */
	RoundRect.create = function (element, dynamic) {
		var id = element[expando], obj;
		if (id && (obj = collection[id])) {
			if (dynamic !== undefined && obj.dynamic !== dynamic) {
				if (obj.dynamic) {
					obj.start();
				}
				else {
					obj.stop();
				}
			}

			return obj;
		}

		return new RoundRect(element, dynamic);
	};

	/**
	 * Manually destroy references of all elements not currently in the DOM in
	 * order to allow IE to garbage collect and free memory. If you need to
	 * call this, you are failing to destroy RoundRect objects, which is bad!
	 * Call the destroy method on objects you remove instead, whenever
	 * possible.
	 */
	RoundRect.gc = function () {
		for (var i in collection) {
			if (collection.hasOwnProperty(i)) {
				if (!collection[i].element.parentNode) {
					collection[i].destroy();
				}
			}
		}
	};

	/**
	 * Because sometimes faking hover events is necessary, we need to pull
	 * rules from stylesheets that contain :hover pseudo-elements and add some
	 * new rules to generate pseudo-classes.
	 */
	RoundRect.processStyleSheets = function () {
		var i, j, k, l, sheet;

		/**
		 * :hover -> ns + -hover
		 * @param {Object} sheet CSSStyleSheet, IE style.
		 */
		function processStyleSheet(sheet) {
			var i, rule;
			for (i = sheet.rules.length - 1; i >= 0; --i) {
				rule = sheet.rules[i];

				// Remove rules that were added previously, in case
				// processStyleSheets is being executed to refresh them
				if (rule.selectorText.indexOf('.' + ns + '-hover') !== -1) {
					sheet.removeRule(i);
					continue;
				}

				if (rule.selectorText.indexOf(':hover') !== -1) {
					sheet.addRule(rule.selectorText.replace(/:hover/g, '.' + ns + '-hover'), rule.style.cssText, i + 1);
				}
			}
		}

		for (i = 0, j = document.styleSheets.length; i < j; ++i) {
			try {
				sheet = document.styleSheets[i];
				if (sheet.imports) {
					for (k = 0, l = sheet.imports.length; k < l; ++k) {
						try {
							processStyleSheet(sheet.imports[k]);
						}
						// ignore ‘Permission Denied’ errors
						// with as little collateral damage as possible
						catch (e) {}
					}
				}

				processStyleSheet(sheet);
			}
			// ignore ‘Permission Denied’ errors
			catch (e) {}
		}
	};

	/**
	 * Search the DOM for any elements that should have rounded rectangles
	 * (based on CSS rules) and apply them.
	 * @param {boolean=} dynamic Whether to watch for changed styles. Defaults
	 * to TRUE.
	 * @param {boolean=} watchAll If TRUE, even elements that don’t have
	 * border-radius right now will be watched for changes. dynamic must also
	 * be TRUE, or this will do nothing.
	 */
	RoundRect.run = function (dynamic, watchAll) {
		if (dynamic === undefined) {
			dynamic = true;
		}

		if (dynamic) {
			RoundRect.processStyleSheets();
		}

		$(document).ready(function () {
			$('*').each(function (i, e, sucks) {
				var cs = e.currentStyle,
					tagName = e.nodeName.toUpperCase();

				// Skip RoundRect, VML, and disallowed elements
				if (tagName === ns.toUpperCase() || RoundRect.disallowed[tagName] || e.scopeName === xmlns) {
					return;
				}

				if ((cs[br] || cs[btl] || cs[btr] || cs[bbr] || cs[bbl]) !== undefined || (dynamic && watchAll)) {
					RoundRect.create(e, dynamic);
				}
			});
		});
	};

	RoundRect.prototype = {
		/**
		 * The element referenced by this object.
		 * @type {Element}
		 * @private
		 */
		element: undefined,

		/**
		 * A VML container for the VML content. What could be better?!
		 * @type {?}
		 * @private
		 */
		container: undefined,

		/**
		 * Cached values for the element’s width, height, top, and left offset.
		 * @type {Object.<string, *>}
		 * @private
		 */
		dimensions: undefined,

		/**
		 * Caches values for the four border-radius values, starting from the
		 * top-left.
		 * @type {?Array.<number>}
		 */
		radii: null,

		/**
		 * Cached values for the top, right, bottom, and left border widths.
		 * @type {Object.<string, *>}
		 * @private
		 */
		borderWidths: undefined,

		/**
		 * VML elements used to draw the border and background.
		 * @type {Object.<string, Element>}
		 */
		vml: undefined,

		/**
		 * Whether or not the element responds to dynamic property updates.
		 * @type {boolean}
		 */
		dynamic: false,

		/**
		 * The URL of the background image of the element.
		 * @type {?string}
		 */
		backgroundImage: null,

		/**
		 * @type {Object.<string, string>}
		 * @private
		 */
		originalStyles: {},

		/**
		 * Breaks references to the DOM to allow Microsoft’s crap GC to GC.
		 * @param {boolean=} restoreStyles Whether or not to restore inline
		 * styles from when the element was first run through RoundRect.
		 */
		destroy: function (restoreStyles) {
			var id = this.element[expando], i;
			this.stop();
			this.element.removeAttribute(expando);

			if (this.vml) {
				for (i in this.vml) {
					if (this.vml.hasOwnProperty(i)) {
						this.vml[i].filler = null;
					}
				}
			}

			if (this.container) {
				if (this.container && this.container.parentNode) {
					this.container.parentNode.insertBefore(this.element, this.container);
					this.container.parentNode.removeChild(this.container);
				}
			}

			if (restoreStyles && this.originalStyles) {
				for (i in this.originalStyles) {
					if (this.originalStyles.hasOwnProperty(i)) {
						this.element.style[i] = this.originalStyles[i];
					}
				}
			}

			this.element = null;
			delete collection[id];
		},

		/**
		 * Start watching for dynamic property changes and events.
		 */
		start: function () {
			if (!this.dynamic) {
				this.modifyEvents(true);
				this.dynamic = true;
			}
		},

		/**
		 * Stop watching for dynamic property changes and events.
		 */
		stop: function () {
			if (this.dynamic) {
				this.modifyEvents(false);
				this.dynamic = false;
			}
		},

		/**
		 * Modifies the event listeners on the element.
		 * @param {boolean} append
		 * @private
		 */
		modifyEvents: function (append) {
			var e = this.element,
				c = this.container,
				scp = this.onStateChangeProxy,
				vcp = this.onVmlStateChangeProxy,
				method = append ? 'attachEvent' : 'detachEvent';
			e[method]('onpropertychange', this.onPropertyChangeProxy);

			// events that may have corresponding changes within stylesheets
			e[method]('onmouseenter', scp);
			e[method]('onmouseleave', scp);
			e[method]('onfocus', scp);
			e[method]('onblur', scp);

			// onresize fires whenever the original element is resized
			e[method]('onresize', scp);

			// move fires whenever the original element changes positions
			e[method]('onmove', scp);

			c[method]('onmouseover', vcp);
			c[method]('onmouseout', vcp);
			c[method]('onclick', vcp);
		},

		/**
		 * Proxy for onVmlStateChange, binds ‘this’. Defined in the
		 * constructor.
		 * @type {Function}
		 * @private
		 */
		onVmlStateChangeProxy: undefined,

		/**
		 * Attaches a class to the element when its VML container is hovered
		 * over, since the mouse passes right through any areas of the rounded
		 * element that aren’t taken up by child elements.
		 * @param {string} eventType
		 */
		onVmlStateChange: function (eventType) {
			// document.activeElement will never strictly equal the document
			if (eventType === 'click'
				&& document.activeElement !== this.element
				&& document.activeElement !== document.body) {
				document.activeElement.blur();
			}
			else if (eventType === 'mouseover') {
				$(this.element).addClass(ns + '-hover');
			}
			else if (eventType === 'mouseout') {
				$(this.element).removeClass(ns + '-hover');
			}
		},

		/**
		 * Proxy for onPropertyChange, binds ‘this’ and implements a timeout
		 * when necessary. Defined in the constructor.
		 * @type {Function}
		 * @private
		 */
		onPropertyChangeProxy: undefined,

		/**
		 * Adjusts the VML in response to changes to the DOM to the original
		 * element.
		 * @param {string} property The name of the property that changed.
		 * @private
		 */
		onPropertyChange: function (property) {
			var es = this.element.style,
				cs = this.container.style;

			switch (property) {
			case 'style.display':
				cs.display = (es.display === 'none') ? 'none' : 'block';
				// fall through
			case 'style':
			case 'className':
			case 'style.cssText':
				this.dimensions = this.calculateDimensions();
				// fall through
			case 'style.border':
			case 'style.borderTop':
			case 'style.borderRight':
			case 'style.borderBottom':
			case 'style.borderLeft':
			case 'style.borderTopWidth':
			case 'style.borderRightWidth':
			case 'style.borderBottomWidth':
			case 'style.borderLeftWidth':
			case 'style.borderWidth':
				this.borderWidths = this.calculateBorderWidths();
				// fall through
			case 'style.border-radius':
			case 'style.border-top-left-radius':
			case 'style.border-top-right-radius':
			case 'style.border-bottom-right-radius':
			case 'style.border-bottom-left-radius':
				this.radii = this.calculateRadii();
				// fall through
			case 'style.padding':
			case 'style.background':
			case 'style.backgroundImage':
			case 'style.backgroundColor':
			case 'style.backgroundPosition':
			case 'style.backgroundRepeat':
				this.applyVML();
				break;
			case 'style.borderColor':
				this.vmlStrokeColor();
				break;
			case 'style.visibility':
				cs.visibility = es.visibility;
				break;
			case 'style.filter':
				this.vmlOpacity();
				break;
			case 'style.zIndex':
				cs.zIndex = es.zIndex;
				break;
			}
		},

		/**
		 * Proxy for onStateChange, binds ‘this’ and implements a timeout.
		 * Defined in the constructor.
		 * @type {Function}
		 * @private
		 */
		onStateChangeProxy: undefined,

		/**
		 * Reapplies VML styles in response to state change event, such as a
		 * mouseover.
		 * @param {string} eventType
		 * @private
		 */
		onStateChange: function (eventType) {
			if (eventType === 'resize' || eventType === 'move') {
				var oldDimensions = this.dimensions;
				this.dimensions = this.calculateDimensions();

				if (this.dimensions.width !== oldDimensions.width
					|| this.dimensions.height !== oldDimensions.height
					|| this.dimensions.top !== oldDimensions.top
					|| this.dimensions.left !== oldDimensions.left) {
					this.vmlOffsets();
					this.vmlPath();
				}
			}
			else {
				this.element.runtimeStyle.cssText = '';
				this.dimensions = this.calculateDimensions();
				this.borderWidths = this.calculateBorderWidths();
				this.radii = this.calculateRadii();
				this.applyVML();
			}
		},

		/**
		 * Calculates the appropriate radii for all corners of an element.
		 * @return {?Array.<number>}
		 * @private
		 */
		calculateRadii: function () {
			var e = this.element,
				cs = e.currentStyle,
				defaultRadius = cs[br] || '0 0 0 0',
				radii,
				i;

			if ((cs[br] || cs[btl] || cs[btr] || cs[bbr] || cs[bbl]) === undefined) {
				// No border radius set
				return null;
			}

			// The first split gets rid of any vertical radii, which are not
			// supported. We also assume in a really naïve manner that we are
			// always dealing with pixels. Pixels pixels pixels pixels pixels.
			radii = defaultRadius.split(/\s+\//)[0].replace(/[^0-9\s]/g, '').split(/\s+/);
			radii[0] = (cs[btl] || '').replace(/[^0-9]/g, '') || radii[0];
			radii[1] = (cs[btr] || '').replace(/[^0-9]/g, '') || radii[1];
			radii[2] = (cs[bbr] || '').replace(/[^0-9]/g, '') || radii[2];
			radii[3] = (cs[bbl] || '').replace(/[^0-9]/g, '') || radii[3];

			// Normalize as per the css3 spec so we always have four radii
			for (i = 0; i < 4; ++i) {
				radii[i] = radii[i] === undefined
						 ? (+radii[Math.max((i - 2), 0)])
						 : (+radii[i]);
			}

			// Make sure we aren’t drawing zero-radiuses because
			// someone decided to try to be clever and set everything to 0
			// in CSS
			if (radii[0] + radii[1] + radii[2] + radii[3] === 0) {
				return null;
			}

			return radii;
		},

		/**
		 * Calculates the width, height, top, and left offset of the element.
		 * @return {Object.<string, number>} Object with four keys: width,
		 * height, top, left.
		 * @private
		 */
		calculateDimensions: function () {
			return {
				width: this.element.offsetWidth,
				height: this.element.offsetHeight,
				left: this.element.offsetLeft,
				top: this.element.offsetTop
			};
		},

		/**
		 * Calculates the element’s border widths.
		 * @return {Object.<string, number>} Object with four keys: top,
		 * right, bottom, left.
		 * @private
		 */
		calculateBorderWidths: function () {
			var cs = this.element.currentStyle;
			return {
				top: parseInt(cs.borderTopWidth, 10) || 0,
				right: parseInt(cs.borderRightWidth, 10) || 0,
				bottom: parseInt(cs.borderBottomWidth, 10) || 0,
				left: parseInt(cs.borderLeftWidth, 10) || 0
			};
		},

		/**
		 * Draws VML for an element and puts it on the DOM.
		 * @private
		 */
		render: function () {
			var e = this.element, cs = e.currentStyle,
				tagName = e.nodeName.toUpperCase(), i;

			/**
			 * Forces an element to have layout.
			 * @param {...Element} var_args
			 */
			function forceLayout(var_args) {
				for (var e, i = 0, j = arguments.length; i < j; ++i) {
					e = arguments[i];
					e.style.zoom = 1;
					if (e.currentStyle.position === 'static') {
						e.style.position = 'relative';

						// We reset these just in case the element has been flipped
						// from positioned to static at some point in the past;
						// don’t want it to suddenly reposition itself somewhere
						// else
						e.style.top = 'auto';
						e.style.right = 'auto';
						e.style.bottom = 'auto';
						e.style.left = 'auto';
					}
				}
			}

			// Not sure why we check if currentStyle doesn’t exist, since it
			// always should at this point, but it was in the original code
			// (which I assume is more widely tested…)
			if (!cs
				|| RoundRect.disallowed[tagName]
				|| (this.radii = this.calculateRadii()) === null) {
				return;
			}

			e.style.behavior = 'none';

			// hasLayout is required on the element and its parent in order to
			// provide accurate positioning and to prevent VML layout bugs
			// (like having the VML render itself over the content). If your
			// everything breaks, uh, sorry!
			this.originalStyles.zoom = e.style.zoom;
			this.originalStyles.position = e.style.position;
			this.originalStyles.top = e.style.top;
			this.originalStyles.right = e.style.right;
			this.originalStyles.bottom = e.style.bottom;
			this.originalStyles.left = e.style.left;

			// According to Drew, if “something” accidentally matches this,
			// you'll get infinitely-created elements and a frozen browser.
			// No, I don’t know what that means, either.
			this.container = document.createElement(ns);
			this.container.runtimeStyle.cssText = 'behavior:none;position:absolute;margin:0;padding:0;border:0;background:none;';
			this.container.style.zIndex = cs.zIndex;

			// build elements corresponding to parts of the background
			this.vml = { color: null, image: null, stroke: null };
			for (i in this.vml) {
				if (this.vml.hasOwnProperty(i)) {
					this.vml[i] = document.createElement(xmlns + ':shape');
					this.vml[i].filler = document.createElement(xmlns + ':fill');
					this.vml[i].appendChild(this.vml[i].filler);
					this.vml[i].stroked = false;
					this.vml[i].style.position = 'absolute';
					this.vml[i].style.zIndex = cs.zIndex;
					this.vml[i].coordorigin = '1,1';
					this.container.appendChild(this.vml[i]);
				}
			}

			this.vml.image.fillcolor = 'none';
			this.vml.image.filler.type = 'tile';

			e.parentNode.insertBefore(this.container, e);
			forceLayout(e.offsetParent, e, this.container);

			if (tagName === 'IMG') {
				e.style.visibility = 'hidden';
			}
			else if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
				// With RoundRect applied, text inputs can only be
				// clicked on where text has already been written. This
				// partially works around this issue. It is not perfect:
				// clicking empty lines in textareas, for instance, puts the
				// carat in the wrong place, but it works in most common cases
				// and is much better than the default behaviour.
				this.container.style.cursor = cs.cursor === 'auto' ? 'text' : cs.cursor;
				this.container.attachEvent('onclick', $.proxy(function () {
					var range = this.element.createTextRange();
					range.moveStart('textedit');
					range.select();
				}, this));
			}

			// Without a timeout, IE will throw “unspecified errors”
			setTimeout($.proxy(function () {
				this.container.attachEvent('onmouseenter', $.proxy(function () {
					var fakeEvent = document.createEventObject(window.event);
					fakeEvent.toElement = fakeEvent.srcElement = this.element;
					this.element.fireEvent('on' + window.event.type, fakeEvent);
				}, this));
				this.container.attachEvent('onmouseleave', $.proxy(function () {
					var fakeEvent = document.createEventObject(window.event);
					fakeEvent.fromElement = fakeEvent.srcElement = this.element;
					this.element.fireEvent('on' + window.event.type, fakeEvent);
				}, this));
				this.dimensions = this.calculateDimensions();
				this.borderWidths = this.calculateBorderWidths();
				this.applyVML();
			}, this));
		},

		/**
		 * Applies all changes to the VML elements for an element.
		 */
		applyVML: function () {
			// If the element thinks it is invisible, chances are it was
			// created back when it was inside a container with display: none,
			// so let’s just refresh it now.
			if (this.dimensions.width === 0 || this.dimensions.height === 0) {
				this.dimensions = this.calculateDimensions();
			}

			// Nope, still invisible.
			if (this.dimensions.width === 0 || this.dimensions.height === 0) {
				return;
			}

			this.element.runtimeStyle.cssText = '';
			this.vmlFill();
			this.vmlStrokeColor();
			this.vmlOffsets();
			this.vmlPath();
			this.padBorder();
			this.vmlOpacity();
		},

		/**
		 * Updates the opacity of the VML elements that belong to the element.
		 * @private
		 */
		vmlOpacity: function () {
			var e = this.element,
				cs = e.currentStyle,
				opacity,
				vml = this.vml;

			if ((opacity = /Opacity=([0-9]+)/i.exec(cs.filter))) {
				opacity = (+opacity[1]) * 0.01;
				for (var i in vml) {
					if (vml.hasOwnProperty(i)) {
						vml[i].filler.opacity = opacity;
					}
				}
			}
		},

		/**
		 * Updates the element’s border-color.
		 * @private
		 */
		vmlStrokeColor: function () {
			this.vml.stroke.fillcolor = this.element.currentStyle.borderColor;
		},

		/**
		 * Moves VML elements to correspond with an change to the element’s
		 * width, height, top, or left offsets.
		 * @private
		 */
		vmlOffsets: function () {
			var dimensions = this.dimensions,
				i,
				vml = this.vml,
				multiplier;

			/**
			 * Copies style properties from the dimensions hash to another
			 * element.
			 * @param {Element} e
			 * @param {boolean} topLeft Whether to copy top/left dimensions.
			 */
			function assign(e, topLeft) {
				e.style.left = (topLeft ? 0 : dimensions.left) + 'px';
				e.style.top = (topLeft ? 0 : dimensions.top) + 'px';
				e.style.width = dimensions.width + 'px';
				e.style.height = dimensions.height + 'px';
			}

			for (i in vml) {
				if (vml.hasOwnProperty(i)) {
					multiplier = (i === 'image') ? 1 : 2;
					vml[i].coordsize = (dimensions.width * multiplier) + ',' + (dimensions.height * multiplier);
					assign(vml[i], true);
				}
			}

			assign(this.container, false);

			// I don’t know what this was *supposed* to do, but it seems to
			// just fuck up the borders.
			/*if (ie8) {
				vml.stroke.style.margin = '-1px';
				borderWidths = this.calculateBorderWidths();
				vml.color.style.margin = (borderWidths.top - 1) + 'px ' + (borderWidths.left - 1) + 'px';
			}*/
		},

		/**
		 * Draws some fucking VML to some fucking VML elements. Fuck yeah!
		 * Needs a little love.
		 * @private
		 */
		vmlPath: function () {
			var borderWidths = this.borderWidths,
				dimensions = this.dimensions,
				radii = this.radii.slice(),
				vml = this.vml,
				i;

			/**
			 * Generates a VML path string for a given set of coordinates.
			 * @param {boolean} direction Whether or not to draw clockwise
			 * @param {number} w Width
			 * @param {number} h Height
			 * @param {Array.<number>} r Radii
			 * @param {number} aL Left offset
			 * @param {number} aT Top offset
			 * @param {number} mult Multiplier
			 * @return {string} A VML path string.
			 */
			function coords(direction, w, h, r, aL, aT, mult) {
				var cmd = direction ? ['m', 'qy', 'l', 'qx', 'l', 'qy', 'l', 'qx', 'l'] : ['qx', 'l', 'qy', 'l', 'qx', 'l', 'qy', 'l', 'm'],
					R = r.slice(), // clone of array
					i,
					cmdCoords;

				aL *= mult;
				aT *= mult;
				w *= mult;
				h *= mult;

				for (i = 0; i < 4; ++i) {
					R[i] *= mult;

					// Avoid funky corner shapes caused by too large radii
					R[i] = Math.min(w * 0.5, h * 0.5, R[i]);
				}

				cmdCoords = [
					cmd[0] + Math.floor(0 + aL) + ',' + Math.floor(R[0] + aT),
					cmd[1] + Math.floor(R[0] + aL) + ',' + Math.floor(0 + aT),
					cmd[2] + Math.ceil(w - R[1] + aL) + ',' + Math.floor(0 + aT),
					cmd[3] + Math.ceil(w + aL) + ',' + Math.floor(R[1] + aT),
					cmd[4] + Math.ceil(w + aL) + ',' + Math.ceil(h - R[2] + aT),
					cmd[5] + Math.ceil(w - R[2] + aL) + ',' + Math.ceil(h + aT),
					cmd[6] + Math.floor(R[3] + aL) + ',' + Math.ceil(h + aT),
					cmd[7] + Math.floor(0 + aL) + ',' + Math.ceil(h - R[3] + aT),
					cmd[8] + Math.floor(0 + aL) + ',' + Math.floor(R[0] + aT)
				];

				if (!direction) {
					cmdCoords.reverse();
				}

				var path = cmdCoords.join('');

				return path;
			}

			if (borderWidths === undefined) {
				borderWidths = this.calculateBorderWidths();
			}

			/* determine outer curves */
			var outer = coords(true, dimensions.width, dimensions.height, radii, 0, 0, 2);

			/* determine inner curves */
			radii[0] -= Math.max(borderWidths.left, borderWidths.top);
			radii[1] -= Math.max(borderWidths.top, borderWidths.right);
			radii[2] -= Math.max(borderWidths.right, borderWidths.bottom);
			radii[3] -= Math.max(borderWidths.bottom, borderWidths.left);

			for (i = 0; i < 4; ++i) {
				radii[i] = Math.max(radii[i], 0);
			}

			var inner = coords(
				false,
				dimensions.width - borderWidths.left - borderWidths.right,
				dimensions.height - borderWidths.top - borderWidths.bottom,
				radii,
				borderWidths.left,
				borderWidths.top,
				2);

			var image = coords(
				true,
				dimensions.width - borderWidths.left - borderWidths.right + 1,
				dimensions.height - borderWidths.top - borderWidths.bottom + 1,
				radii,
				borderWidths.left,
				borderWidths.top,
				1);

			vml.color.path = inner;
			vml.image.path = image;
			vml.stroke.path = outer + inner;

			this.clipImage();
		},

		/**
		 * Replaces borders on the original element with more padding, because
		 * the border is redrawn in VML.
		 * @private
		 */
		padBorder: function () {
			var e = this.element, cs = e.currentStyle,
				props = [ 'Top', 'Right', 'Bottom', 'Left' ], i;

			for (i = 0; i < 4; ++i) {
				e.runtimeStyle['padding' + props[i]] = (parseInt(cs['padding' + props[i]], 10) || 0) + (parseInt(cs['border' + props[i] + 'Width'], 10) || 0) + 'px';
			}

			e.runtimeStyle.border = 'none';
		},

		/**
		 * Updates the background of the element.
		 * Needs some fixing up.
		 * @private
		 */
		vmlFill: function () {
			var e = this.element, cs = e.currentStyle,
				isImg = this.element.tagName.toUpperCase() === 'IMG',
				vml = this.vml, vmlBg, img;

			e.runtimeStyle.backgroundColor = '';
			e.runtimeStyle.backgroundImage = '';

			if (isImg || cs.backgroundImage !== 'none') {
				// if the element is an image element, use the src; otherwise,
				// use the backgroundImage.
				this.backgroundImage = vmlBg = isImg ? e.src : /^url\(["']?\s*(.+?)\s*["']?\)$/.exec(cs.backgroundImage)[1];

				// Determine the size of the loaded image
				if (imageMap[vmlBg] === undefined) {
					img = new Image();
					img.attachEvent('onload', $.proxy(function () {
						// Replace the object in the map with something more
						// primitive
						imageMap[vmlBg] = {
							width: this.width,
							height: this.height
						};
						this.vmlOffsets();
					}, this));
					img.src = vmlBg;
					imageMap[vmlBg] = img;
				}

				vml.image.filler.src = vmlBg;
				isImg = true;
			}

			vml.image.filled = isImg;
			vml.image.fillcolor = 'none';
			vml.color.filled = cs.backgroundColor !== 'transparent';
			vml.color.fillcolor = cs.backgroundColor;
			e.runtimeStyle.backgroundImage = 'none';
			e.runtimeStyle.backgroundColor = 'transparent';
		},

		/**
		 * Clips background image to the size of the container.
		 * Needs overhauling.
		 * @private
		 */
		clipImage: function () {
			var e = this.element,
				cs = e.currentStyle,
				vmlBg = this.backgroundImage,
				dimensions = this.calculateDimensions(),
				borderWidths = this.calculateBorderWidths(),
				vml = this.vml;

			if (vmlBg === undefined || imageMap[vmlBg] === undefined) {
				return;
			}

			var bg = {'X' : 0, 'Y' : 0 };

			/**
			 * Determine the position of the background, given the percentage
			 * where it is supposed to be placed.
			 * Abusive function. Abusive. Horrible. Fucking awful.
			 * @param {string} axis X or Y.
			 * @param {(string|number)} position
			 */
			function figurePercentage(axis, position) {
				var fraction = true;
				switch (position) {
				case 'left':
				case 'top':
					bg[axis] = 0;
					break;
				case 'center':
					bg[axis] = 0.5;
					break;
				case 'right':
				case 'bottom':
					bg[axis] = 1;
					break;
				default:
					if (position.indexOf('%') !== -1) {
						bg[axis] = parseInt(position, 10) * 0.01;
					}
					else {
						fraction = false;
					}
					break;
				}

				var horz = (axis === 'X');
				bg[axis] = Math.ceil(fraction
				         ? ((dimensions[horz ? 'width' : 'height'] - (borderWidths[horz ? 'left' : 'top'] + borderWidths[horz ? 'right' : 'bottom'])) * bg[axis]) - (imageMap[vmlBg][horz ? 'width' : 'height'] * bg[axis])
						 : parseInt(position, 10));
				bg[axis] += 1;
			}

			for (var b in bg) {
				if (bg.hasOwnProperty(b)) {
					// TODO: yes let us call a function instead of just inlining it,
					// that makes much more sense :|
					figurePercentage(b, cs['backgroundPosition' + b]);
				}
			}

			vml.image.filler.position = (bg.X / (dimensions.width - borderWidths.left - borderWidths.right + 1)) + ',' + (bg.Y / (dimensions.height - borderWidths.top - borderWidths.bottom + 1));

			// defaults. named c! makes perfect sense.
			var c = {'T' : 1, 'R' : dimensions.width + 1, 'B' : dimensions.height + 1, 'L' : 1};
			var altC = { 'X': {'b1' : 'L', 'b2' : 'R', 'd' : 'Width'}, 'Y': {'b1': 'T', 'b2': 'B', 'd': 'Height'} };

			// non-repeating, or repeat in one direction only
			if (cs.backgroundRepeat !== 'repeat') {
				// defaults for no-repeat
				// race condition! hottt!!
				c = {'T' : bg.Y, 'R' : (bg.X + imageMap[vmlBg].width), 'B' : (bg.Y + imageMap[vmlBg].height), 'L' : bg.X };

				// repeat-x or repeat-y
				/* now let's revert to dC for repeat-x or repeat-y */
				if (cs.backgroundRepeat.indexOf('repeat-') !== -1) {
					var v = cs.backgroundRepeat.split('repeat-')[1].toUpperCase();
					c[altC[v].b1] = 1;
					c[altC[v].b2] = dimensions[altC[v].d.toLowerCase()] + 1;
				}
// This seems to cause badness when negative positioning is involved
//				if (c.B > dimensions.height) {
//					c.B = dimensions.height + 1;
//				}
			}

			vml.image.style.clip = 'rect(' + c.T + 'px ' + c.R + 'px ' + c.B + 'px ' + c.L + 'px)';
		}
	};

	// Expose RoundRect to the world!
	window[ns] = RoundRect;
}(jQuery));