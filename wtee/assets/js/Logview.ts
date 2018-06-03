class LogView {
    $container: JQuery;
    containerParent: HTMLElement;
    parser: Parser;

    history: HTMLElement[];
    autoScroll: boolean;
    lastSpan: HTMLElement;
    lastSpanClasses: string;

    constructor(
        public backend: WteeServer,
        public settings: Settings.Settings,
        public container: HTMLElement,
        public logEntryClass: string,
        public logNoticeClass: string
    ) {
        this.$container = $(container);
        this.containerParent = container.parentElement;
        this.parser = new Parser();

        this.history = [];
        this.autoScroll = true;
        this.lastSpan = null;
        this.lastSpanClasses = '';
    }

    toggleWrapLines() {
        this.$container.toggleClass('log-view-wrapped', this.settings.get<boolean>('wrapLines'));
    }

    toggleHideEscapeCodes() {
        this.$container.toggleClass('log-view-hide-escape', this.settings.get<boolean>('hideEscapeCodes'));
    }

    toggleEnableColors() {
        this.$container.toggleClass('log-view-enable-colors', this.settings.get<boolean>('enableColors'));
    }

    createLogEntrySpan(inner_html: string) {
        return Utils.createSpan(inner_html, this.logEntryClass);
    }

    createLogNoticeSpan(inner_html: string) {
        return Utils.createSpan(inner_html, this.logNoticeClass);
    }

    writeSpans(spans: HTMLElement[]) {
        if (spans.length === 0) {
            return;
        }

        var scrollAfterWrite = this.isAtBottom();
        let fragment: DocumentFragment = document.createDocumentFragment();

        // Create spans from all elements and add them to a temporary DOM.
        for (var i = 0; i < spans.length; i++) {
            let span = spans[i];
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

        this.lastSpan = this.history[this.history.length-1];
        this.lastSpanClasses = this.lastSpan.className;
        this.lastSpan.className = this.lastSpanClasses + ' log-entry-current';
    }

    createSpans(message: string[] | any) {
        let spans: HTMLElement[] = [];

        // Just a list of lines that we write to the logview.
        if (Array.isArray(message)) {
            for (var i=0; i<message.length; i++) {
                var line = message[i].replace(/\n$/, '');

                // TODO: Need a css only solution.
                if (line === '') {
                    spans.push(this.createLogEntrySpan('&zwnj;'));
                    continue;
                }
                let parsedSpans = this.parser.parseLine(line);
                let entrySpan = this.createLogEntrySpan('');
                parsedSpans.forEach(function(span) {
                    entrySpan.appendChild(span);
                });
                spans.push(entrySpan);
            }
        } else if ('err' in message) {
            for (var i=0; i<message['err'].length; i++) {
                let line: string = message['err'][i];
                spans.push(this.createLogNoticeSpan(line));
            }
        } else {
            $.each(message, function (fn, payload) {
                for (var i=0; i<payload.length; i++) {
                    var line = Utils.escapeHtml(payload[i]);
                    line = line.replace(/\n$/, '');
                    spans.push(this.createLogEntrySpan(line));
                }
            });
        }

        this.writeSpans(spans);
    }

    clearLines() {
        this.container.innerHTML = '';
        this.history = [];
        this.lastSpan = null;
    }

    resize() {
        let toolbarHeight = this.settings.get<number>('toolbarHeight');
        this.$container.height(window.innerHeight - toolbarHeight);
    }

    scroll() {
        this.containerParent.scrollTop = this.containerParent.scrollHeight;
    }

    trimHistory() {
        let linesOfHistory = this.settings.get<number>('linesOfHistory');
        if (linesOfHistory !== 0 && this.history.length > linesOfHistory) {
            for (var i = 0; i < (this.history.length - linesOfHistory + 1); i++) {
                this.container.removeChild(this.history.shift());
            }
        }
    }

    isAtBottom() {
        let autoScrollOffset = this.containerParent.scrollTop -
            (this.containerParent.scrollHeight - this.containerParent.offsetHeight);
        return Math.abs(autoScrollOffset) < 50;
    }

}
