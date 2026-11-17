#!/bin/bash
# device.sh <adb serial> [caret.js options...]: run the caret suite on a
# LuneOS device. Installs the test app (app/) as org.webosports.test.caret,
# launches it, forwards WebAppMgr's DevTools port and runs caret.js against
# it. The screen has to be on and unlocked, and nobody touching it: the
# touches are real ones, written to the touchscreen by inject.py. Set
# DEVTOOLS_TOUCH=1 to send DevTools touches instead (no long press, and no
# tap that ends a composition, on LuneOS's runtime).
#
# With --app, the test app is not installed: the suite runs against whatever
# app is in front (open the field to test first, e.g. Accounts' email sign-in
# or a task in Tasks), reading the caret without changing any text.
set -e
T=$(cd "$(dirname "$0")" && pwd)
SERIAL=${1:?usage: device.sh <adb serial> [caret.js options...]}; shift
ID=org.webosports.test.caret
PORT=${PORT:-19998}
ADB="adb -s $SERIAL"

case " $* " in
*" --app "*) ;;
*)
	$ADB shell "rm -rf /usr/palm/applications/$ID && mkdir -p /usr/palm/applications/$ID"
	for f in "$T"/app/*; do $ADB push "$f" "/usr/palm/applications/$ID/" >/dev/null; done
	# SAM, which launches it, and the shell's LunaAppManager, which lists it.
	$ADB shell "luna-send -n 1 -a com.webos.surfacemanager luna://com.webos.applicationManager/scanApp '{\"appIds\":[\"$ID\"]}'" \
		| grep -q '"installed":true' || { echo "SAM did not take the test app (see journalctl -u sam)" >&2; exit 2; }
	$ADB shell "luna-send -n 1 -a com.webos.surfacemanager luna://com.palm.applicationManager/rescan '{}'" >/dev/null
	# Closed first: a launch of a running app only brings it to the front.
	$ADB shell "luna-send -n 1 luna://com.webos.applicationManager/closeByAppId '{\"id\":\"$ID\"}'" >/dev/null || true
	sleep 2
	$ADB shell "luna-send -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"$ID\"}'" >/dev/null
	sleep 4
	set -- --page "$ID" "$@"
	;;
esac
$ADB forward tcp:$PORT tcp:9998 >/dev/null
# Real touches on the touchscreen (inject.py) unless DEVTOOLS_TOUCH=1: the
# runtime makes no tap or long press of DevTools touches.
[ -z "$DEVTOOLS_TOUCH" ] && set -- --inject "adb:$SERIAL" "$@"
OUT=${OUT:-$T/out/results-device-$SERIAL} node "$T/caret.js" "http://127.0.0.1:$PORT" "$@"
