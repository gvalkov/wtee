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

interface Window {
    relativeRoot: string;
    clientConfig: any;
}

interface JQuery {
    typeWatch(): JQuery;
    typeWatch(settings: Object): JQuery;
}

let settings = new Settings.Settings({
    toolbarHeight: 10,

    panelHidden: false,

    // Logview tunables.
    hideEscapeCodes: true,
    enableColors: true,
    wrapLines: window.clientConfig['wrap-lines-initial'],
    linesOfHistory: 2000,  // 0 for infinite history.
    linesToTail: window.clientConfig['tail-lines-initial'],  // i.e. tail -n $linesToTail.

    currentCommand: null,
    currentFile: null,
    currentScript: null,

    previousBackendMessage: null
});

$('#history-lines').val(settings.get('linesOfHistory'));
$('#tail-lines').val(settings.get('linesToTail'));

var apiURL = Utils.endsWith(window.relativeRoot, '/') ? 'ws' : '/ws';
var apiURL = [window.location.protocol, '//', window.location.host, window.relativeRoot, apiURL].join('');

let spinner  = new Spinner()

const backend = new WteeServer(apiURL, 10);
const logview = new LogView(
    backend, settings,
    document.getElementById('logviewer'),
    'log-entry',
    'log-entry log-notice'
)


//----------------------------------------------------------------------------
// Show spinner while connecting to the backend.
//----------------------------------------------------------------------------
spinner.spin();
document.body.appendChild(spinner.el);

backend.onConnect.addCallback(function() {
    spinner.stop();
});

backend.onDisconnect.addCallback(function() {
    spinner = new Spinner();
    spinner.spin();
    document.body.appendChild(spinner.el);
})

backend.connect();

backend.onMessage.addCallback(function(message) {
    logview.createSpans(message)
});


//-----------------------------------------------------------------------------
// Configuration
//-----------------------------------------------------------------------------
$('#action-show-settings a').click(function() {
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
            settings.set<number>('linesOfHistory', parseInt(value));
            break;
        case 'tail-lines':
            settings.set<number>('linesToTail', parseInt(value));
            break;
        }
    }
};

$('#history-lines').typeWatch(watch_options);
$('#tail-lines').typeWatch(watch_options);

$('#wrap-lines').click(function() {
    settings.set<boolean>('wrapLines', this.checked);
});

$('#hide-escape-codes').click(function() {
    settings.set<boolean>('hideEscapeCodes', this.checked);
});

$('#enable-colors').click(function() {
    settings.set<boolean>('enableColors', this.checked);
});

settings.onChange('linesOfHistory', function(lines) {
    logview.trimHistory();
});

settings.onChange('wrapLines', function(value) {
    logview.toggleWrapLines();
});

settings.onChange('hideEscapeCodes', function(value) {
    logview.toggleHideEscapeCodes();
});

settings.onChange('enableColors', function(value) {
    logview.toggleEnableColors();
});

// Set initial state of "Wrap Lines" checkbox.
$('#wrap-lines').attr('checked', settings.get('wrapLines'))

// Set initial state of "Hide ANSI escape sequences" checkbox.
$('#hide-escape-codes').attr('checked', settings.get('hideEscapeCodes'))

// Set initial state of "Enable ANSI colors" checkbox.
$('#enable-colors').attr('checked', settings.get('enableColors'))

// Set initial line-wrapping state of log-view spans.
logview.toggleWrapLines()
// Set initial escape codes hiding state of log-view spans.
logview.toggleHideEscapeCodes()
// Set initial colors display state of log-view spans.
logview.toggleEnableColors()


function onResize() {
    var newSize = $(window).height() - $('#toolbar').outerHeight();
    console.log(newSize);
    $('.scrollable').height(newSize);
}

// // TODO: rate-limit this callback.
$(window).resize(onResize);
onResize();
