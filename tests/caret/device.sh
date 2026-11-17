#!/bin/bash
# device.sh <target> [caret.js options...]: run the caret suite on a LuneOS
# device. <target> is an adb serial, or ssh:[user@]host[:port] (e.g.
# ssh:root@localhost:5522 for the VirtualBox image; extra ssh options, such as
# -o UserKnownHostsFile=..., go in $SSH_OPTS). Installs the test app (app/) as
# org.webosports.test.caret, launches it, forwards WebAppMgr's DevTools port
# and runs caret.js against it.
#
# The screen has to be on and unlocked, and nobody touching it: on a device
# with a touchscreen the touches are real ones, written to it by inject.py.
# Without one (an emulator), or with DEVTOOLS_TOUCH=1, DevTools touches are
# sent instead; LuneOS's runtime makes no long press of those, and no tap that
# ends a composition, so those checks are left out.
#
# With --app, the test app is not installed: the suite runs against whatever
# app is in front (open the field to test first, e.g. Accounts' email sign-in
# or a task in Tasks), reading the caret without changing any text.
set -e
T=$(cd "$(dirname "$0")" && pwd)
TARGET=${1:?usage: device.sh <adb serial | ssh:[user@]host[:port]> [caret.js options...]}; shift
ID=org.webosports.test.caret
PORT=${PORT:-19998}
TUNNEL=

case $TARGET in
ssh:*)
	H=${TARGET#ssh:}; SPORT=22
	case $H in *:*) SPORT=${H##*:}; H=${H%:*} ;; esac
	SSH="ssh -o BatchMode=yes -p $SPORT $SSH_OPTS $H"
	# With a terminal, as adb shell has: luna-send prints nothing without one.
	dev_shell() { $SSH -tt "$1" </dev/null 2>/dev/null | tr -d '\r'; return "${PIPESTATUS[0]}"; }
	dev_push() { scp -q -o BatchMode=yes -P "$SPORT" $SSH_OPTS "$1" "$H:$2"; }
	dev_forward() {
		$SSH -N -o ExitOnForwardFailure=yes -L "$PORT:127.0.0.1:9998" &
		TUNNEL=$!
		trap 'kill $TUNNEL 2>/dev/null' EXIT
		sleep 2
	}
	;;
*)
	ADB="adb -s $TARGET"
	dev_shell() { $ADB shell "$1"; }
	dev_push() { $ADB push "$1" "$2" >/dev/null; }
	dev_forward() { $ADB forward tcp:$PORT tcp:9998 >/dev/null; }
	;;
esac

case " $* " in
*" --app "*) ;;
*)
	dev_shell "rm -rf /usr/palm/applications/$ID && mkdir -p /usr/palm/applications/$ID"
	for f in "$T"/app/*; do dev_push "$f" "/usr/palm/applications/$ID/"; done
	# SAM, which launches it, and the shell's LunaAppManager, which lists it.
	dev_shell "luna-send -n 1 -a com.webos.surfacemanager luna://com.webos.applicationManager/scanApp '{\"appIds\":[\"$ID\"]}'" \
		| grep -q '"installed":true' || { echo "SAM did not take the test app (see journalctl -u sam)" >&2; exit 2; }
	dev_shell "luna-send -n 1 -a com.webos.surfacemanager luna://com.palm.applicationManager/rescan '{}'" >/dev/null
	# Closed first: a launch of a running app only brings it to the front.
	dev_shell "luna-send -n 1 luna://com.webos.applicationManager/closeByAppId '{\"id\":\"$ID\"}'" >/dev/null || true
	sleep 2
	dev_shell "luna-send -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"$ID\"}'" >/dev/null
	sleep 4
	set -- --page "$ID" "$@"
	;;
esac
dev_forward
if [ -z "$DEVTOOLS_TOUCH" ]; then
	dev_push "$T/inject.py" /home/root/caret-inject.py
	if dev_shell "python3 /home/root/caret-inject.py info" >/dev/null 2>&1; then
		set -- --inject "$TARGET" "$@"
	else
		echo "no touchscreen: DevTools touches, without the long press and composition checks"
		DEVTOOLS_TOUCH=1
	fi
fi
[ -n "$DEVTOOLS_TOUCH" ] && set -- --no-long-press --no-ime-tap "$@"
OUT=${OUT:-$T/out/results-device-${TARGET//[:@\/]/_}} node "$T/caret.js" "http://127.0.0.1:$PORT" "$@"
