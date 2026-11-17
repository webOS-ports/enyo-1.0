//* @protected

enyo.requiresWindow(function() {
	// Touch events are not used by enyo on device, due to the need to process
	// mouse events for over, out, move, click processing.
	// Users should use touch events directly via addEventListener.
	//
	// add iPhone OS-specific gesture feature
	enyo.dispatcher.features.push(
		function(e) {
			//console.log("iphoneGesture processing ", e.type);
			if (enyo.iphoneGesture[e.type]) {
				enyo.iphoneGesture[e.type](e);
			}
		}
	);
	//
	enyo.iphoneGesture = {
		_send: function(inType, inTouch) {
			//console.log("iphoneGesture._send:", inType);
			//console.log(inTouch.target.tagName);
			var synth = {
				type: inType,
				preventDefault: enyo.nop
			};
			enyo.mixin(synth, inTouch);
			enyo.dispatch(synth);
		},
		touchstart: function(e) {
			this._send("mousedown", e.changedTouches[0]);
			// The browser makes a tap's own mousedown and click only from a touch
			// that is not prevented, and it is that mousedown that focuses a text
			// field and puts the caret where the finger was (or selects, on a long
			// press). So a touch on a text field - an input, a textarea, or a
			// RichText, which is contenteditable - is left to the browser.
			if (e.target && !this.isText(e.target)) {
				e.preventDefault();
			}
		},
		isText: function(inNode) {
			return inNode.nodeName == "INPUT" || inNode.nodeName == "TEXTAREA" || Boolean(inNode.isContentEditable);
		},
		touchmove: function(e) {
			this._send("mousemove", e.changedTouches[0]);
		},
		touchend: function(e) {
			this._send("mouseup", e.changedTouches[0]);
			this._send("click", e.changedTouches[0]); 
		},
		connect: function() {
			var options = false;
			if (enyo.passiveSupported()) options = { passive:false }
			document.addEventListener("touchstart", enyo.dispatch, options);
			document.addEventListener("touchmove", enyo.dispatch, options);
			document.addEventListener("touchend", enyo.dispatch, options);
		}
	};
	//
	enyo.iphoneGesture.connect();
});
