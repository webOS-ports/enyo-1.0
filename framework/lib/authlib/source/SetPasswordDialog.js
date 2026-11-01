enyo.kind ({
	name: "SetPasswordDialog", 
	kind: enyo.ModalDialog,
	modal: true,
	published: {
		policy: "",
		// The passcode set now, when one is: luna-authmanager wants it with
		// any change of the passcode (SecurityPolicyGuard verifies it first)
		currentPasscode: ""
	},
	events: {
		onDone: "",
		onCancel: ""
	},
	caption: rb_auth.$L("Set Password"),
	components: [		
		{name: "hint", className: "enyo-dialog-prompt-message"},
		{name: "error", showing: false},
		{name: "password", kind: "PasswordInput", hint: rb_auth.$L("enter password..."), onkeypress:"handleKeyPress"},
		{name: "passwordconfirm", kind: "PasswordInput", hint: rb_auth.$L("confirm password..."), onkeypress:"handleKeyPress"},
		{name: "acceptButton", content:rb_auth.$L("Done"), className:"enyo-button-affirmative", kind: "Button", onclick: "acceptClick"},
		{name: "cancelButton", content:rb_auth.$L("Cancel"), kind: "Button", onclick: "cancelClick"},
		{name: "setPassword", kind:"PalmService", service:"palm://com.palm.systemmanager/", method: "setDevicePasscode", onSuccess:"setPasswordSuccess", onFailure: "setPasswordFailure"}
	],
	policyChanged: function() {
		this.log(this.policy);
		if ( this.policy.alphaNumeric === true ) {
			if ( this.policy.minLength > 1 ) {
				this.$.hint.setContent((new enyo.g11n.Template(rb_auth.$L("Password must be #{len} or more characters long and contain both numbers and letters."))).evaluate({
					len: this.policy.minLength
				}));
			} else {
				this.$.hint.setContent(rb_auth.$L("Password must contain both numbers and letters."));
			}
		} else {
			if ( this.policy.minLength > 1 ) {
				// enyo.application.Utils.interpolate($L("Password must be #{len} or more characters long."),{len: this.policy.minLength})
				this.$.hint.setContent((new enyo.g11n.Template(rb_auth.$L("Password must be #{len} or more characters long."))).evaluate({
					len: this.policy.minLength
				}));
				//this.$.hint.setContent(rb_auth.$L("Password must be " + this.policy.minLength + " or more characters long."));
			}
		}
	},
	acceptClick: function() {
		if (this.$.password.getValue() !== this.$.passwordconfirm.getValue()){
			this.setErrorMessage(rb_auth.$L("Passwords do not match."));
			this.$.password.forceFocus();
		} else {
			var params = {
				passCode: this.$.password.getValue(),
				lockMode: "password"
			};
			if (this.currentPasscode)
				params.currentPasscode = this.currentPasscode;
			this.$.setPassword.call(params);
		}
	},
	open: function() {
		this.inherited(arguments);
		this.$.password.forceFocus();
	},	
	cancelClick: function(inSender) {
		this.currentPasscode = "";
		this.setErrorMessage();
		this.doCancel();
		this.close();
	},
	setPasswordSuccess: function(inSender) {
		this.currentPasscode = "";
		this.setErrorMessage();
		this.doDone();
		this.close();
	},
	setPasswordFailure: function(inSender, response) {
		// -12: the current passcode was not right (or no longer is)
		if (response && response.errorCode === -12) {
			this.currentPasscode = "";
			this.setErrorMessage(response.lockedOut
				? rb_auth.$L("Device Locked.  Try Again Later.")
				: rb_auth.$L("Your current password could not be confirmed."));
			this.doCancel();
			this.close();
			return;
		}
		this.setErrorMessage(rb_auth.$L("Password does not match security requirements."));
		this.$.password.forceFocus();
	},
	// resets and sets error message, if one defined
	setErrorMessage: function(message) {
		this.$.password.setValue('');
		this.$.passwordconfirm.setValue('');
		this.$.error.setContent(message || '');
		this.$.error.setShowing(!!message);
	},
	handleKeyPress: function(inSender, inEvent) {
		if(inEvent && inEvent.keyCode == 13) {
			if(this.$.password.hasFocus()) {
				this.$.passwordconfirm.forceFocus();
			}
			else if(this.$.passwordconfirm.hasFocus()) {
				this.$.passwordconfirm.forceBlur();
				this.acceptClick();	
			}
		}
	}
}); 
