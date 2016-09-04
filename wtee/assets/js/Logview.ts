class LogView {
    $container: JQuery;
    containerParent: HTMLElement;

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

        this.history = [];
        this.autoScroll = true;
        this.lastSpan = null;
        this.lastSpanClasses = '';
    }

    toggleWrapLines() {
        this.$container.toggleClass('log-view-wrapped', this.settings.get<boolean>('wrapLines'));
    }

    createSpan(inner_html: string, class_names: string) {
        let span: HTMLElement = document.createElement('span');
        span.innerHTML = inner_html;
        span.className = class_names;
        return span
    }

    createLogEntrySpan(inner_html: string) {
        return this.createSpan(inner_html, this.logEntryClass);
    }

    createLogNoticeSpan(inner_html: string) {
        return this.createSpan(inner_html, this.logNoticeClass);
    }

    writeSpans(spans: HTMLElement[]) {
        if (spans.length === 0) {
            return;
        }

        var scrollAfterWrite = this.isAtBottom();
        let fragment = <HTMLElement>document.createDocumentFragment();

        // Create spans from all elements and add them to a temporary DOM.
        for (var i = 0; i < spans.length; i++) {
            let span = spans[i];
            this.history.push(span);
            fragment.appendChild(span);
        }

        this.container.appendChild(fragment);
        this.trimHistory();
        fragment.innerHTML = '';

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

    createSpans(message: string[]) {
        let spans: HTMLElement[] = [];

        // Just a list of lines that we write to the logview.
        if (Array.isArray(message)) {
            for (var i=0; i<message.length; i++) {
                var line = Utils.escapeHtml(message[i]);
                line = line.replace(/\n$/, '');

                // TODO: Need a css only solution.
                if (line === '') {
                    line = '&zwnj;';
                }
                spans.push(this.createLogEntrySpan(line));
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
