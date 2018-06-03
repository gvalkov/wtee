class Parser {
  escapeCodeSplitRegExp: RegExp = /(\x1b\[[0-9;]*[a-zA-Z])/g;
  escapeCodeCaptureRegExp: RegExp = /\x1b\[([0-9;]*)([a-zA-Z])/;
  foreground: number;
  background: number;
  colorAttribute: number;
  textAttributes: number[];

  constructor() {
    this.foreground = 0;
    this.background = 0;
    this.colorAttribute = 0;
    this.textAttributes = [];
  }

  resetAllAttributes() {    
    this.foreground = 0;
    this.background = 0;
    this.colorAttribute = 0;
    this.textAttributes.length = 0;
  }

  setAttribute(arg: number) {
    if (arg === 0) {  // 0 - all attributes off
      this.resetAllAttributes();
    } else if (arg <= 2) {  // 1, 2 - bright/faint text
      this.colorAttribute = arg;
    } else if (arg <= 9) {  // 3-9 - text style: italic, underline, blinking, reverse, hide and cross-out
      if (this.textAttributes.indexOf(arg) === -1) {
        this.textAttributes.push(arg);
      }
    } else if (arg >= 30 && arg <= 37) {  // 30-37 - foreground colors
      this.foreground = arg;
    } else if (arg >= 40 && arg <= 47) {  // 40-47 - background colors
      this.background = arg;
    }
  }

  parseLine(line: string) {
    line = line.replace(/\n$/, '');
    let chunks: string[] = line.split(this.escapeCodeSplitRegExp);
    let parsedSpans: HTMLElement[] = [];
    for (let substring of chunks) {
      if (!substring.length) {
        continue;
      }
      let matches: string[] = substring.match(this.escapeCodeCaptureRegExp);
      console.log(matches);
      if (matches) {
        let args: string = matches[1];
        let command: string = matches[2];
        if (command == 'm') {
          let attrs = args.split(';');
          for (let a of attrs) {
            this.setAttribute(parseInt(a) || 0);
          }
        }
        parsedSpans.push(Utils.createSpan(Utils.escapeHtml(substring), 'esc'));
      } else {
        let escCodes = this.textAttributes.slice();  // copy array
        if (this.foreground) {
          escCodes.push(this.foreground);
        }
        if (this.background) {
          escCodes.push(this.background);
        }
        if (this.colorAttribute) {
          escCodes.push(this.colorAttribute);
        }
        let classes = escCodes.map(function(code) {
          return 'esc-' + code;
        }).join(' ');
        parsedSpans.push(Utils.createSpan(Utils.escapeHtml(substring), classes));
      }
    }
    return parsedSpans;
  }
}
