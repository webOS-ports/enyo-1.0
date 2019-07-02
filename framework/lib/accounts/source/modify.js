/*globals enyo, $L, AccountsUtil */
// Allow the editing of account credentials when creating or editing an account
//
// Usage:
// ======
//
//
// TODO:
// 1. Handle broken capabilities
// 2. Handle case where this is no template (restore to different device)



enyo.kind({
	name: "Accounts.modifyView",
	kind: "Pane",
	events: {
		onModifyView_Success: "",
		onModifyView_Cancel: "",
		onModifyView_ChangeLogin: ""
	},
	components: [
		{},		// Empty view so that nothing is shown when switching to the Credentials view from a "bad credentials" dashboard
		{kind: "VFlexBox", name:"standardModifyView", flex:1, className:"enyo-bg", components: [
			{kind:"Toolbar", className:"enyo-toolbar-light accounts-header", pack:"center", components: [
				{kind: "Image", name:"titleIcon"},
		        {kind: "Control", content: AccountsUtil.PAGE_TITLE_ACCOUNT_SETTINGS}
			]},
			{className:"accounts-header-shadow"},
			{kind: "Scroller", flex: 1, components: [
				{kind: "Control", className:"box-center", components: [
					{kind: "RowGroup", className:"accounts-group", caption: AccountsUtil.GROUP_TITLE_ACCOUNT_NAME, components: [
						{kind: "Input", name: "accountName", spellcheck: false, autocorrect:false}
					]},
					{name: "useAccountWith", kind: "RowGroup", className:"accounts-group", caption: AccountsUtil.GROUP_TITLE_USE_ACCOUNT_WITH, components: [
						{name: "capabilitiesList", kind: "VirtualRepeater", onSetupRow: "listGetItem", onclick: "accountSelected", className:"accounts-rowgroup-item", components: [
							{kind: "Item", name: "capabilityRow", layoutKind: "HFlexLayout", flex: 1, className:"accounts-list-item", components: [
								{name: "capability", flex: 1},
								{name: "capabilityEnabled",	kind: "ToggleButton", onChange: "capabilityToggled"}
							]}
						]}
					]},
					{name:"advSyncReqGroup", kind: "RowGroup", caption: $L("Advanced Sync Requirements"), components:[
						{kind: "VFlexBox", flex:1,components: [
							{name: "advSyncReqList", kind: "VirtualRepeater", onSetupRow: "setupAdvReqList", components: [
								{kind: "VFlexBox", flex:1,components: [
								{kind:"Item", tapHighlight: true, layoutKind: "HFlexLayout", onclick:"openAdvSRAcctDrawer", components:[
									{name: "advSRAcctIcon", kind: enyo.Image, className:"icon-image"},
									{name:"advSRCapName"}
								]},
								{name:"advSRAcctDrawer", kind: "Drawer", style:"padding:5px;", open:false, components: [
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{flex: 1, content: $L("Enable Requirements")},
										{name:"advSRAcctEnable", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{flex: 1, content: $L("Wifi only")},
										{name:"advSRAcctWifi", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{flex: 1, content: $L("Cell data only")},
										{name:"advSRAcctCell", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{name:"advSRAcctBatt", kind: "IntegerPicker", label: $L("Min. battery %"), value:0, min: 0, max: 100, onChange: "chooseAdvSRAcctBatt"}
									]},
									{kind: "RowItem", tapHighlight: false, components:[
										{name:"advSRAcctInterval", kind: "ListSelector", label: $L("Interval"), value: "20m", onChange:"chooseAdvSRAcctInterval",
											items: [{caption:$L('5 Minutes'), value:'5m'},
													{caption:$L('10 Minutes'), value:'10m'},
													{caption:$L('15 Minutes'), value:'15m'},
													{caption:$L('20 Minutes'), value:'20m'},
													{caption:$L('30 Minutes'), value:'30m'},
													{caption:$L('1 Hour'), value:'60m'},
													{caption:$L('3 Hours'), value:'3h'},
													{caption:$L('6 Hours'), value:'6h'},
													{caption:$L('12 Hours'), value:'12h'},
													{caption:$L('1 Day'), value:'24h'},
													{caption:$L('2 Days'), value:'2d'},
													{caption:$L('4 Days'), value:'4d'},
													{caption:$L('6 Days'), value:'6d'},
													{caption:$L('8 Days'), value:'8d'},
													{caption:$L('10 Days'), value:'10d'},
													{caption:$L('14 Days'), value:'14d'}
												]
										}
									 ]},
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{flex: 1, content: $L("Charging")},
										{name:"advSRAcctCharging", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
										{flex: 1, content: $L("On touchstone")},
										{name:"advSRAcctTouchstone", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									{kind: "RowItem", tapHighlight: true, layoutKind: "HFlexLayout", onclick: "openadvSRAcctTimeDrawer", components:[
										{flex: 1, content: $L("Sync all day")},
										{name:"advSRAcctAllday", kind: "ToggleButton", state: false, onChange:"chooseAdvSRAcctOption"}
									]},
									
									{name:"advSRAcctTimeDrawer", kind: "Drawer", style:"padding:5px;", open:true, components: [
										{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
											{content: $L("Start"), width: "3em", className: "enyo-picker-label"},
											{name: "advSRAcctStartTime", kind: "TimePicker", label: " ", minuteInterval: 5, onChange: "chooseAdvSRAcctStartTime"}
										]},
										{kind: "RowItem", tapHighlight: false, layoutKind: "HFlexLayout", components:[
											{content: $L("End"), width: "3em", className: "enyo-picker-label"},
											{name: "advSRAcctStopTime", kind: "TimePicker", label: " ", minuteInterval: 5, onChange: "chooseAdvSRAcctStopTime"}
										]}
									]}
								]}
								]}
							]}
						]}
					]},
					{name:"changeLoginButton", kind: "Button", caption: AccountsUtil.BUTTON_CHANGE_LOGIN, onclick: "changeLoginTapped", className:"accounts-btn"},
					{name:"removeAccountButton", kind: "Accounts.RemoveAccount", className:"accounts-btn", onAccountsRemove_Done: "doModifyView_Success"},
					{name:"createAccountButton", kind: "ActivityButton", caption: AccountsUtil.BUTTON_CREATE_ACCOUNT, onclick: "createAccountTapped", className:"enyo-button-dark accounts-btn"}
				]}
			]},
			{className:"accounts-footer-shadow"},
			{kind:"Toolbar", className:"enyo-toolbar-light", components:[
				{name:"cancelButton", kind: "Button", className:"accounts-toolbar-btn", onclick: "backHandler"}
			]}
		]},
		{name: "createAccount", kind: "PalmService", service: enyo.palmServices.accounts, method: "createAccount", onResponse: "createResponse"},
		{name: "modifyAccount", kind: "PalmService", service: enyo.palmServices.accounts, method: "modifyAccount"}
	],
	
	// Pass in a validationResult if creating the account, or the account and template if modifying it
	displayCreateView: function(validationResult, template, capability) {
		this.validationResult = validationResult;
		this.template = template || {};
		this.capability = capability || "";
		
		// Hide buttons not needed when creating a new account
		this.$.changeLoginButton.hide();
		this.$.removeAccountButton.hide();
		// Get the "Create Account" button back to normal
		this.$.createAccountButton.setActive(false);
		this.$.createAccountButton.setCaption(AccountsUtil.BUTTON_CREATE_ACCOUNT);
		this.$.createAccountButton.setDisabled(false);

		this.$.accountName.setDisabled(false);
		this.$.changeLoginButton.setDisabled(false);
		this.$.cancelButton.setCaption(AccountsUtil.BUTTON_CANCEL);
		
		// Set the account name
		this.$.accountName.setValue(validationResult.alias || this.template.loc_name);
		
		// Update the icon on the page title
		if (this.template && this.template.icon && this.template.icon.loc_48x48){
			this.$.titleIcon.setSrc(this.template.icon.loc_48x48);
		} else{
			this.$.titleIcon.setSrc(AccountsUtil.libPath + "images/acounts-48x48.png");
		}
		// Set the focus on the account name
//		enyo.asyncMethod(this.$.accountName, "forceFocus");
		
		this.displayCapabilities(true);
		this.selectViewByName("standardModifyView");
	},
	
	// Pass in a validationResult if creating the account, or the account and template if modifying it
	displayModifyView: function(account, capability) {
		this.displayModifyData(account, capability);
		this.selectViewByName("standardModifyView");
	},
	
	// Display the view for Bad credentials
	displayBadCredentialsView: function(account) {
		// Set up the data on this view, so that control can return to it
		this.displayModifyData(account);
		
		// Go to the credentials view
		enyo.asyncMethod(this, "changeLoginTapped");
	},
	
	// Pass in a validationResult if creating the account, or the account and template if modifying it
	displayModifyData: function(account, capability) {
		this.account = account || {};
		this.template = account || {};	// The template has been merged into the account
		this.capability = capability || "";
		
		// Hide buttons not needed when modifying an account
		this.$.createAccountButton.hide();
		// Initialize the "remove account" functionality
		this.$.removeAccountButton.init(account, capability);

		this.$.cancelButton.setCaption(AccountsUtil.BUTTON_BACK);
			
		// Set the account name
		this.$.accountName.setValue(this.account.alias || this.account.loc_name);
		
		// Enable all the buttons
		this.$.accountName.setDisabled(false);
		this.$.changeLoginButton.setDisabled(false);
		
		// Update the icon on the page title
		if (this.template && this.template.icon && this.template.icon.loc_48x48){
			this.$.titleIcon.setSrc(this.template.icon.loc_48x48);
		} else {
			this.$.titleIcon.setSrc(AccountsUtil.libPath + "images/acounts-48x48.png");
		}

		this.displayCapabilities(false);
	},
	
	buildAdvReqModels: function (){
		if(this.EAS ){return;}
		var templ = this.template || {};
		var acct = this.account || {};
		this.advReqAcctListItems = [];
		var i, k, j, aSR, item, tCps, tCp, hrs, mins, sDate, eDate, allDay, allDayDisabled, openStartEnd, interval, len = templ.capabilityProviders.length;
		var timeMachine = new Date();
		var start = Date.UTC(2000, 0, 1, 7, 0, 0, 0);
		var end = Date.UTC(2000, 0, 1, 18, 0, 0, 0);
		var defaults = [false /*onoff*/, false /*wifi*/, false /*cell*/, 0 /*battery*/, "20m" /*0d0h20m0s*/, false /*charging*/, false /*docked*/, true /*all day*/, start, end];
		if(acct && acct.accountName && (acct.accountName.toLowerCase()).indexOf("facebook") !== -1){
			defaults[4] = "24h";
		}
		if(acct && acct.advSyncReq){
			aSR = acct.advSyncReq || [];
		} else {
			aSR = []
		}
		tCps = templ.capabilityProviders || [];
		if(tCps && len > 0){
			for(i=0;i < len; i++){
				//find acct cap if it exits
				tCp = tCps[i];
				if(tCp.capability === "CONTACTS" || tCp.capability === "CALENDAR"){
					for(k=0;k<aSR.length;k++){
						if(aSR[k] && aSR[k].cap === tCp.capability){
							item = aSR[k];
							this.hadSavedAdvReq = true;
							console.error("modify acct saved advSyncReq: "+ JSON.stringify(item));
							break;
						}
					}
					//console.error("modify acct templateCp: "+ JSON.stringify(tCp));
					if(!item || !item.cap){
						item = {};
						this.hadSavedAdvReq = false;
					}
					j = this.advReqAcctListItems.length;
					this.advReqAcctListItems[j] = {};
					this.advReqAcctListItems[j].id = tCp.id;
					this.advReqAcctListItems[j].onoff = item.onoff !== undefined ? item.onoff : defaults[0];
					this.advReqAcctListItems[j].wifi = item.wifi !== undefined ? item.wifi : defaults[1];
					this.advReqAcctListItems[j].cell = item.cell !== undefined ? item.cell : defaults[2];
					this.advReqAcctListItems[j].batt = item.batt !== undefined ? item.batt : defaults[3];
					this.advReqAcctListItems[j].interval = item.interval !== undefined ? item.interval : defaults[4];
					this.advReqAcctListItems[j].charging = item.charging !== undefined ? item.charging : defaults[5];
					this.advReqAcctListItems[j].docked = item.docked !== undefined ? item.docked : defaults[6];
					interval = this.advReqAcctListItems[j].interval;
					if(interval.indexOf("m") !== -1 || (interval.indexOf("h") !== -1 && parseInt(interval,10) <= 6)){
						allDay = item.allday !== undefined ? item.allday : defaults[7];
						allDayDisabled = false;
						openStartEnd = !allDay;
					} else {
						openStartEnd =false;
						allDayDisabled = true;
						allDay = true;
					}
					this.advReqAcctListItems[j].allday = allDay;
					this.advReqAcctListItems[j].allDayDisabled = allDayDisabled;
					this.advReqAcctListItems[j].openStartEnd = openStartEnd;
					timeMachine.setTime((item.starttime !== undefined ? item.starttime : defaults[8]));
					hrs = timeMachine.getUTCHours();
					mins = timeMachine.getUTCMinutes();
					sDate = new Date(2000, 0, 1, hrs, mins, 0, 0);
					timeMachine.setTime(item.endtime !== undefined ? item.endtime : defaults[9]);
					hrs = timeMachine.getUTCHours();
					mins = timeMachine.getUTCMinutes();
					eDate = new Date(2000, 0, 1, hrs, mins, 0, 0);
					this.advReqAcctListItems[j].starttime = sDate;
					this.advReqAcctListItems[j].endtime = eDate;
					this.advReqAcctListItems[j].Id = j;
					this.advReqAcctListItems[j].cap = tCp.capability;
					this.advReqAcctListItems[j].icon = (tCp && tCp.icon && tCp.icon.loc_32x32) || (templ && templ.icon && templ.icon.loc_32x32);
					this.advReqAcctListItems[j].syncWindowMonthsAfter = item.syncWindowMonthsAfter || 48;
					this.advReqAcctListItems[j].syncWindowMonthsBefore = item.syncWindowMonthsBefore || 12;
				}
			}
		}
		/* for(i=0;i<this.advReqAcctListItems.length;i++){
			console.error("this.advReqAcctListItems:" + i +" = " + JSON.stringify(this.advReqAcctListItems[i]));
		} */
		console.error("this.account keys: " + Object.keys(acct));
		//console.error("this.account.advSyncReq: " + JSON.stringify(this.account.config));
		//console.error("this.account.config: " + JSON.stringify(this.account.config));
		this.userChangedAdvReqs = false;
		this.$.advSyncReqList.render();
	},
	
	// Display the list of capabilites that the template supports
	displayCapabilities: function(newAccount) {
		// Determine which capabilities are active, and which should be disabled
		this.EAS = false;
		this.doOauth2Msg = false;
		this.hadSavedAdvReq = !newAccount;
		this.oauth2Scopes =[];
		if (this.template.capabilityProviders) {
			var i, l, c;
			for (i=0, l=this.template.capabilityProviders.length; i<l; i++) {
				c = this.template.capabilityProviders[i];
				// Get the localized name of the capability
				c.displayText = AccountsUtil.getCapabilityText(c.capability);
				if(!this.EAS && c && (c.implementation || c.id)){
					this.EAS = (c.implementation && c.implementation.indexOf("com.palm.eas") !== -1) || (c.id && c.id.indexOf("com.palm.palmprofile") !== -1);
				}
				if(c.capability === "CONTACTS" || c.capability === "CALENDAR"){
					this.oauth2Scopes.push(c.displayText);
				}
				// For new accounts, all capabilities should be enabled
				if (newAccount){
					c.enabled = true;
				} else {
					c.enabled = !!c._id;
				}
				// Can the capability be toggled?
				c.changeAllowed = false;
				if (!c.alwaysOn && c.capability != this.capability){
					c.changeAllowed = true;
				}
				// Does this capability have a config?
				if (c.config){
					this.config = c.config;
				}
			}
			// Prevent a singleton capability on accounts with only one possible capability from being turned off
			if (this.template.capabilityProviders.length === 1 && this.template.capabilityProviders[0].enabled){
				this.template.capabilityProviders[0].changeAllowed = false;
			}
		}
		// Render the list of capabilities
		this.$.capabilitiesList.render();
		this.capabilitiesDirty = false;
		if(!this.EAS && this.oauth2Scopes && this.oauth2Scopes.length >0){
			this.$.advSyncReqGroup.setShowing(true);
			this.buildAdvReqModels();
		} else {
			this.userChangedAdvReqs = false;
			this.$.advSyncReqGroup.setShowing(false);
		}
	},
	
	setupAdvReqList: function setupAdvReqList(inSender, inIndex){
		if(!this.advReqAcctListItems || !this.template){console.error("AdvReq prefs view not setup"); return false;}
		//console.error("setupAdvReqList " + inSender + ", inIndex " + inIndex);
		var item, ui = this.$, len = this.advReqAcctListItems.length;
		var idx = inIndex;
		var is24Hr = !(new enyo.g11n.Fmts()).isAmPm();
		//console.error("len " + len + ", idx: " + idx);
		if(len > 0 && idx < len){
			item = this.advReqAcctListItems[idx];
			if(item){
				ui.advSRAcctIcon.setSrc(item.icon);
				ui.advSRCapName.setContent(AccountsUtil.getCapabilityText(item.cap));
				ui.advSRAcctEnable.setState(item.onoff);
				ui.advSRAcctWifi.setState(item.wifi);
				ui.advSRAcctCell.setState(item.cell);
				ui.advSRAcctBatt.setValue(item.batt);
				ui.advSRAcctInterval.setValue(item.interval);
				ui.advSRAcctCharging.setState(item.charing);
				ui.advSRAcctTouchstone.setState(item.docked);
				ui.advSRAcctAllday.setState(item.allday);
				ui.advSRAcctAllday.setDisabled(item.allDayDisabled);
				ui.advSRAcctStartTime.setValue(item.starttime);
				ui.advSRAcctStartTime.setIs24HrMode (is24Hr);
				ui.advSRAcctStopTime.setValue(item.endtime);
				ui.advSRAcctStopTime.setIs24HrMode (is24Hr);
				ui.advSRAcctTimeDrawer.setOpen(item.openStartEnd);
			}
			return true;
		}
	},

	listGetItem: function(inSender, inIndex) {
		if (!this.template || !this.template.capabilityProviders || inIndex >= this.template.capabilityProviders.length){
			return false;
		}
		var c = this.template.capabilityProviders[inIndex];
		// Temporary fix: Don't show Tasks until there is a tasks app (making use of the fact that Tasks will be last in the list)
		if (c.capability === "TASKS"){
			return false;
		}
		this.$.capability.setContent(c.displayText);
		this.$.capabilityEnabled.state = c.enabled;
		this.$.capabilityEnabled.disabled = !c.changeAllowed;
		this.$.capabilityEnabled.ready();
		//console.log("listGetItem: cap=" + c.capability + " disp=" + c.displayText + " changeAllowed = " + c.changeAllowed)
		return true;
	},
	
	openAdvSRAcctDrawer: function openAdvSRAcctDrawer(inSender, inEvent){
		this.$.advSRAcctDrawer.toggleOpen();
	},
	
	openadvSRAcctTimeDrawer: function openadvSRAcctTimeDrawer(inSender, inEvent){
		this.$.advSRAcctTimeDrawer.toggleOpen();
	},
	
	chooseAdvSRAcctOption: function chooseAdvSRAcctOption(inSender, inState){
		console.error("toggle sender " + inSender.name);
		var map = {advSRAcctEnable: "onoff", advSRAcctWifi: "wifi",
			advSRAcctCell: "cell", advSRAcctCharging: "charging", advSRAcctTouchstone: "docked",
			advSRAcctAllday: "allday"};
		var prop = map[inSender.name];
		var idx = this.$.advSyncReqList.fetchRowIndex();
		this.advReqAcctListItems[idx][prop] = inState;
		this.userChangedAdvReqs = true;
		console.error("advReqAcctListItems index " +idx+ ", prop " + prop + ", value: "+inState);
	},
	
	chooseAdvSRAcctInterval: function chooseAdvSRAcctInterval(inSender, inValue, oldValue){
		var idx = this.$.advSyncReqList.fetchRowIndex();
		var val = inValue;
		this.advReqAcctListItems[idx].interval = val;
		this.userChangedAdvReqs = true;
		console.error("advReqAcctListItems index:" +idx+ ", interval: " + val);
	},
	
	chooseAdvSRAcctBatt: function chooseAdvSRAcctBatt(inSender){
		var idx = this.$.advSyncReqList.fetchRowIndex();
		var val = this.$.advSRAcctBatt.getValue();
		this.advReqAcctListItems[idx].batt = val;
		this.userChangedAdvReqs = true;
		console.error("advReqAcctListItems index:" +idx+ ", battery: " + val);
	},
	
	chooseAdvSRAcctStartTime: function chooseAdvSRAcctStartTime(inSender){
		var idx = this.$.advSyncReqList.fetchRowIndex();
		var val = this.$.advSRAcctStartTime.getValue();
		this.advReqAcctListItems[idx].starttime =  new Date(val.getTime());
		this.userChangedAdvReqs = true;
		console.error("advReqAcctListItems index:" +idx+ ", starttime: " + val);
	},
	
	chooseAdvSRAcctStopTime: function chooseAdvSRAcctStopTime(inSender){
		var idx = this.$.advSyncReqList.fetchRowIndex();
		var val = this.$.advSRAcctStopTime.getValue();
		this.advReqAcctListItems[idx].endtime = new Date(val.getTime());
		this.userChangedAdvReqs = true;
		console.error("advReqAcctListItems index:" +idx+ ", endtime: " + val);
	},
	
	capabilityToggled: function(inSender) {
		// Make a note of the new value
		var c = this.template.capabilityProviders[this.$.capabilitiesList.fetchRowIndex()];
		c.enabled = c._id = inSender.getState();
		this.capabilitiesDirty = true;
	},
	
	// The "Change Login" button was tapped
	changeLoginTapped: function() {
		// Save the account details if they changed
		this.saveAccountDetails();
		
		this.doModifyView_ChangeLogin({
			account: this.account
		});
	},
	
	// The "Create Account" button was tapped
	createAccountTapped: function() {
		// Disable the "Create Account" button
		this.$.createAccountButton.setDisabled(true);
		// Change the text to "Creating Account..."
		this.$.createAccountButton.setCaption(AccountsUtil.BUTTON_CREATING_ACCOUNT);
		// Start the spinner on the button
		this.$.createAccountButton.setActive(true);
		// Disable the account name field
		this.$.accountName.setDisabled(true);
		
		// See which capabilities are enabled
		var i, l, enabledCapabilities = [];
		for (i = 0, l = this.template.capabilityProviders.length; i < l; i++) {
			if (this.template.capabilityProviders[i].enabled){
				enabledCapabilities.push({"id":this.template.capabilityProviders[i].id});
			}
		}
		console.log("enabledCapabilities:" + enyo.json.stringify(enabledCapabilities));
		
		var cfArr =[];
		if(!this.EAS && this.advReqAcctListItems){
			var j, obj, hrs, mins, item, len = this.advReqAcctListItems.length;
			for(j=0;j<len;j++){
				item = this.advReqAcctListItems[j];
				if(item && item.interval){
					obj = {};
					obj.cap = item.cap;
					obj.onoff = item.onoff;
					obj.wifi = item.wifi;
					obj.cell = item.cell;
					obj.batt = item.batt;
					obj.interval = item.interval;
					obj.charging = item.charging;
					obj.docked = item.docked;
					obj.allday = item.allday;
					hrs = item.starttime.getHours();
					mins = item.starttime.getMinutes();
					obj.starttime = Date.UTC(2001, 0, 1, hrs, mins, 0, 0);
					hrs = item.endtime.getHours();
					mins = item.endtime.getMinutes();
					obj.endtime = Date.UTC(2001, 0, 1, hrs, mins, 0, 0);
					obj.syncWindowMonthsAfter = item.syncWindowMonthsAfter;
					obj.syncWindowMonthsBefore = item.syncWindowMonthsBefore;
					console.error("saving advsyncReqs: "+JSON.stringify(obj));
					cfArr.push(obj);
				}
			}
		}
		// Create the account
		var acct = {
			templateId: this.validationResult.templateId,
			username: this.validationResult.username,
			alias:  this.$.accountName.getValue(),
			credentials: this.validationResult.credentials,
			config: this.validationResult.config || this.config,
			capabilityProviders: enabledCapabilities
		};
		if(!this.EAS && this.userChangedAdvReqs && cfArr.length > 0){
			acct.advSyncReq = cfArr;
		}
		this.$.createAccount.call(acct);
	},
	
	createResponse: function(inSender, inResponse) {
		// Stop the spinner on the "Create Account" button
		this.$.createAccountButton.setActive(false);
		// Hopefully the response was successful and the account was created.  Even if it wasn't, nothing more can be done here
		this.doModifyView_Success();
	},
	
	// Save the account details if they changed
	saveAccountDetails: function() {
		var name = this.$.accountName.getValue();
		var nameDirty = name && this.account && name !== this.account.alias;
		var cfArr =[];
		if(!this.EAS && this.advReqAcctListItems){
			var j, obj, hrs, mins, item, len = this.advReqAcctListItems.length;
			for(j=0;j<len;j++){
				item = this.advReqAcctListItems[j];
				if(item && item.interval){
					obj = {};
					obj.cap = item.cap;
					obj.onoff = item.onoff;
					obj.wifi = item.wifi;
					obj.cell = item.cell;
					obj.batt = item.batt;
					obj.interval = item.interval;
					obj.charging = item.charging;
					obj.docked = item.docked;
					obj.allday = item.allday;
					hrs = item.starttime.getHours();
					mins = item.starttime.getMinutes();
					obj.starttime = Date.UTC(2001, 0, 1, hrs, mins, 0, 0);
					hrs = item.endtime.getHours();
					mins = item.endtime.getMinutes();
					obj.endtime = Date.UTC(2001, 0, 1, hrs, mins, 0, 0);
					obj.syncWindowMonthsAfter = item.syncWindowMonthsAfter;
					obj.syncWindowMonthsBefore = item.syncWindowMonthsBefore;
					console.error("saving advsyncReqs: "+JSON.stringify(obj));
					cfArr.push(obj);
				}
			}
		}
		// If the capabilities or account name was changed then save them
		if (this.account && (this.capabilitiesDirty || nameDirty || this.userChangedAdvReqs)) {
			var param = {
				"accountId": this.account._id,
				"object": {}
			};
			if (this.capabilitiesDirty) {
				// See which capabilities are enabled
				var i, l, enabledCapabilities = [];
				for (i = 0, l = this.template.capabilityProviders.length; i < l; i++) {
					if (this.template.capabilityProviders[i].enabled) {
						enabledCapabilities.push({"id":this.template.capabilityProviders[i].id});
					}
				}
				console.log("enabledCapabilities:" + enyo.json.stringify(enabledCapabilities));
				param.object.capabilityProviders = enabledCapabilities;
			}
			
			if (nameDirty) {
				param.object.alias = this.account.alias = name;
			}
			
			if(this.userChangedAdvReqs && cfArr.length > 0){
				param.object.advSyncReq = cfArr;
			}

			// Modify the account
			this.$.modifyAccount.call(param);
		}
	},

	// Back was tapped
	backHandler: function() {
		// Save the account details if they changed
		this.saveAccountDetails();

		this.doModifyView_Cancel();
	}
});
