// Globals for the contactsui library.
//
// $contactsui_path and runningInBrowser used to be assigned at the top of depends.js.
// The enyo builder does not preserve code placed in depends.js (see
// support/enyo-compress/README.md), so once this library is bundled the assignment
// was dropped and build.js threw "ReferenceError: $contactsui_path is not defined"
// at load -- which aborted the rest of the bundle, leaving every contactsui kind
// undefined. They live here instead, first in the dependency list, so they survive
// bundling. depends.js still computes runningInBrowser for its own branch selection
// at build time; that copy is build-time only.

var $contactsui_path = "$enyo-lib/contactsui";

var runningInBrowser = (typeof window === "undefined") ? false :
	(window.runningInBrowser ? window.runningInBrowser : (window.PalmSystem ? false : true));
