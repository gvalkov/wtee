var LogView = (function () {
    function LogView(backend, settings, container, logEntryClass, logNoticeClass) {
        this.backend = backend;
        this.settings = settings;
        this.container = container;
        this.logEntryClass = logEntryClass;
        this.logNoticeClass = logNoticeClass;
        this.$container = $(container);
        this.containerParent = container.parentElement;
        this.history = [];
        this.autoScroll = true;
        this.lastSpan = null;
        this.lastSpanClasses = '';
    }
    LogView.prototype.toggleWrapLines = function () {
        this.$container.toggleClass('log-view-wrapped', this.settings.get('wrapLines'));
    };
    LogView.prototype.createSpan = function (inner_html, class_names) {
        var span = document.createElement('span');
        span.innerHTML = inner_html;
        span.className = class_names;
        return span;
    };
    LogView.prototype.createLogEntrySpan = function (inner_html) {
        return this.createSpan(inner_html, this.logEntryClass);
    };
    LogView.prototype.createLogNoticeSpan = function (inner_html) {
        return this.createSpan(inner_html, this.logNoticeClass);
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
            for (var i = 0; i < message.length; i++) {
                var line = Utils.escapeHtml(message[i]);
                line = line.replace(/\n$/, '');
                // TODO: Need a css only solution.
                if (line === '') {
                    line = '&zwnj;';
                }
                spans.push(this.createLogEntrySpan(line));
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
var WteeServer = (function () {
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
    var Signal = (function () {
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
/// <reference path="Utils.ts" />
var Settings;
(function (Settings_1) {
    var Settings = (function () {
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
// global $:false, jQuery:false
// jshint laxcomma: true, sub: true
/// <reference path="../vendor/typings/jquery.d.ts" />
/// <reference path="../vendor/typings/sockjs.d.ts" />
/// <reference path="../vendor/typings/moment.d.ts" />
/// <reference path="../vendor/typings/spin.d.ts" />
/// <reference path="Utils.ts" />
/// <reference path="Backend.ts" />
/// <reference path="Logview.ts" />
/// <reference path="Settings.ts" />
var settings = new Settings.Settings({
    toolbarHeight: 10,
    panelHidden: false,
    // Logview tunables.
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
settings.onChange('linesOfHistory', function (lines) {
    logview.trimHistory();
});
settings.onChange('wrapLines', function (value) {
    logview.toggleWrapLines();
});
// Set initial state of "Wrap Lines" checkbox.
$('#wrap-lines').attr('checked', settings.get('wrapLines'));
// Set initial line-wrapping state of log-view spans.
logview.toggleWrapLines();
function onResize() {
    var newSize = $(window).height() - $('#toolbar').outerHeight();
    console.log(newSize);
    $('.scrollable').height(newSize);
}
// // TODO: rate-limit this callback.
$(window).resize(onResize);
onResize();
//# sourceMappingURL=Main.js.map