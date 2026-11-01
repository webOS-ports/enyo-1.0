/*
 * Copyright (c) 2026 Herman van Hazendonk <github.com@herrie.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * node framework/lib/authlib/tests/run-tests.js
 *
 * The passcode dialogs' logic, without a browser: enyo.kind() is stubbed to
 * keep each kind's definition, and every component under this.$ is a fake
 * that records what it was asked to do. What is checked is what
 * luna-authmanager sees: setDevicePasscode carries currentPasscode once the
 * current passcode was verified, and it is not kept around afterwards.
 */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var kinds = {};
var sandbox = {
	console: console,
	enyo: {
		kind: function(def) { kinds[def.name] = def; },
		ModalDialog: "ModalDialog",
		VFlexBox: "VFlexBox",
		transitions: {Simple: "Simple"},
		g11n: {Template: function(t) { this.formatChoice = function() { return t; }; this.evaluate = function() { return t; }; }}
	},
	rb_auth: {$L: function(s) { return s; }}
};
vm.createContext(sandbox);
var dir = path.join(__dirname, "..", "source");
["PinUnlock.js", "PasswordUnlock.js", "SetPasswordDialog.js", "SecurityPolicyGuard.js"].forEach(function(f) {
	vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, {filename: f});
});

// A fake component: every method called on it is recorded in .calls
function fake() {
	var calls = [];
	return new Proxy({calls: calls}, {
		get: function(target, name) {
			if (name in target)
				return target[name];
			return function() {
				calls.push({name: name, args: Array.prototype.slice.call(arguments)});
				return name === "getValue" ? (target.value || "") : (name === "hasFocus" ? false : undefined);
			};
		}
	});
}

// An instance of kind: its definition's methods and published defaults,
// fakes for each named component, and do<Event> recorders.
function make(kindName, extraComponents) {
	var def = kinds[kindName];
	// The base kinds' own methods (enyo.ModalDialog's close and friends)
	var self = {$: {}, events: [], closed: 0, inherited: function() {}, log: function() {},
		close: function() { self.closed++; }, openAtCenter: function() {}};
	Object.keys(def).forEach(function(k) {
		if (typeof def[k] === "function")
			self[k] = def[k];
	});
	var pub = def.published || {};
	Object.keys(pub).forEach(function(k) {
		self[k] = pub[k];
		var setter = "set" + k.charAt(0).toUpperCase() + k.slice(1);
		self[setter] = function(v) { self[k] = v; };
	});
	Object.keys(def).forEach(function(k) {
		if (typeof def[k] === "string" && k !== "name" && k !== "kind" && k !== "caption")
			self[k] = def[k];
	});
	(function walk(list) {
		(list || []).forEach(function(c) {
			if (c.name)
				self.$[c.name] = fake();
			walk(c.components);
		});
	})(def.components);
	(extraComponents || []).forEach(function(n) { self.$[n] = fake(); });
	Object.keys(def.events || {}).forEach(function(e) {
		self["do" + e.slice(2)] = function() {
			self.events.push({name: e, args: Array.prototype.slice.call(arguments)});
		};
	});
	return self;
}

function lastCall(component, name) {
	var found = component.calls.filter(function(c) { return c.name === name; });
	return found.length ? found[found.length - 1] : null;
}

function fired(self, name) {
	return self.events.filter(function(e) { return e.name === name; });
}

var failures = 0, passed = 0;
function test(name, fn) {
	try {
		fn();
		passed++;
		console.log("PASS " + name);
	} catch (e) {
		failures++;
		console.log("FAIL " + name + ": " + (e && e.message));
	}
}
function eq(a, b, what) {
	if (JSON.stringify(a) !== JSON.stringify(b))
		throw new Error((what || "value") + ": expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
}
function ok(v, what) {
	if (!v)
		throw new Error(what || "expected true");
}

// SetPasswordDialog

test("SetPasswordDialog sends the current passcode it was given", function() {
	var d = make("SetPasswordDialog");
	d.$.password.value = "n3wpass"; d.$.passwordconfirm.value = "n3wpass";
	d.setCurrentPasscode("0ldpass");
	d.acceptClick();
	eq(lastCall(d.$.setPassword, "call").args[0],
	   {passCode: "n3wpass", lockMode: "password", currentPasscode: "0ldpass"}, "setDevicePasscode");
});

test("SetPasswordDialog sends none when there is none", function() {
	var d = make("SetPasswordDialog");
	d.$.password.value = "n3wpass"; d.$.passwordconfirm.value = "n3wpass";
	d.acceptClick();
	eq(lastCall(d.$.setPassword, "call").args[0], {passCode: "n3wpass", lockMode: "password"}, "setDevicePasscode");
});

test("SetPasswordDialog drops the current passcode once it is used", function() {
	var d = make("SetPasswordDialog");
	d.setCurrentPasscode("0ldpass");
	d.setPasswordSuccess();
	eq(d.currentPasscode, "", "after success");
	d.setCurrentPasscode("0ldpass");
	d.cancelClick();
	eq(d.currentPasscode, "", "after cancel");
});

test("SetPasswordDialog gives up when the current passcode is refused", function() {
	var d = make("SetPasswordDialog");
	d.setCurrentPasscode("0ldpass");
	d.setPasswordFailure(null, {returnValue: false, errorCode: -12});
	eq(d.currentPasscode, "", "current passcode");
	eq(fired(d, "onCancel").length, 1, "onCancel");
	eq(d.closed, 1, "closed");
});

test("SetPasswordDialog keeps the dialog for a weak new passcode", function() {
	var d = make("SetPasswordDialog");
	d.setCurrentPasscode("0ldpass");
	d.setPasswordFailure(null, {returnValue: false, errorCode: -3});
	eq(d.currentPasscode, "0ldpass", "current passcode");
	eq(fired(d, "onCancel").length, 0, "onCancel");
});

// PinUnlock

test("PinUnlock sends the current passcode with the new PIN", function() {
	var p = make("PinUnlock");
	p.pinSet = true; p.pin = "1234"; p.verifyPin = "1234";
	p.setCurrentPasscode("9876");
	p.setPin();
	eq(lastCall(p.$.sysmanagerService, "call").args[0],
	   {passCode: "1234", lockMode: "pin", currentPasscode: "9876"}, "setDevicePasscode");
});

test("PinUnlock sends none when there is none", function() {
	var p = make("PinUnlock");
	p.pinSet = true; p.pin = "1234"; p.verifyPin = "1234";
	p.setPin();
	eq(lastCall(p.$.sysmanagerService, "call").args[0], {passCode: "1234", lockMode: "pin"}, "setDevicePasscode");
});

test("PinUnlock reports which PIN was verified", function() {
	var p = make("PinUnlock");
	p.pinSet = false; p.pin = "9876";
	p.unlock();
	eq(lastCall(p.$.matchDevicePasscode, "call").args[0], {passCode: "9876"}, "matchDevicePasscode");
	eq(p.pin, "", "entry cleared while asking");
	p.devicePinVerifyResponse(null, {returnValue: true});
	eq(fired(p, "onPinVerified")[0].args, ["9876"], "onPinVerified");
	eq(p.pinBeingVerified, "", "not kept");
});

test("PinUnlock reports nothing for a wrong PIN", function() {
	var p = make("PinUnlock");
	p.pin = "1111";
	p.unlock();
	p.devicePinVerifyResponse(null, {returnValue: false, retriesLeft: 3});
	eq(fired(p, "onPinVerified").length, 0, "onPinVerified");
	eq(p.pinBeingVerified, "", "not kept");
});

test("PinUnlock drops the current passcode once it is used", function() {
	var p = make("PinUnlock");
	p.setCurrentPasscode("9876");
	p.onSetPin();
	eq(p.currentPasscode, "", "after success");
	p.setCurrentPasscode("9876");
	p.onCancel();
	eq(p.currentPasscode, "", "after cancel");
	p.setCurrentPasscode("9876");
	p.onSetPinFailure(null, {returnValue: false, errorCode: -12});
	eq(p.currentPasscode, "", "after -12");
	eq(fired(p, "onCancelClick").length, 2, "-12 cancels like Cancel does");
});

// PasswordUnlock

test("PasswordUnlock reports which password was verified", function() {
	var u = make("PasswordUnlock");
	u.$.passwordInput.value = "0ldpass";
	u.unlock();
	u.devicePasswordVerifyResponse(null, {returnValue: true});
	eq(fired(u, "onPasswordVerified")[0].args, ["0ldpass"], "onPasswordVerified");
	eq(u.passwordBeingVerified, "", "not kept");
});

// SecurityPolicyGuard

function guard() {
	var g = make("SecurityPolicyGuard");
	// The real child kinds, so the passcode travels through them
	g.$.pinUnlock = make("PinUnlock");
	g.$.setPasswordDialog = make("SetPasswordDialog");
	g.$.passwordUnlock = make("PasswordUnlock");
	["pinUnlock", "setPasswordDialog", "passwordUnlock"].forEach(function(n) {
		g.$[n].close = function() {}; g.$[n].openAtCenter = function() {};
		g.$[n].reset = g.$[n].reset || function() {};
	});
	g.$.pinUnlock.updatePinDisplay = function() {};
	g.$.pinUnlock.pinSetChanged = function() {};
	g.$.pinUnlock.setPinSet = function(v) { this.pinSet = v; };
	g.policy = {password: {alphaNumeric: false, minLength: 4}};
	return g;
}

test("SecurityPolicyGuard asks for the current PIN first", function() {
	var g = guard();
	g.policyChanged();
	ok(lastCall(g.$.getLockMode, "call"), "asks for the lock mode");
	g.gotLockMode(null, {returnValue: true, lockMode: "pin"});
	eq(g.$.pinUnlock.pinSet, false, "PinUnlock verifies, not sets");
	ok(!lastCall(g.$.securityUpgradePrompt, "openAtCenter"), "no upgrade prompt yet");
});

test("SecurityPolicyGuard hands the verified PIN to the new PIN", function() {
	var g = guard();
	g.policyChanged();
	g.gotLockMode(null, {returnValue: true, lockMode: "pin"});
	g.currentVerified(g.$.pinUnlock, "9876");
	ok(lastCall(g.$.securityUpgradePrompt, "openAtCenter"), "upgrade prompt");
	g.choosePin();
	eq(g.$.pinUnlock.currentPasscode, "9876", "PinUnlock has it");
	eq(g.currentPasscode, "", "the guard does not keep it");
	g.$.pinUnlock.pin = "1234"; g.$.pinUnlock.verifyPin = "1234";
	g.$.pinUnlock.setPin();
	eq(lastCall(g.$.pinUnlock.$.sysmanagerService, "call").args[0].currentPasscode, "9876", "sent");
});

test("SecurityPolicyGuard asks for the current password first", function() {
	var g = guard();
	var opened = 0;
	g.$.passwordUnlock.openAtCenter = function() { opened++; };
	g.policyChanged();
	g.gotLockMode(null, {returnValue: true, lockMode: "password"});
	eq(opened, 1, "PasswordUnlock opened");
	ok(!lastCall(g.$.securityUpgradePrompt, "openAtCenter"), "no upgrade prompt yet");
});

test("SecurityPolicyGuard hands the verified password to the new password", function() {
	var g = guard();
	g.policyChanged();
	g.gotLockMode(null, {returnValue: true, lockMode: "password"});
	g.currentVerified(g.$.passwordUnlock, "0ldpass");
	g.choosePassword();
	eq(g.$.setPasswordDialog.currentPasscode, "0ldpass", "SetPasswordDialog has it");
	eq(g.currentPasscode, "", "the guard does not keep it");
});

test("SecurityPolicyGuard with no lock goes straight to the prompt", function() {
	var g = guard();
	g.policyChanged();
	g.gotLockMode(null, {returnValue: true, lockMode: "none"});
	ok(lastCall(g.$.securityUpgradePrompt, "openAtCenter"), "upgrade prompt");
	g.choosePin();
	eq(g.$.pinUnlock.currentPasscode, "", "nothing to send");
});

test("SecurityPolicyGuard with no answer about the lock goes straight to the prompt", function() {
	var g = guard();
	g.policyChanged();
	g.gotLockMode(null, {returnValue: false});
	ok(lastCall(g.$.securityUpgradePrompt, "openAtCenter"), "upgrade prompt");
});

test("SecurityPolicyGuard drops the current passcode on cancel", function() {
	var g = guard();
	g.currentPasscode = "9876";
	g.cancelLogin();
	eq(g.currentPasscode, "", "cancelLogin");
	g.currentPasscode = "9876";
	g.cancelUpgrade();
	eq(g.currentPasscode, "", "cancelUpgrade");
	g.currentPasscode = "9876";
	g.cancelVerify();
	eq(g.currentPasscode, "", "cancelVerify");
	eq(fired(g, "onCancel").length, 2, "cancel reported");
});

test("SecurityPolicyGuard starts each policy with no passcode in hand", function() {
	var g = guard();
	g.currentPasscode = "9876";
	g.policyChanged();
	eq(g.currentPasscode, "", "cleared");
});

console.log(passed + " passed, " + failures + " failed");
process.exit(failures ? 1 : 0);
