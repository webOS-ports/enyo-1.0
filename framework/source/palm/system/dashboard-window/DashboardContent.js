/** @protected Manages contents of a standard dashboard window.*/
enyo.kind({
	name: "enyo.DashboardContent",
	kind: enyo.Control,
	className: "dashboard-notification-module",
	components: [
		{kind: "ApplicationEvents", onWindowActivated:"dbActivated", onWindowDeactivated:"dbDeactivated"},
		// LuneOS: Settings' choice of notification look (luna-next-cardshell's NotificationLayout)
		// (enyo.PalmService, as enyo.PreferencesService is not in enyo-build.js)
		{name: "stylePrefs", kind: "enyo.PalmService", service: "palm://com.palm.systemservice/",
			method: "getPreferences", subscribe: true, onSuccess: "stylePrefsFetched"},
		{name: 'topSwipeable', kind:"enyo.AnimatedSwipeableItem", layoutKind: "HFlexLayout", confirmRequired:false, onConfirm: "dbSwiped", allowLeft:false, components: [ 
			{ className:'palm-dashboard-icon-container', onclick: "iconTapHandler", components: [
					{name:'icon', className: "dashboard-icon", kind:enyo.Image},
					{name: 'badge', className:'dashboard-count', components:[
						{name: 'count', nodeTag:'span', className:'dashboard-count-label'}]}
			]},
			{name: 'layer0', kind: "enyo.DashboardLayer", className: 'layer-0', onclick:"msgTapHandler", swipeable:false},
			{name: 'layer1', kind: "enyo.DashboardLayer", className: 'layer-1', onclick:"msgTapHandler", onSwipe:"layerSwiped"},
			{name: 'layer2', kind: "enyo.DashboardLayer", className: 'layer-2', leftOffset: 15, onclick:"msgTapHandler", onSwipe:"layerSwiped"},
			// Special drop shadow & edge highlights shown when dragging whole dashboard.
			// Mimics that drawn by sysmgr, until we can better coordinate who handles dashboard drags.
			{className:"swipe-shadow left"},
			{className:"swipe-shadow right"},
			{className:"swipe-highlight left"},
			{className:"swipe-highlight right"}
		]}
	],
	clickHandler: function(inSender, event) {
		this.sendEventToApp("doTap", [this.layers[this.layers.length-1], this.makeFakeEvent(event)]);
		event.stopPropagation();
		return true;
	},
	iconTapHandler: function(inSender, event) {
		this.sendEventToApp("doIconTap", [this.layers[this.layers.length-1], this.makeFakeEvent(event)]);
		event.stopPropagation();
		return true;
	},
	msgTapHandler: function(inSender, event) {
		this.sendEventToApp("doMessageTap", [this.layers[this.layers.length-1], this.makeFakeEvent(event)]);
		event.stopPropagation();
		return true;
	},
	dbActivated: function(inSender) {
		this.sendEventToApp("doDashboardActivated");
	},
	dbDeactivated: function(inSender) {
		this.sendEventToApp("doDashboardDeactivated");
	},
	// Whole dashboard was swiped, close the window.
	dbSwiped: function() {
		window.close();
	},
	// Just top layer was swiped.
	layerSwiped: function() {
		var layer = this.layers.pop();
		this.updateContents();
		this.sendEventToApp("doLayerSwipe", [layer]);
		// After updating layers, we may need to animate the uncovered one into place.
		// Pull layer-2 back to layer-1's position, and when it's real class is restored it will animate.
		if(this.layers.length > 2) {
			var that=this;
			this.$.layer2.setClassName("layer-1");
			window.setTimeout(function() {
				that.$.layer2.setClassName("layer-2");
			}, 0);
		}
	},
	create: function() {
		this.inherited(arguments);
		var params = enyo.windowParams;
		this.dashboardId = params.dashboardId;
		// Save the path to index file, for use with document-relative icons.
		this.docPath = params.docPath;
		this.docPath = this.docPath.slice(0,this.docPath.lastIndexOf('/')+1);
		// A copy: under WAM the opener's params object itself becomes
		// enyo.windowParams (assignWindowParams keeps an object as it is), so
		// this was the app's own enyo.Dashboard layers array. A swipe then
		// popped it twice - here and in the app's doLayerSwipe - and the
		// next swipe found it empty and closed the dashboard.
		this.layers = (params.layers || []).slice(0);
		this.setPhoneLook(this.isLuneOSPhone());
		if (this.shellSlidesWhole()) {
			this.$.stylePrefs.call({keys: ["notificationStyle"]});
		}
		this.indicateNewContent(true);	
		// Configure layer clipping properly.
		// This lets upper layers clip out lower ones, which is needed since they're transparent.
		this.$.layer1.setClipControl(this.$.layer0);
		this.$.layer2.setClipControl(this.$.layer1);
		// This is how our owner tells us about layer updates:
		enyo.windowParamsChangeHandler = enyo.bind(this, "handleNewLayers");
		// Make sure we're destroyed on window close, so we're removed from our owner's child list.
		this.boundDestroy = enyo.bind(this, "destroy");
		window.addEventListener('unload', this.boundDestroy);
		// LuneOS: which pill the finger is on, for dashboard.css to light on a
		// phone. Not CSS's :active, which Chromium never sets in this window:
		// Enyo takes touchstart for its own gestures and prevents its default.
		this.boundPress = enyo.bind(this, "pressChanged");
		for (var i = 0; i < this.pressEvents.length; i++) {
			document.addEventListener(this.pressEvents[i], this.boundPress, true);
		}
	},
	pressEvents: ["touchstart", "touchend", "touchcancel", "mousedown", "mouseup"],
	pressChanged: function(e) {
		if (this.pressedNode) {
			this.pressedNode.classList.remove("luneos-pressed");
			this.pressedNode = null;
		}
		if (!this.phoneLook || (e.type !== "touchstart" && e.type !== "mousedown") || !e.target || !e.target.closest) {
			return;
		}
		// One layer is one pill, the whole entry; with more, the icon's or the
		// text's of the layer pressed.
		var pill = this.hasClass("single") ? this.$.topSwipeable.hasNode()
			: e.target.closest(".palm-dashboard-icon-container, .palm-dashboard-text-container");
		if (pill && (pill === e.target || pill.contains(e.target))) {
			pill.classList.add("luneos-pressed");
			this.pressedNode = pill;
		}
	},
	// NOTE: destroy() is installed as an event listener for window unload, since it's not called automatically.
	destroy: function() {
		this.indicateNewContent(false);
		window.removeEventListener('unload', this.boundDestroy);
		for (var i = 0; i < this.pressEvents.length; i++) {
			document.removeEventListener(this.pressEvents[i], this.boundPress, true);
		}
		// If we're closed while there are layers, then the user swiped us away.
		if(this.layers.length) {
			this.layers.length = 0;
			this.sendEventToApp("doUserClose");
		}
		this.inherited(arguments);
	},
	rendered: function() {
		this.inherited(arguments);
		this.updateContents();
	},
	// Sets state of children to accurately reflect our layers array,
	// including closing the window if we have no layers left.
	updateContents: function() {
		var len = this.layers.length;
		if (!len) {
			this.indicateNewContent(false);
			window.close();
			return;
		}
		// Configure last 3 layers in our list:
		var layers = this.layers.slice(-3);
		this.$.layer2.setLayer(layers[2]);
		this.$.layer1.setLayer(layers[1]);
		this.$.layer0.setLayer(layers[0]);
		// Set icon to match top layer:
		this.setIcon(layers[layers.length-1].icon);
		this.$.layer1.setSwipeable(!layers[2]);
		// The whole dashboard slides once one layer is left - by the shell's
		// swipe, where there is one (tellShellLayerCount). Both at once, the
		// shell's took the touch from the page part way, the page never saw it
		// end, and its swipe stayed where it had got to, and went on with the
		// next touch.
		this.$.topSwipeable.setSwipeable(!layers[1] && !this.shellSlidesWhole());
		this.addRemoveClass("single", len === 1);
		this.addRemoveClass("stacked", len > 2);
		this.tellShellLayerCount(len);
		if (len > 1) {
			this.$.count.setContent(len);
			this.$.badge.show();
		} else {
			this.$.badge.hide();
		}
	},
	// LuneOS: the shell (luna-next-cardshell) wraps every dashboard in a
	// swipe of its own, which took the drag before the layers above could,
	// and slid the whole dashboard. With more than one layer it leaves the
	// drag to us, so only the top layer goes; with one, it slides the
	// dashboard as a whole, as sysmgr did.
	tellShellLayerCount: function(inCount) {
		if (this.shellSlidesWhole()) {
			PalmSystem.setWindowProperty("LuneOS_dashLayers", String(inCount));
		}
	},
	shellSlidesWhole: function() {
		return !!(window.PalmSystem && PalmSystem.setWindowProperty);
	},
	// LuneOS: a phone's shell (luna-next-cardshell with TabletUi off) lists
	// its notifications as webOS 2.2.4 did, an icon pill and a text pill, and
	// dashboard.css draws these the same way there. A tablet's is webOS 3.0's,
	// which is what this window always drew; so is any shell that does not say.
	isLuneOSPhone: function() {
		var info = window.PalmSystem && PalmSystem.deviceInfo;
		if (typeof info === "string") {
			try {
				info = JSON.parse(info);
			} catch (e) {
				info = null;
			}
		}
		return !!info && info.tabletUi === false;
	},
	// "phone" or "tablet" as Settings' Notifications page chose it, or "auto"
	// (or nothing, on a shell that has no such setting): the device's own.
	stylePrefsFetched: function(inSender, inResponse) {
		var style = inResponse && inResponse.notificationStyle;
		this.setPhoneLook(style === "phone" || (style !== "tablet" && this.isLuneOSPhone()));
	},
	setPhoneLook: function(inPhone) {
		inPhone = !!inPhone;
		if (this.phoneLook === inPhone) {
			return;
		}
		this.phoneLook = inPhone;
		this.addRemoveClass("luneos-phone", inPhone);
		// A tablet's in the LuneOS shell, whose rows size their text by the row
		this.addRemoveClass("luneos-tablet", !inPhone && this.shellSlidesWhole());
		// A layer shows the one under it past its own left edge, as far as
		// past its rounded corners, or they would show nothing behind them; on
		// a phone the layer over it is opaque, so the rest does not show. The
		// top one starts 22px further in than the middle one (dashboard.css),
		// its corners a sixth of the height round. The tablet's are Enyo's.
		this.$.layer1.setLeftOffset(inPhone ? 40 : 0);
		this.$.layer2.setLeftOffset(inPhone ? 60 : 15);
		// and the layers under clipped to the new offsets, as setLayer does
		this.$.layer1.configureClipping(this.$.layer1, this.$.layer1.layer ? 0 : null);
		this.$.layer2.configureClipping(this.$.layer2, this.$.layer2.layer ? 0 : null);
		// so that the shell draws no bar of its own behind ours
		if (this.shellSlidesWhole()) {
			PalmSystem.setWindowProperty("LuneOS_dashOwnBar", inPhone ? "true" : "false");
		}
	},
	handleNewLayers: function(params) {
		var layers = params && params.layers;
		this.indicateNewContent(layers && layers.length && layers.length >= this.layers.length);
		this.layers = (layers || []).slice(0);
		this.updateContents();
	},
	setIcon: function(path) {
		if(!path) {
			return;
		}
		// If icon path is not absolute, prepend the app's document location, since the window's document is in enyo.
		if (path[0] !== '/') {
			path = this.docPath+path;
		}
		this.$.icon.setSrc(path);
	},
	/** @private Called to manage the new message throbber, displayed when device is off. */
	indicateNewContent: function(hasNew) {
		if (!window || !window.PalmSystem) {
			return;
		}
		if (this._throbId) {
			window.PalmSystem.removeNewContentIndicator(this._throbId);
			this._throbId = undefined;
		}
		if (hasNew) {
			this._throbId = window.PalmSystem.addNewContentIndicator();
		}		
	},
	sendEventToApp: function(eventType, args) {
		args = args || [];
		if(window.opener) {
			window.opener.postMessage("enyoDashboardEvent="+enyo.json.stringify({event:eventType, args:args, dashboardId:this.dashboardId}), "*");
		}
	},
	// Used to fake the old click event for compatibility purposes.  
	// The event will simply be removed in a future release, and this can go away.
	makeFakeEvent: function(e) {
		var fakeEvent = {};
		this.fakeEventProps.forEach(function(prop) {
			fakeEvent[prop] = e[prop];
		});
		fakeEvent.currentTarget = {};
		fakeEvent.target = {};
		return fakeEvent;
	},
	fakeEventProps: ["y","screenY","layerX","which","clientX","shiftKey","timeStamp","eventPhase",
						"cancelable","screenX","offsetX","bubbles","x","button","defaultPrevented",
						"altKey","keyCode","offsetY","clientY","ctrlKey","layerY","charCode","pageX",
						"detail","type","cancelBubble","pageY","metaKey"]
	
});
/** @private Text-label layer within dashboard window.*/
enyo.kind({
	name: "enyo.DashboardLayer",
	kind: "enyo.Control",
	className: "dashboard-layer",
	components:[
			{name:'swipeable', kind: "enyo.AnimatedSwipeableItem", allowLeft:false, onDrag: "configureClipping", onConfirm:"doSwipe", 
										className: "palm-dashboard-text-container", confirmRequired:false, components: [
				{name:'title', className:"dashboard-title"},
				{name:'text', className:"palm-dashboard-text"}
			]}
	],
	published: {
		layer: null,
		swipeable: true,
		clipControl: null,
		leftOffset: 0 // extra ammt to add for clipping to reveal a peek at underlying content
	},
	events: {
		onSwipe: ""
	},
	create: function() {
		this.inherited(arguments);
		this.swipeableChanged();
	},
	// With no layer above it (dx null), the one under shows all the way to
	// the right edge, wherever that is: dashboard.css takes each layer there.
	configureClipping: function(inSender, dx) {
		if (this.clipControl) {
			this.clipControl.setStyle(dx === null ? "" : "width:"+Math.max(0, dx + this.leftOffset)+"px;"); // clipping div should be 10 greater than drag position, but never < 4.
		}
	},
	layerChanged: function() {
		if (this.layer) {
			this.show();
			this.$.title.setContent(this.layer.title);
			this.$.text.setContent(this.layer.text);
			this.configureClipping(this, 0);
		} else {
			this.hide();
			this.configureClipping(this, null);
		}
	},
	swipeableChanged: function() {
		this.$.swipeable.setSwipeable(this.swipeable);
	}
});

