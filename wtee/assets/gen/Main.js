var Utils;
(function (Utils) {
    function formatBytes(size) {
        var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = 0;
        while (size >= 1024) {
            size /= 1024;
            ++i;
        }
        return size.toFixed(1) + ' ' + units[i];
    }
    Utils.formatBytes = formatBytes;
    function formatFilename(state) {
        if (!state.id)
            return state.text;
        var size = formatBytes($(state.element).data('size'));
        return '<span>' + state.text + '</span>' + '<span style="float:right;">' + size + '</span>';
    }
    Utils.formatFilename = formatFilename;
    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }
    Utils.endsWith = endsWith;
    function startsWith(str, prefix) {
        return str.indexOf(prefix) === 0;
    }
    Utils.startsWith = startsWith;
    var escape_entity_map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "/": '&#x2F;'
    };
    // This is the escapeHtml function from mustache.js.
    function escapeHtml(str) {
        return String(str).replace(/[&<>\/]/g, function (s) {
            return escape_entity_map[s];
        });
    }
    Utils.escapeHtml = escapeHtml;
    function createSpan(inner_html, class_names) {
        var span = document.createElement('span');
        span.innerHTML = inner_html;
        span.className = class_names;
        return span;
    }
    Utils.createSpan = createSpan;
    var Signal = /** @class */ (function () {
        function Signal() {
            this.listeners = [];
        }
        Signal.prototype.addCallback = function (callback) {
            this.listeners.push(callback);
        };
        Signal.prototype.removeObserver = function (observer) {
            this.listeners.splice(this.listeners.indexOf(observer), 1);
        };
        Signal.prototype.trigger = function (data) {
            this.listeners.forEach(function (callback) {
                callback(data);
            });
        };
        return Signal;
    }());
    Utils.Signal = Signal;
})(Utils || (Utils = {}));
var Parser = /** @class */ (function () {
    function Parser() {
        this.escapeCodeSplitRegExp = /(\x1b\[[0-9;]*[a-zA-Z])/g;
        this.escapeCodeCaptureRegExp = /\x1b\[([0-9;]*)([a-zA-Z])/;
        this.foreground = 0;
        this.background = 0;
        this.colorAttribute = 0;
        this.textAttributes = [];
    }
    Parser.prototype.resetAllAttributes = function () {
        this.foreground = 0;
        this.background = 0;
        this.colorAttribute = 0;
        this.textAttributes.length = 0;
    };
    Parser.prototype.setAttribute = function (arg) {
        if (arg === 0) { // 0 - all attributes off
            this.resetAllAttributes();
        }
        else if (arg <= 2) { // 1, 2 - bright/faint text
            this.colorAttribute = arg;
        }
        else if (arg <= 9) { // 3-9 - text style: italic, underline, blinking, reverse, hide and cross-out
            if (this.textAttributes.indexOf(arg) === -1) {
                this.textAttributes.push(arg);
            }
        }
        else if (arg >= 30 && arg <= 37) { // 30-37 - foreground colors
            this.foreground = arg;
        }
        else if (arg >= 40 && arg <= 47) { // 40-47 - background colors
            this.background = arg;
        }
    };
    Parser.prototype.parseLine = function (line) {
        line = line.replace(/\n$/, '');
        var chunks = line.split(this.escapeCodeSplitRegExp);
        var parsedSpans = [];
        for (var _i = 0, chunks_1 = chunks; _i < chunks_1.length; _i++) {
            var substring = chunks_1[_i];
            if (!substring.length) {
                continue;
            }
            var matches = substring.match(this.escapeCodeCaptureRegExp);
            console.log(matches);
            if (matches) {
                var args = matches[1];
                var command = matches[2];
                if (command == 'm') {
                    var attrs = args.split(';');
                    for (var _a = 0, attrs_1 = attrs; _a < attrs_1.length; _a++) {
                        var a = attrs_1[_a];
                        this.setAttribute(parseInt(a) || 0);
                    }
                }
                parsedSpans.push(Utils.createSpan(Utils.escapeHtml(substring), 'esc'));
            }
            else {
                var escCodes = this.textAttributes.slice(); // copy array
                if (this.foreground) {
                    escCodes.push(this.foreground);
                }
                if (this.background) {
                    escCodes.push(this.background);
                }
                if (this.colorAttribute) {
                    escCodes.push(this.colorAttribute);
                }
                var classes = escCodes.map(function (code) {
                    return 'esc-' + code;
                }).join(' ');
                parsedSpans.push(Utils.createSpan(Utils.escapeHtml(substring), classes));
            }
        }
        return parsedSpans;
    };
    return Parser;
}());
/// <reference path="Utils.ts" />
var Settings;
(function (Settings_1) {
    var Settings = /** @class */ (function () {
        function Settings(settings) {
            this.settings = settings;
            this.signals = {};
            var keys = Object.keys(this.settings);
            for (var i = 0; i < keys.length; i++) {
                this.signals[keys[i]] = new Utils.Signal();
            }
        }
        Settings.prototype.onChange = function (name, callback) {
            this.signals[name].addCallback(callback);
        };
        Settings.prototype.set = function (key, value) {
            console.log('settings key "' + key + '" set to "' + value + '"');
            this.settings[key] = value;
            this.signals[key].trigger(value);
        };
        Settings.prototype.get = function (key) {
            return this.settings[key];
        };
        return Settings;
    }());
    Settings_1.Settings = Settings;
})(Settings || (Settings = {}));
var WteeServer = /** @class */ (function () {
    function WteeServer(apiURL, connectionRetries) {
        var _this = this;
        this.apiURL = apiURL;
        this.connectionRetries = connectionRetries;
        this.connectionMade = function () {
            console.log('connected to backend');
            _this.connected = true;
            _this.socket.onmessage = _this.dataReceived;
            _this.onConnect.trigger();
        };
        this.connectionLost = function () {
            _this.onDisconnect.trigger();
            if (_this.connected) {
                _this.connected = false;
                return;
            }
            _this.connected = false;
            if (_this.connectionRetries === 0) {
                return;
            }
            window.setTimeout(function () {
                this.connectionRetries -= 1;
                this.connect();
            }, 1000);
        };
        this.dataReceived = function (message) {
            var data = JSON.parse(message.data);
            _this.onMessage.trigger(data);
        };
        this.sendMessage = function (message, retry) {
            var connected = _this.connected;
            var socket = _this.socket;
            if (retry) {
                (function () {
                    if (connected) {
                        socket.send(JSON.stringify(message));
                    }
                    else {
                        window.setTimeout(arguments.callee, 20);
                    }
                })();
            }
            else {
                if (!connected && !retry) {
                    return;
                }
                socket.send(JSON.stringify(message));
            }
        };
        this.connected = false;
        this.onConnect = new Utils.Signal();
        this.onDisconnect = new Utils.Signal();
        this.onMessage = new Utils.Signal();
    }
    WteeServer.prototype.connect = function () {
        this.socket = new SockJS(this.apiURL);
        this.socket.onopen = this.connectionMade;
        this.socket.onclose = this.connectionLost;
    };
    return WteeServer;
}());
var LogView = /** @class */ (function () {
    function LogView(backend, settings, container, logEntryClass, logNoticeClass) {
        this.backend = backend;
        this.settings = settings;
        this.container = container;
        this.logEntryClass = logEntryClass;
        this.logNoticeClass = logNoticeClass;
        this.$container = $(container);
        this.containerParent = container.parentElement;
        this.parser = new Parser();
        this.history = [];
        this.autoScroll = true;
        this.lastSpan = null;
        this.lastSpanClasses = '';
    }
    LogView.prototype.toggleWrapLines = function () {
        this.$container.toggleClass('log-view-wrapped', this.settings.get('wrapLines'));
    };
    LogView.prototype.toggleHideEscapeCodes = function () {
        this.$container.toggleClass('log-view-hide-escape', this.settings.get('hideEscapeCodes'));
    };
    LogView.prototype.toggleEnableColors = function () {
        this.$container.toggleClass('log-view-enable-colors', this.settings.get('enableColors'));
    };
    LogView.prototype.createLogEntrySpan = function (inner_html) {
        return Utils.createSpan(inner_html, this.logEntryClass);
    };
    LogView.prototype.createLogNoticeSpan = function (inner_html) {
        return Utils.createSpan(inner_html, this.logNoticeClass);
    };
    LogView.prototype.writeSpans = function (spans) {
        if (spans.length === 0) {
            return;
        }
        var scrollAfterWrite = this.isAtBottom();
        var fragment = document.createDocumentFragment();
        // Create spans from all elements and add them to a temporary DOM.
        for (var i = 0; i < spans.length; i++) {
            var span = spans[i];
            this.history.push(span);
            fragment.appendChild(span);
        }
        this.container.appendChild(fragment);
        this.trimHistory();
        if (this.autoScroll && scrollAfterWrite) {
            this.scroll();
        }
        if (this.lastSpan) {
            this.lastSpan.className = this.lastSpanClasses;
        }
        this.lastSpan = this.history[this.history.length - 1];
        this.lastSpanClasses = this.lastSpan.className;
        this.lastSpan.className = this.lastSpanClasses + ' log-entry-current';
    };
    LogView.prototype.createSpans = function (message) {
        var spans = [];
        // Just a list of lines that we write to the logview.
        if (Array.isArray(message)) {
            var _loop_1 = function () {
                line = message[i].replace(/\n$/, '');
                // TODO: Need a css only solution.
                if (line === '') {
                    spans.push(this_1.createLogEntrySpan('&zwnj;'));
                    return "continue";
                }
                var parsedSpans = this_1.parser.parseLine(line);
                var entrySpan = this_1.createLogEntrySpan('');
                parsedSpans.forEach(function (span) {
                    entrySpan.appendChild(span);
                });
                spans.push(entrySpan);
            };
            var this_1 = this, line;
            for (var i = 0; i < message.length; i++) {
                _loop_1();
            }
        }
        else if ('err' in message) {
            for (var i = 0; i < message['err'].length; i++) {
                var line_1 = message['err'][i];
                spans.push(this.createLogNoticeSpan(line_1));
            }
        }
        else {
            $.each(message, function (fn, payload) {
                for (var i = 0; i < payload.length; i++) {
                    var line = Utils.escapeHtml(payload[i]);
                    line = line.replace(/\n$/, '');
                    spans.push(this.createLogEntrySpan(line));
                }
            });
        }
        this.writeSpans(spans);
    };
    LogView.prototype.clearLines = function () {
        this.container.innerHTML = '';
        this.history = [];
        this.lastSpan = null;
    };
    LogView.prototype.resize = function () {
        var toolbarHeight = this.settings.get('toolbarHeight');
        this.$container.height(window.innerHeight - toolbarHeight);
    };
    LogView.prototype.scroll = function () {
        this.containerParent.scrollTop = this.containerParent.scrollHeight;
    };
    LogView.prototype.trimHistory = function () {
        var linesOfHistory = this.settings.get('linesOfHistory');
        if (linesOfHistory !== 0 && this.history.length > linesOfHistory) {
            for (var i = 0; i < (this.history.length - linesOfHistory + 1); i++) {
                this.container.removeChild(this.history.shift());
            }
        }
    };
    LogView.prototype.isAtBottom = function () {
        var autoScrollOffset = this.containerParent.scrollTop -
            (this.containerParent.scrollHeight - this.containerParent.offsetHeight);
        return Math.abs(autoScrollOffset) < 50;
    };
    return LogView;
}());
// global $:false, jQuery:false
// jshint laxcomma: true, sub: true
/// <reference path="../vendor/typings/jquery.d.ts" />
/// <reference path="../vendor/typings/sockjs.d.ts" />
/// <reference path="../vendor/typings/moment.d.ts" />
/// <reference path="../vendor/typings/spin.d.ts" />
/// <reference path="Utils.ts" />
/// <reference path="Parser.ts" />
/// <reference path="Backend.ts" />
/// <reference path="Logview.ts" />
/// <reference path="Settings.ts" />
var settings = new Settings.Settings({
    toolbarHeight: 10,
    panelHidden: false,
    // Logview tunables.
    hideEscapeCodes: true,
    enableColors: true,
    wrapLines: window.clientConfig['wrap-lines-initial'],
    linesOfHistory: 2000,
    linesToTail: window.clientConfig['tail-lines-initial'],
    currentCommand: null,
    currentFile: null,
    currentScript: null,
    previousBackendMessage: null
});
$('#history-lines').val(settings.get('linesOfHistory'));
$('#tail-lines').val(settings.get('linesToTail'));
var apiURL = Utils.endsWith(window.relativeRoot, '/') ? 'ws' : '/ws';
var apiURL = [window.location.protocol, '//', window.location.host, window.relativeRoot, apiURL].join('');
var spinner = new Spinner();
var backend = new WteeServer(apiURL, 10);
var logview = new LogView(backend, settings, document.getElementById('logviewer'), 'log-entry', 'log-entry log-notice');
//----------------------------------------------------------------------------
// Show spinner while connecting to the backend.
//----------------------------------------------------------------------------
spinner.spin();
document.body.appendChild(spinner.el);
backend.onConnect.addCallback(function () {
    spinner.stop();
});
backend.onDisconnect.addCallback(function () {
    spinner = new Spinner();
    spinner.spin();
    document.body.appendChild(spinner.el);
});
backend.connect();
backend.onMessage.addCallback(function (message) {
    logview.createSpans(message);
});
//-----------------------------------------------------------------------------
// Configuration
//-----------------------------------------------------------------------------
$('#action-show-settings a').click(function () {
    $(this).toggleClass('fully-opaque');
    $('#configuration').toggle();
});
var watch_options = {
    wait: 500,
    highlight: true,
    captureLength: 1,
    callback: function (value) {
        switch (this.id) {
            case 'history-lines':
                settings.set('linesOfHistory', parseInt(value));
                break;
            case 'tail-lines':
                settings.set('linesToTail', parseInt(value));
                break;
        }
    }
};
$('#history-lines').typeWatch(watch_options);
$('#tail-lines').typeWatch(watch_options);
$('#wrap-lines').click(function () {
    settings.set('wrapLines', this.checked);
});
$('#hide-escape-codes').click(function () {
    settings.set('hideEscapeCodes', this.checked);
});
$('#enable-colors').click(function () {
    settings.set('enableColors', this.checked);
});
settings.onChange('linesOfHistory', function (lines) {
    logview.trimHistory();
});
settings.onChange('wrapLines', function (value) {
    logview.toggleWrapLines();
});
settings.onChange('hideEscapeCodes', function (value) {
    logview.toggleHideEscapeCodes();
});
settings.onChange('enableColors', function (value) {
    logview.toggleEnableColors();
});
// Set initial state of "Wrap Lines" checkbox.
$('#wrap-lines').attr('checked', settings.get('wrapLines'));
// Set initial state of "Hide ANSI escape sequences" checkbox.
$('#hide-escape-codes').attr('checked', settings.get('hideEscapeCodes'));
// Set initial state of "Enable ANSI colors" checkbox.
$('#enable-colors').attr('checked', settings.get('enableColors'));
// Set initial line-wrapping state of log-view spans.
logview.toggleWrapLines();
// Set initial escape codes hiding state of log-view spans.
logview.toggleHideEscapeCodes();
// Set initial colors display state of log-view spans.
logview.toggleEnableColors();
function onResize() {
    var newSize = $(window).height() - $('#toolbar').outerHeight();
    console.log(newSize);
    $('.scrollable').height(newSize);
}
// // TODO: rate-limit this callback.
$(window).resize(onResize);
onResize();
//# sourceMappingURL=Main.js.map