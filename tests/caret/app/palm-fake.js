// A stand-in for WebAppMgr's PalmSystem, for a desktop browser opened with
// ?palm=1, so that Enyo takes the code paths it takes on a device. On a
// device the real PalmSystem is already there and this does nothing.
//
// simulateMouseClick() is recorded and does nothing else: a page cannot make
// trusted mouse events. The suite checks that text controls do not need it.
(function () {
	if (window.PalmSystem || !/[?&]palm=1(&|$)/.test(location.search)) {
		return;
	}
	var nop = function () {};
	window.caretSimulatedClicks = [];
	window.PalmSystem = {
		fake: true,
		launchParams: "{}",
		deviceInfo: JSON.stringify({screenWidth: 450, screenHeight: 800, keyboardAvailable: false}),
		identifier: "org.webosports.test.caret 1",
		locale: "en_us",
		localeRegion: "us",
		phoneRegion: "us",
		timeFormat: "HH12",
		TZ: "Europe/Amsterdam",
		isActivated: true,
		screenOrientation: "up",
		simulateMouseClick: function (x, y, down) {
			window.caretSimulatedClicks.push({x: x, y: y, down: down});
		},
		useSimulatedMouseClicks: nop,
		stageReady: nop,
		activate: nop,
		deactivate: nop,
		setWindowProperty: nop,
		setWindowProperties: nop,
		setWindowOrientation: nop,
		setManualKeyboardEnabled: nop,
		keyboardShow: nop,
		keyboardHide: nop,
		editorFocused: nop,
		allowResizeOnPositiveSpaceChange: nop,
		enableFullScreenMode: nop,
		addBannerMessage: nop,
		removeBannerMessage: nop,
		addNewContentIndicator: nop,
		removeNewContentIndicator: nop,
		runTextIndexer: nop,
		paste: nop,
		getResource: function () { return ""; }
	};
})();
