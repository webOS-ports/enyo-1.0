//* @protected
if (window.PalmSystem) {
	// add webOS-specific gesture features
	enyo.dispatcher.features.push(
		function(e) {
			if (enyo.webosGesture[e.type]) {
				enyo.webosGesture[e.type](e);
			}
		}
	);

	enyo.webosGesture = {
		mousedown: function(e) {
			// need to cache the target because the gesture events are missing this info
			this.lastDownTarget = e.target;
		}
		// NOTE: 'back' event is synthesized from ESC key on all platforms in core/Gesture.js
	};

	// FIXME: LunaSysMgr callbacks still use Mojo namespace.
	Mojo = window.Mojo || {};

	Mojo.handleGesture = function(type, properties) {
		if (type == "flick") {
			// the system sends flicks: scrollers stop simulating them
			enyo.webosGesture.systemFlicks = true;
		}
		var synth = enyo.mixin({type: type, target: enyo.webosGesture.lastDownTarget}, properties);
		enyo.dispatch(synth);
	};

	// NOTE: we are generating the event for orientation change by watching window.resize since
	// this method is not called on dartfish. However, it is called in catfish and sysmgr
	// generates an error if this function does not exist!
	Mojo.screenOrientationChanged = function() {};

	enyo.requiresWindow(function() {
		// add gesture event suppport
		// force passive to "false" to let Enyo use preventDefault()
		var options = false;
		if (enyo.passiveSupported()) options = { passive:false }
		document.addEventListener("touchstart", enyo.dispatch, options);
		document.addEventListener("touchmove", enyo.dispatch, options);
		document.addEventListener("touchend", enyo.dispatch, options);
	});
}

// window.webosEvent apparently not present on <= webOS 2.1; also needed for non-PalmSystem environments
if (typeof(webosEvent) === "undefined") {
	// thunk for device-only profiler API
	webosEvent = {
		event: enyo.nop,
		start: enyo.nop,
		stop: enyo.nop
	};
}
