/*globals AccountsUtil, AccountError, LoginUtils, enyo, $ */
// Allow the editing of account credentials when creating or editing an account
//
// Usage:
// ======
//
// Depends:
// Add this line to your app's depends.js file:
// "$enyo-lib/accounts/"
//
// Kind:
// Two kinds are available, depending on whether you want a Page Title and "Cancel" button on your screen or not
// {kind: "Accounts.credentialView", name: "changeCredentials", onCredentials_ValidationSuccess: "onValidationSuccess", onCredentials_Cancel: "backHandler"}  // Full screen incl. title and Cancel
// {kind: "Accounts.credentials", name: "changeCredentials", onCredentials_ValidationSuccess: "onValidationSuccess"}, // No title or Cancel button
//
// Prompt the user for credentials:
// account: The account credentials to change.  Pass in the account account if creating an account
// capability: With accounts having multiple validators this specifies the capability that MUST succeed for the account to be created.  Example, 'MAIL'
// this.$.changeCredentials.displayCredentialsView(account, capability);
//
// The callback:
// 	onValidationSuccess: function(inSender, validationObj) {
//		var validationObj = validationObj;	// Validation object used to create the account

enyo.kind({
	name: "Accounts.credentials",
	kind: enyo.Control,
	events: {
		onCredentials_ValidationSuccess: "",
		onCredentials_Cancel: ""
	},
	components: [
		{name: "usernameTitle", kind: "RowGroup", className:"accounts-group", components: [
			{kind: "Input", name: "username", spellcheck: false, autocorrect:false, autoCapitalize: "lowercase", inputType:"email", changeOnInput: true, onchange: "keyTapped", onkeydown:"checkForEnter"}
		]},
		{name: "passwordTitle", kind: "RowGroup", className:"accounts-group", components: [
			{kind: "PasswordInput", name: "password", changeOnInput: true, onchange: "keyTapped", onkeydown:"checkForEnter"}
		]},
		{name: "Oauth2Group", caption:"Oauth2", kind: "RowGroup", className:"accounts-group", showing:false, components: [
			{kind: enyo.RowItem, layoutKind: enyo.HFlexLayout, components: [
					{name: "tokenParams", flex: 1}
			]},
			{caption:"Oauth2 scopes", kind: "RowGroup", className:"accounts-group", components: [
				{name: "scopeList", kind: "VirtualRepeater", onSetupRow: "gScope", components: [
					{kind: enyo.Item, name: "capItem", onclick: "", layoutKind: enyo.HFlexLayout, components: [
						{name: "capName", flex: 1}
					]}
				]}
			]},
			{name:"refreshButton", caption: "Get Token", kind: "ActivityButton", className:"enyo-button-affirmative", onclick: "refreshTapped"},
			{name:"revokeButton", caption: "Revoke Token", kind: "ActivityButton", className:"enyo-button-negative", onclick: "revokeTapped"}
		]},
		{name: "errorBox", kind: "enyo.HFlexBox", className:"error-box", align:"center", showing:false, components: [
			{name: "errorImage", kind: "Image", src: AccountsUtil.libPath + "images/header-warning-icon.png"},
			{name: "errorMessage", className: "enyo-text-error", flex:1}
		]},
		{name:"signInButton", kind: "ActivityButton", className:"enyo-button-dark accounts-btn", onclick: "signInTapped"},
		{name:"removeAccountButton", kind: "Accounts.RemoveAccount", className:"accounts-btn", onAccountsRemove_Removing: "removingAccount", onAccountsRemove_Done: "doCredentials_Cancel"},
		{name: "oauth2Popup", lazy:true, kind: enyo.ModalDialog, style:"height:600px;width:450px;", scrim:true, caption: "Oauth2 Login", showing:false, components: [
			{name: "oauth2View", kind: "Accounts.Oauth2View", onExit:"evalToken"}
		]},
		{name: "callValidators", kind: "PalmService", onResponse: "validationResponse"},
		{name: "getCredentials", kind: "PalmService", service: "palm://com.palm.service.accounts/", method: "readCredentials", onResponse: "readCredentialsResponse"},
		{name: "oauth2Request", kind: "PalmService", service: "palm://com.palm.service.accounts/", method: "modifyOauth2", onResponse: "oauth2Response"},
		{name: "duplicateCheck", kind: "Accounts.DuplicateCheck", onAccountsDuplicate_Success: "duplicateSuccess", onAccountsDuplicate_Duplicate: "duplicateAccount"}
	],
	
	// Show the credentials
	displayCredentialsView: function(account, capability) {
		this.account = account;
		this.capability = capability || "";
		
		// Update the group captions
		if (this.account.loc_usernameLabel){
			this.$.usernameTitle.setCaption(this.account.loc_usernameLabel);
		} else {
			this.$.usernameTitle.setCaption(AccountsUtil.LIST_TITLE_USERNAME);
		}
		if (this.account.loc_passwordLabel){
			this.$.passwordTitle.setCaption(this.account.loc_passwordLabel);
		} else {
			this.$.passwordTitle.setCaption(AccountsUtil.LIST_TITLE_PASSWORD);
		}
		// Clear the password field and initialize the username field
		this.$.password.setValue("");
		this.$.username.setValue(this.account.username || "");
		
		// Show the "Remove Account" button if the account is in error
		if (this.account.credentialError){
			this.$.removeAccountButton.init(this.account, this.capability);
		} else {
			this.$.removeAccountButton.hide();
		}
		console.error("acct : " + (this.account._id));
		console.error("acct oauth2 config: " + !!(this.account && this.account.config && this.account.config.oauth2_config));
		if(AccountsUtil.hasMixedAuth(this.account) && AccountsUtil.hasValidOauth2Config(this.account)){
			this.oauth2config = this.account.config.oauth2_config;
			this.$.getCredentials.call({accountId:this.account._id, name:"oauth2creds"});
			this.$.Oauth2Group.setShowing(true);
			this.oauth2scopes = AccountsUtil.oauth2Capabilities(this.account);
			if(this.oauth2scopes.length > 0){
				this.$.scopeList.render();
			}
		} else {
			this.$.Oauth2Group.setShowing(false);
		}
		// Reset the form fields
		this.resetForm();
	},
	
	oauth2Response: function(inSender, inResponse) {
		var action, r = inResponse, ui = this.$;
		console.error("oauth2Response returnValue: " + (inResponse.returnValue));
		ui.refreshButton.setActive(false);
		ui.revokeButton.setActive(false);
		if(r && r.returnValue){
			action = r.action;
			if(action === "revoke"){
				console.error("revoked token");
				ui.revokeButton.setDisabled(true);
				ui.refreshButton.setCaption("Get Token");
				ui.tokenParams.setContent("Token not issued");
				ui.errorMessage.setContent("You must have an Oauth2 token to sign in");
				ui.errorBox.show();
				this.gotNewOauth2Token = false;
				this.savedCreds = false;
				this.configRequest = "get";
				//remove the tokens so next time we will do a get
				this.newOauth2creds = {};
				this.access_token = undefined;
				this.refresh_token = undefined;
				this.expiresTS = undefined;
			}
			if(action === "forcedRefresh"|| action === "save" ){
				if(r.oauth2creds.expiresTS && r.oauth2creds.access_token && r.oauth2creds.refresh_token){
					console.error("oauth2Response " + action + " token");
					var dt = new Date();
					dt.setTime(r.oauth2creds.expiresTS);
					ui.tokenParams.setContent("Token expires: "+ dt.toLocaleString());
					ui.refreshButton.setCaption("Refresh Token");
					ui.errorMessage.setContent("");
					ui.errorBox.hide();
					if(this.username.length > 0 && this.password.length > 0){
						ui.signInButton.setDisabled(false);
					}
					this.configRequest = "forcedRefresh";
					this.newOauth2creds = {};
					this.newOauth2creds.access_token = this.access_token = r.oauth2creds.access_token;
					this.newOauth2creds.refresh_token = this.refresh_token = r.oauth2creds.refresh_token;
					this.newOauth2creds.expiresTS = this.expiresTS = r.oauth2creds.expiresTS;
					this.newOauth2creds.token_type = r.oauth2creds.token_type || "Bearer";
				}
				if(r.invalid_grant){
					console.error("Forced revoke, invalid grant result:" +JSON.stringify(r));
					this.gotNewOauth2Token = false;
					//remove the tokens so next time we will do a get
					this.newOauth2creds = {};
					this.access_token = undefined;
					this.refresh_token = undefined;
					this.expiresTS = undefined;
					this.configRequest = "get";
					ui.revokeButton.setDisabled(true);
					ui.refreshButton.setCaption("Get Token");
					ui.tokenParams.setContent("Token revoked by user");
					ui.errorMessage.setContent("You must have an Oauth2 token to sign in");
					ui.errorBox.show();
				}
			}
		}
	},
	
	readCredentialsResponse:  function(inSender, inResponse) {
		var creds, ui = this.$;
		try{
			creds = inResponse.returnValue && inResponse.credentials;
			//console.error("credentials response: " + JSON.stringify(inResponse));
		} catch(e){
			console.error("no credentials !!!!");
		}
		if (creds) {
			//console.error("credentials: " + JSON.stringify(creds));
			this.savedCreds = creds;
			console.error("oauth2 credentials: " + !!(creds));
			this.refresh_token = creds.refresh_token;
			this.access_token = creds.access_token;
			this.expiresTS = creds.expiresTS;
			this.configRequest = "forcedRefresh";
			if(this.expiresTS){
				var dt = new Date();
				dt.setTime(this.expiresTS);
				ui.tokenParams.setContent("Token expires: " + dt.toLocaleString());
			}
			ui.revokeButton.setDisabled(false);
			ui.refreshButton.setCaption("Refresh Token");
			ui.errorMessage.setContent("");
			ui.errorBox.hide();
			return;
		}
		ui.errorMessage.setContent("You must have an Oauth2 token to sign in");
		ui.errorBox.show();
		this.gotNewOauth2Token = false;
		this.newOauth2creds = {};
		this.access_token = undefined;
		this.refresh_token = undefined;
		this.expiresTS = undefined;
		this.configRequest = "get";
		ui.tokenParams.setContent("Token not issued");
		ui.refreshButton.setCaption("Get Token");
		ui.revokeButton.setDisabled(true);
	},
	
	gScope: function(inSender, inIndex){
		if(!this.account || !this.oauth2scopes){return;}
		if(inIndex < this.oauth2scopes.length){
			var ui = this.$, item = this.oauth2scopes[inIndex];
			ui.capName.setContent(item);
			return true;
		}
		if(inIndex === this.oauth2scopes.length && this.oauth2scopes.length !== 0){
			if(this.oauth2config.scope  && this.oauth2config.scope.indexOf("www.googleapis.com/auth/calendar") !== -1){
				this.$.capName.setContent("Google+ Required for Oauth2");
				return true;
			}
		}
	},
	
	refreshTapped: function(){
		console.error("refresh tapped");
		var obj;
		if(this.configRequest === "get"){
			this.$.oauth2Popup.lazy && this.$.oauth2Popup.validateComponents();
			this.$.oauth2Popup.openAtCenter();
			this.$.oauth2View.setupParams(this.account, this.oauth2config);
			return;
		}
		if(this.configRequest === "save" && this.gotNewOauth2Token && this.account && this.accout._id){
			obj = {request:"save", accountId: this.account._id, oauth2creds: this.newOauth2creds, returnFullCreds: true};
			console.error(" save token request: " +JSON.stringify(obj));
			this.$.oauth2Request.call(obj);
			return;
		}
		if(this.configRequest === "forcedRefresh"&& this.gotNewOauth2Token && this.account && this.accout._id){
			obj = {request:"forcedRefresh", accountId: this.account._id, returnFullCreds: true};
			if(this.newOauth2creds && this.newOauth2creds.access_token && this.newOauth2creds.refresh_token && this.newOauth2creds.expiresTS){
				obj.oauth2creds = this.newOauth2creds;
			} else if(this.access_token && this.refresh_token && this.expiresTS){
				obj.oauth2creds = {access_token: this.access_token,  refresh_token: this.refresh_token, expiresTS: this.expiresTS};
			}
			console.error(" forcedRefresh token request: " +JSON.stringify(obj));
			this.$.oauth2Request.call(obj);
			return;
		}
	},
	
	revokeTapped: function (){
		console.error("revoke tapped");
		if(this.refresh_token && this.access_token && this.expiresTS){
			var obj ={};
			obj.oauth2creds = {access_token: this.access_token, refresh_token: this.refresh_token, expiresTS:this.expiresTS};
			obj.request = "revoke";
			obj.accountId = this.account._id;
			this.$.oauth2Request.call(obj);
			return;
		}
	},
	
	evalToken: function(sender, creds){
		var ui = this.$;
		ui.refreshButton.setActive(false);
		//console.error("evalToken " + JSON.stringify(Object.keys(sender)));
		console.error("evalToken " + JSON.stringify(creds));
		if(creds){
			if(creds.expiresTS && creds.access_token && creds.refresh_token){
				var dt = new Date();
				dt.setTime(creds.expiresTS);
				ui.tokenParams.setContent("Token expires: "+ dt.toLocaleString());
				this.gotNewOauth2Token = true;
				if(this.account && this.account._id){
					ui.refreshButton.setCaption("Save Token");
					this.configRequest = "save";
				} else {
					ui.refreshButton.setCaption("Refresh Token");
					this.configRequest = "refresh";
					if(this.username.length > 0 && this.password.length > 0){
						ui.signInButton.setDisabled(false);
					}
				}
				ui.errorMessage.setContent("");
				ui.errorBox.hide();
				this.newOauth2creds = {};
				ui.revokeButton.setDisabled(false);
				this.newOauth2creds.access_token = this.access_token = creds.access_token;
				this.newOauth2creds.refresh_token = this.refresh_token = creds.refresh_token;
				this.newOauth2creds.expiresTS = this.expiresTS = creds.expiresTS;
				this.newOauth2creds.token_type = creds.token_type || "Bearer";
			}
		}
		ui.oauth2Popup.close();
	},
	
	// If both the username and password fields have data in them then enable the "Sign In" button
	keyTapped: function() {
		this.username = this.$.username.getValue();
		this.password = this.$.password.getValue();
		if (this.username.length > 0 && this.password.length > 0 && (!this.oauth2config || (this.oauth2config && this.access_token))){
			this.$.signInButton.setDisabled(false);
			if(this.oauth2config) {
				this.$.errorMessage.setContent("");
				this.$.errorBox.hide();
			}
		} else {
			this.$.signInButton.setDisabled(true);
			if(this.oauth2config && !this.access_token) {
				this.$.errorMessage.setContent("You must have an Oauth2 token to sign in");
				this.$.errorBox.show();
			}
		}
	},
	
	checkForEnter: function(inSender, inResponse) {
		// Was 'Enter' tapped?
		if (inResponse.keyCode != 13){
			return;
		}
		if (inSender.getName() === "username") {
			// Advance to the password field
			enyo.asyncMethod(this.$.password, "forceFocus");
		} else {
			// Can the user sign in now?
			if (!this.$.signInButton.getDisabled()) {
				this.$.password.forceBlur();
				this.signInTapped();
			} else if (!this.$.username.getDisabled()){
				enyo.asyncMethod(this.$.username, "forceFocus");
			}
		}
	},
	
	// The "Sign In" button was tapped
	signInTapped: function() {
		// Disable the "Sign In" and "Remove Acount" buttons
		this.$.signInButton.setDisabled(true);
		this.$.removeAccountButton.disableButton(true);
		// Change the text to Signing In
		this.$.signInButton.setCaption(AccountsUtil.BUTTON_SIGNING_IN);
		// Start the spinner on the button
		this.$.signInButton.setActive(true);
		// if we had the tokens required message up take it down
		if(this.oauth2config) {
			this.$.errorMessage.setContent("");
			this.$.errorBox.hide();
		}
		// Disable the username and password fields
		this.$.username.setDisabled(true);
		this.$.password.setDisabled(true);
		// Hide the error message, if there was one
		this.$.errorBox.hide();

		// The first validator is the one for the account
		this.validators = [{
			id: this.account.templateId,
			validator: LoginUtils.getValidatorAddress(this.account),
			config: this.account.config,
			capability: this.capability	// For now, assume that this is the validator for the requested capability
		}];
		// Add the validators for each capability (if they exist)
		this.account.capabilityProviders.forEach(function (c) {
			if (c.validator) {
				this.validators.push({
					id: c.id,
					validator: LoginUtils.getValidatorAddress(c),
					config: c.config,
					capability: c.capability
				});
				// If this capability supports the requested capability, then remove the capability from the default validator
				if (c.capability === this.capability){
					delete this.validators[0].capability;
				}
			}
		}.bind(this));
		//console.log("signInTapped: validators=" + enyo.json.stringify(this.validators));
		
		// Clear any errors
		this.validationError = undefined;
		// Initialise the validation results
		this.results = {
			templateId: this.account.templateId,
			username: this.username,
			credentials: {}
		};
		var i, l, v, params, props;
		// Call each validator to validate the credentials
		for (i=0, l = this.validators.length; i < l; i++) {
			v = this.validators[i];
			console.log("validate id=" + v.id);
			
			// Create the parameters that are passed to the service
			params = LoginUtils.createValidatorParams(this.username, this.password, v.id, v.config, undefined, {accountId: this.account._id});
			if(this.oauth2config){
				if(this.newOauth2creds && this.newOauth2creds.access_token && this.newOauth2creds.refresh_token && this.newOauth2creds.expiresTS){
					params.oauth2creds = this.newOauth2creds;
				} else if(this.access_token && this.refresh_token && this.expiresTS){
					params.oauth2creds = {access_token: this.access_token,  refresh_token: this.refresh_token, expiresTS: this.expiresTS};
				}
			}
			// Create the service parameters
			props = LoginUtils.getServiceMethod(v.validator);
			this.$.callValidators.call(params, props);
		}
	},
	
	validationResponse: function(inSender, inResponse, inRequest) {
//		console.log("validationResponse: results=" + enyo.json.stringify(inResponse));
//		console.log("validationResponse: inRequest=" + enyo.json.stringify(inRequest.params));
		var req = inRequest.params;
		
		// Loop through the validators.  Save these results and see if there are more outstanding
		var i, v, l, done = true; 
		for (i=0, l=this.validators.length; i < l; i++) {
			v= this.validators[i];
			if (v.id === req.templateId) {
				// Was there an exception or error?
				if (inResponse.exception || !inResponse.returnValue) {
					// The validation request will fail is ANY capability fails to validate.  This differs from
					// earlier (webOS 2.0) behaviour but is much less confusing for users
					
					// Display the error message for the provided capability if that capability fails to validate
					// otherwise display the first failure since it is probably the most accurate
					if (this.capability && this.capability === v.capability){
						this.validationError = inResponse.errorCode || "UNKNOWN_ERROR";
					} else{
						this.validationError = this.validationError || inResponse.errorCode || "UNKNOWN_ERROR";
					}
				}
				else {
					// Yes, validation worked!  Save the config and credentials
					this.results.config = this.results.config || inResponse.config;
					enyo.mixin(this.results.credentials, inResponse.credentials);
					
					this.results.username = inResponse.username || this.results.username;
					this.results.alias = inResponse.alias || this.results.alias;
				}
				v.done = true;
			}
			else {
				if (!v.done) {
					done = false;
				}
			}
		}
		if (!done){
			return;
		}
		// All of the validation requests have returned
		console.log("validationResponse: All requests are in!! Error=" + this.validationError);

		// If there is an error then display it and re-enable the Sign In button
		if (this.validationError) {
			this.resetForm(this.validationError);
			return;
		}
		
		// If modifying an existing account then return the successful result now
		if(this.results.credentials && !this.results.credentials.oauth2creds){
			//check to see if we need to add oauth2creds or it will be erased when the save is done
			if(this.newOauth2creds && this.newOauth2creds.access_token && this.newOauth2creds.refresh_token && this.newOauth2creds.expiresTS){
				enyo.mixin(this.results.credentials, {oauth2creds: this.newOauth2creds});
			} else if(this.savedCreds && this.savedCreds.access_token && this.savedCreds.refresh_token && this.savedCreds.expiresTS){
				enyo.mixin(this.results.credentials, {oauth2creds: this.savedCreds});
			}
		}
		if (this.account.username) {
			// Stop the spinner
			this.$.signInButton.setActive(false);
			this.doCredentials_ValidationSuccess(this.results);
		}
		else {
			// Make sure this account isn't a duplicate before it can be saved
			this.$.duplicateCheck.start(this.results, this.capability);
		}
	},
	
	// Account is not a duplicate
	duplicateSuccess: function(inSender, inResponse) {
		this.doCredentials_ValidationSuccess(inResponse);
		
		// Stop the spinner
		this.$.signInButton.setActive(false);
	},
	
	// Account already exists
	duplicateAccount: function(inSender, inResponse) {
		// The account already exists
		if (inResponse.isDuplicateAccount) {
			this.resetForm("DUPLICATE_ACCOUNT");	// Do not localize!  It will be localized by getErrorText
		}
		else {
			// The account exists and the capability has been turned on.
			// Modify the result to let the caller know the capability was enabled
			inResponse.capabilityWasEnabled = true;
			this.doCredentials_ValidationSuccess(inResponse);

			// Stop the spinner
			this.$.signInButton.setActive(false);
		}
	},
	
	// Reset all the fields on the form
	resetForm: function(error) {
		// Show an error if one was provided
		if (error) {
			this.$.errorMessage.setContent(AccountError.getErrorText(error));
			this.$.errorBox.show();
		}
		else {
			this.$.errorBox.hide();
		}
		
		// Enable the username and password fields
		if (this.account.username) {
			this.$.username.setDisabled(true);
			if (error){
				this.$.password.setSelection({start: 0, end: this.password.length});
			}
			if (this.account.allowPasswordFocus && !this.oauth2config){
				enyo.asyncMethod(this.$.password, "forceFocus");
			}
		}
		else {
			this.$.username.setDisabled(false);
			if (error && !this.oauth2config) {
				this.$.password.setSelection({start: 0, end: this.password.length});
				enyo.asyncMethod(this.$.password, "forceFocus");
			}
			else if (!this.oauth2config){
				enyo.asyncMethod(this.$.username, "forceFocus");
			}
		}
		//force the Oauth2 creds to be reset
		if(error && this.oauth2config){
			this.$.revokeButton.setDisabled(true);
			this.$.refreshButton.setCaption("Get Token");
			this.$.tokenParams.setContent("Token not issued");
			this.gotNewOauth2Token = false;
			this.savedCreds = false;
			this.configRequest = "get";
			//remove the tokens so next time we will do a get
			this.newOauth2creds = {};
			this.access_token = undefined;
			this.refresh_token = undefined;
			this.expiresTS = undefined;
		}
		this.$.password.setDisabled(false);
		
		// Reset the "Sign In" button
		this.$.signInButton.setCaption(AccountsUtil.BUTTON_SIGN_IN);
		this.$.signInButton.setActive(false);
		this.keyTapped();
		
		// Enable the "Remove Account" button
		this.$.removeAccountButton.disableButton(false);
	},
	
	// The account (or capability) is being removed
	removingAccount: function() {
		// Disable the "Sign In" button
		this.$.signInButton.setDisabled(true);
		// Disable the username and password fields
		this.$.username.setDisabled(true);
		this.$.password.setDisabled(true);
	}
});

enyo.kind({
	name: "Accounts.credentialView",
	kind: "enyo.VFlexBox",
	className:"enyo-bg",
	events: {
		onCredentials_Cancel: "",
		onCredentials_ValidationSuccess: ""
	},
	components: [
		{kind:"Toolbar", className:"enyo-toolbar-light accounts-header", pack:"center", components: [
			{kind: "Image", name:"titleIcon"},
	        {kind: "Control", content: AccountsUtil.PAGE_TITLE_SIGN_IN}
		]},
		{className:"accounts-header-shadow"},
		{kind: "Scroller", flex: 1, components: [
			{kind: "Control", className:"box-center", components: [
				{kind: "Accounts.credentials", name: "credentials", onCredentials_ValidationSuccess: "doCredentials_ValidationSuccess", onCredentials_Cancel: "doCredentials_Cancel"}
			]}
		]},
		{className:"accounts-footer-shadow"},
		{kind:"Toolbar", className:"enyo-toolbar-light", components:[
			{kind: "Button", label: AccountsUtil.BUTTON_CANCEL, className:"accounts-toolbar-btn", onclick: "doCredentials_Cancel"}
		]}
	],
	
	displayCredentialsView: function(account, capability) {
		// Update the icon on the page title
		if (account && account.icon && account.icon.loc_48x48){
			this.$.titleIcon.setSrc(account.icon.loc_48x48);
		} else {
			this.$.titleIcon.setSrc(AccountsUtil.libPath + "images/acounts-48x48.png");
		}
		account.allowPasswordFocus = true;
		this.$.credentials.displayCredentialsView(account, capability);
	}
});

enyo.kind({
	name		: "Accounts.Oauth2View",
	kind		: enyo.Pane,
	style: "height:530px;width:450px;",
	
	events:
	{	onExit: ""
	},
	
	published:
	{	account: false
	},
	
	components: [
		{name: "Oauth2WebView", kind: enyo.VFlexBox, components: [
			{name:"contentScroller", kind: enyo.Scroller, flex: 1, components: [
				{name:"Oauth2Browser", kind: "WebView", onPageTitleChanged:"titleChanged", url: "http://www.google.com"}
			]},
			{kind: enyo.VFlexBox, components:[
				{name: "btnCancel"	, kind: enyo.Button, caption: "Close"	, onclick: "closeClicked"	, flex: 1, className: "enyo-button-light"}
			]}
		]},
		{name: "getToken", kind:"WebService", method: "POST", contentType: 'application/x-www-form-urlencoded', onSuccess:"gotToken", onFailure: "gotToken"}
	],
	
	create: function create () {
		this.inherited (arguments);
		this.TAG = 'Oauth2 webview:';
	},
	
	setupParams: function(acct, oauthConfig){
		this.method = null;
		this.account = acct;
		this.empty = false;
		if(!oauthConfig){
			oauthConfig = {}; this.empty = true;
			console.error("Oauth2 web no config");
		}
		if(oauthConfig){
			this.revokeTokenUrl = oauthConfig.revoke_token_url;
			this.authorizeUrl = oauthConfig.auth_url;
			this.accessTokenUrl = oauthConfig.token_url;
			this.client_id = oauthConfig.client_id;
			this.client_secret = oauthConfig.client_secret;
			this.authParams = oauthConfig.auth_params;
			this.tokenParams = oauthConfig.token_params;
			this.refreshParams = oauthConfig.refresh_params;
			this.validateUrl = oauthConfig.validate_url;
			if (oauthConfig.redirect_uri != undefined){ 
				this.redirect_uri = oauthConfig.redirect_uri;
			} else {
				this.redirect_uri = 'urn:ietf:wg:oauth:2.0:oob';
			}
			this.response_type = oauthConfig.response_type;
			this.scope = oauthConfig.scope;
			this.url = 'www.google.com';
			this.requested_token = '';
			this.exchangingToken = false;
			var url = '';
			url = this.empty ? this.url : this.requestGrant();
			console.error(this.TAG + ' activate '+ url);
			this.$.Oauth2Browser.clearCookies();
			this.$.Oauth2Browser.clearCache();
			this.$.Oauth2Browser.setUrl(url);
		}
	},
	
	titleChanged: function(inSender, inTitle, inBack, inForward){
		console.error(this.TAG + ' code got inTitle ' + inTitle + ", sender: " + JSON.stringify(Object.keys(inSender)));
		var idx, title = inTitle || "";
		idx = title.indexOf("code=") +5;
		if (!this.exchangingToken && (idx && idx >= 5)) {
			console.error(this.TAG + ' code got idx ' + idx);
			//this.controller.get('WebId').hide();
			var code = title.substring(idx);
			if (code) {
				console.error(this.TAG + ' code is ' + code);
				this.codeToken(code);
			}
		}
	},
	
	requestGrant: function() {
		console.error(this.TAG + ' requestGrant');
		if(this.empty){
			return '';
		}
		
		var i, item, len = this.authParams.length, url = this.authorizeUrl.slice();
		//url = url +'?';
		for(i=0;i<len;i++){
			item = this.authParams[i];
			if(item.indexOf('=') === -1){
				url = url + (i === 0 ? '?' : '&') + item + '=' + encodeURIComponent(this[item]); 
			} else {
				url = url + (i === 0 ? '?' : '&') + item;
			}
		}
		if(this.account && this.account.username && this.account.username.indexOf('@') !== -1){
			url = url + "&login_hint=" + encodeURIComponent(this.account.username);
		}	
		return url;
		//this.controller.get('WebId').mojo.openURL(url);
	},
	
	codeToken: function(code) {
		this.exchangingToken = true;
		this.url = this.accessTokenUrl;
		this.code = code;
		var i, item, len = this.tokenParams.length, postBody;
		//url = url +'?';
		//first param is text infront of token
		postBody = this.tokenParams[0] +encodeURIComponent(this.code);
		for(i=1;i<len;i++){
			item = this.tokenParams[i];
			if(item.indexOf('=') === -1){
				postBody = postBody + '&' + item + '=' + encodeURIComponent(this[item]); 
			} else {
				postBody = postBody + '&' + item;
			}
		}
		console.error("codeToken postBody = "+ postBody);
		this.$.getToken.setUrl(this.url);
		this.$.getToken.call(postBody);
	},
	
	gotToken: function(inSender, inResponse, inRequest){
		console.error("refresh results, status: " + inRequest && inRequest.xhr && inRequest.xhr.status);
		var status = inRequest && inRequest.xhr && inRequest.xhr.status;
		var r = inResponse;
		console.error("refresh results, xhr responseText: " + inRequest && inRequest.xhr && inRequest.xhr.responseText);
		console.error("refresh results, refresh_token: " + !!(r && r.refresh_token));
		if(status == 200){
			//success - save & return;
			var js = {}, tokns ={};
			if(r && r.access_token && r.refresh_token && r.expires_in && r.token_type){
				js = r;	
			} else {
				try{
					console.error("failed to get json response trying parse: " + inRequest && inRequest.xhr && inRequest.xhr.responseText);
					js = inRequest && inRequest.xhr && JSON.parse(inRequest.xhr.responseText);
				
				} catch(e){
					//failed to refresh
					console.error("failed to get refresh code : " + e.message);
				}
			}
			if(js.access_token && js.expires_in && js.refresh_token){
				tokns.access_token = js.access_token;
				tokns.token_type = js.token_type || "Bearer";
				tokns.expiresTS = ((new Date()).getTime() + (parseInt(js.expires_in,10)*1000));
				tokns.refresh_token = js.refresh_token;
			}
			this.doExit(tokns);
			this.reset();
			return;
		}
		//failed
		console.error("failed to get refresh code : " + status);
		this.doExit(false);
		this.reset();
	},
	
	closeClicked: function closeClicked() {
		this.exitView();
		return true;
	},
	
	exitView: function exitView () {
		this.reset();
		this.doExit();
	},
	
	reset: function reset () {
		var ui = this.$;
		//clear cookies
		ui.Oauth2Browser.clearCache();
		ui.Oauth2Browser.clearCookies();
		ui.contentScroller.setScrollTop(0);	// Reset the scroll position.
	}
});
