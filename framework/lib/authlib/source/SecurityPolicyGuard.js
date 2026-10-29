// main entry point for security policy stuff
enyo.kind({name: "SecurityPolicyGuard", 
			kind: "Control", 
			height:"0px",
			width: "100%",
			events: {
				onSuccess: "",
				onFailure: "",
				onCancel: ""
			},
			published: {
				policy: ""
			},
			components: [
			    {kind:"Popup", name: "secPops",  lazy:false, width:"360px", height:"360px",  className: "cust-enyo-popup",  components: [
			        {kind: enyo.VFlexBox, width: "320px", height: "325px", components: [                                                           	
				        {name:"pane", flex:1, kind:"Pane", transitionKind:enyo.transitions.Simple, height:"100%", components:[
			     			{name:"blank"},
			     			{name:"pinUnlock", kind: "PinUnlock", onCancelClick: "cancelLogin", onSetPinSuccess: "setPinSuccess", onPinVerified: "currentVerified"}
		     			]}
			        ]}
			    ]},
			             
	            // Dialogs
	            {name:"securityUpgradePrompt", lazy:false, kind:"SecurityUpgradePrompt", onPin:"choosePin", onPassword:"choosePassword", onCancel: "cancelUpgrade"},
	     		{name:"setPasswordDialog", lazy:false, kind:"SetPasswordDialog", onDone:"setPassword", onCancel:"cancelLogin"},
	     		{name:"passwordUnlock", lazy:false, kind:"PasswordUnlock", onPasswordVerified:"currentVerified", onCancelClick:"cancelVerify"},
	     		{name:"getLockMode", kind:"PalmService", service:"palm://com.palm.systemmanager/", method:"getDeviceLockMode", onResponse:"gotLockMode"}
			],
			/*
			 * luna-authmanager wants the current passcode with any change of
			 * it. While an Exchange policy is pending it lets one be set
			 * without, so the policy can always be met, but the passcode is
			 * still asked for first, as the settings app does: whoever holds
			 * an unlocked phone should not get to replace the passcode just
			 * by adding an account. It is kept for the one setDevicePasscode
			 * that follows and dropped after it, or on cancel.
			 *
			 * A pattern cannot be entered here (neither dialog draws one), so
			 * with a pattern lock the new passcode goes without it and the
			 * pending-policy rule above is what lets it through.
			 */
			currentPasscode: "",
			setSecurityPolicy: function(policyToLoad) {
				this.$.pinUnlock.reset();
				this.$.pinUnlock.setPinSet(true);
				this.$.secPops.openAtCenter();
			},
			
			policyChanged: function(){
				this.pendingSecurityPolicy = this.policy;
				this.currentPasscode = "";
				this.$.getLockMode.call({});
			},

			gotLockMode: function(inSender, response) {
				this.lockMode = (response && response.returnValue && response.lockMode) ? response.lockMode : "none";
				if (this.lockMode === "pin") {
					this.$.pane.selectViewByName("pinUnlock", true);
					this.$.pinUnlock.reset();
					this.$.pinUnlock.setPinSet(false);
					this.$.secPops.openAtCenter();
				} else if (this.lockMode === "password") {
					this.$.passwordUnlock.openAtCenter();
				} else {
					this.promptUpgrade();
				}
			},

			currentVerified: function(inSender, passcode) {
				this.currentPasscode = passcode || "";
				this.$.secPops.close();
				this.$.passwordUnlock.close();
				this.promptUpgrade();
			},

			cancelVerify: function() {
				this.$.passwordUnlock.close();
				this.cancelUpgrade();
			},

			promptUpgrade: function() {
				if (this.lockMode !== "none") {
					this.$.securityUpgradePrompt.setCaption(rb_auth.$L("Device Password Upgrade Required")); 
				} else {
					this.$.securityUpgradePrompt.setCaption(rb_auth.$L("Device Password Required"));
				}
				this.$.securityUpgradePrompt.setPolicy(this.pendingSecurityPolicy);
				this.$.securityUpgradePrompt.openAtCenter();
			},
			
			cancelLogin: function() {
				this.currentPasscode = "";
				this.$.secPops.close();
				this.doFailure()
			},			
			choosePin: function() {
				this.$.securityUpgradePrompt.close();
				this.$.pane.selectViewByName("pinUnlock",true);
				this.$.pinUnlock.setPinSet(true);
				this.$.pinUnlock.setCurrentPasscode(this.currentPasscode);
				this.currentPasscode = "";
				this.$.secPops.openAtCenter();
			},
			
			setPinSuccess: function() {
				console.log("### set pin success");
				this.doSuccess()
				this.$.secPops.close();
			},
			choosePassword: function() {
				this.$.securityUpgradePrompt.close();
				this.log("-----------setting policy",this.pendingSecurityPolicy)
				this.$.setPasswordDialog.setPolicy(this.pendingSecurityPolicy.password);
				this.$.setPasswordDialog.setCurrentPasscode(this.currentPasscode);
				this.currentPasscode = "";
				this.$.setPasswordDialog.openAtCenter();
			},
			setPassword: function(inSender, response) {
				this.doSuccess()
				this.$.secPops.close();
			},
			cancelUpgrade: function() {
				this.currentPasscode = "";
				this.$.secPops.close();
				this.doCancel();
			}
});
