// The test app's kinds. Each field's editable node is marked
// data-caret="<name>" for the suite, and window.caretTest lets the suite put
// a field back to a known text between checks.

enyo.kind({
	name: "CaretTest.App",
	kind: enyo.VFlexBox,
	published: {
		frame: ""
	},
	components: [
		{className: "caret-row", name: "rowPlain", components: [
			{kind: "Input", name: "plain", value: "The quick brown fox jumps over", autocorrect: false, spellcheck: false, autoCapitalize: "lowercase"}
		]},
		{className: "caret-row", name: "rowEmail", components: [
			{kind: "Input", name: "email", inputType: "email", value: "someone.else@example.com", autocorrect: false, spellcheck: false, autoCapitalize: "lowercase"}
		]},
		{className: "caret-row", name: "rowRich", components: [
			{kind: "RichText", name: "rich", richContent: false, value: "Lorem ipsum dolor sit amet", autocorrect: false, spellcheck: false}
		]},
		{className: "caret-row", name: "rowButton", components: [
			{kind: "Button", name: "button", caption: "Count", onclick: "countClick"}
		]},
		{kind: "Scroller", name: "scroller", className: "caret-scroller", components: [
			{className: "caret-spacer"},
			{className: "caret-row", components: [
				{kind: "Input", name: "deep", value: "Deep field inside a scroller", autocorrect: false, spellcheck: false, autoCapitalize: "lowercase"}
			]},
			{className: "caret-spacer"},
			{className: "caret-spacer"}
		]},
		{kind: "Iframe", name: "frame", className: "caret-frame"}
	],
	clicks: 0,
	countClick: function () {
		this.clicks++;
	},
	rendered: function () {
		this.inherited(arguments);
		var self = this;
		["plain", "email", "rich", "deep"].forEach(function (n) {
			var node = self.$[n].hasNode();
			var editable = node && node.querySelector("input, textarea, [contenteditable]");
			if (editable) {
				editable.setAttribute("data-caret", n);
			}
		});
		var b = this.$.button.hasNode();
		if (b) {
			b.setAttribute("data-caret-button", "button");
		}
		if (this.frame && this.$.frame.getUrl() != this.frame) {
			this.$.frame.setUrl(this.frame);
		}
		window.caretTest = {
			app: this,
			texts: {
				plain: "The quick brown fox jumps over",
				email: "someone.else@example.com",
				rich: "Lorem ipsum dolor sit amet",
				deep: "Deep field inside a scroller"
			},
			reset: function (n) {
				self.$[n].setValue(this.texts[n]);
			},
			clicks: function () {
				return self.clicks;
			},
			scrollTop: function () {
				return self.$.scroller.getScrollTop();
			},
			setScrollTop: function (y) {
				self.$.scroller.setScrollTop(y);
			},
			// Only what is being tested, so that it is on screen however small
			// the screen (the Q25 shows 450x340): a field's row, or (null)
			// the button and the scroller for the page checks.
			show: function (n) {
				var rows = {plain: "rowPlain", email: "rowEmail", rich: "rowRich", deep: "scroller", framed: "frame"};
				["rowPlain", "rowEmail", "rowRich", "rowButton", "scroller", "frame"].forEach(function (r) {
					self.$[r].setShowing(n ? rows[n] == r : (r == "rowButton" || r == "scroller"));
				});
				return true;
			}
		};
	}
});

enyo.kind({
	name: "CaretTest.Frame",
	kind: enyo.VFlexBox,
	components: [
		{className: "caret-row", components: [
			{kind: "Input", name: "framed", value: "Field inside a frame here", autocorrect: false, spellcheck: false, autoCapitalize: "lowercase"}
		]}
	],
	rendered: function () {
		this.inherited(arguments);
		var self = this;
		var node = this.$.framed.hasNode();
		var editable = node && node.querySelector("input, textarea, [contenteditable]");
		if (editable) {
			editable.setAttribute("data-caret", "framed");
		}
		window.caretTest = {
			texts: {framed: "Field inside a frame here"},
			reset: function (n) {
				self.$[n].setValue(this.texts[n]);
			}
		};
	}
});
