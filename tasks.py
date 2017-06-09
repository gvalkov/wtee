# -*- coding: utf-8; -*-

import re
import json

from glob import glob
from pathlib import Path

from invoke import run, task
from webassets.loaders import YAMLLoader
from webassets.filter import register_filter, Filter


BOWERBIN = Path('node_modules/bower/bin/bower')
BOWERDIR = Path('bower_components')
ASSETDIR = Path('wtee/assets')

#-----------------------------------------------------------------------------
# Invoke tasks.
#-----------------------------------------------------------------------------
@task(aliases=['lsbower'])
def list_bowerfiles(ctx):
    for source in bowerfiles():
        print(source)

@task
def collectstatic(ctx):
    # Copy bower main files to the vendor dir.
    for source in bowerfiles():
        dest = Path(ASSETDIR/'vendor', *source.parts[1:])
        run('install -vD {} {}'.format(source, dest))

@task
def cleanstatic(ctx):
    dirs = ['gen', 'fonts']
    paths = [Path(ASSETDIR/i).glob('*') for i in dirs]
    for path in (j for i in paths for j in i):
        if path.name.startswith('.'):
            continue
        print('unkink: %s' % path)
        path.unlink()


@task
def compile_typescript(ctx, debug=False):
    dst = ASSETDIR / 'gen/Main.js'
    src = ' '.join(map(str, Path('wtee/assets/js/').glob('*.ts')))
    cmd = 'node_modules/typescript/bin/tsc --pretty --out %s --sourceMap %s'

    print('* Compiling typescript to %s' % dst)
    run(cmd % (dst, src))

@task(pre=[compile_typescript])
def webassets(ctx, debug=False, expire=True, replace=False):
    # Register our custom webassets filter.
    register_filter(ConsoleLogFilter)

    #--------------------------------------------------------------------------
    # Load webassets environment.
    env = YAMLLoader('./webassets.yaml').load_environment()
    env.debug = debug
    env.url_expire = expire

    #--------------------------------------------------------------------------
    # Generate css/js urls.
    css_urls = [env['external-css'], env['internal-css']]
    css_urls = [url_to_link(url) for urls in css_urls for url in urls.urls()]

    js_urls = [env['external-js'], env['internal-js']]
    js_urls = [url_to_script(url) for urls in js_urls for url in urls.urls()]

    print()
    print('* URLs css:')
    print(''.join((i.lstrip() for i in css_urls)))

    print('* URLs js:')
    print(''.join((i.lstrip() for i in js_urls)))

    if replace:
        sedplaceholder('wtee/templates/base.html', '<!-- WEBASSETS CSS -->', css_urls)
        sedplaceholder('wtee/templates/base.html', '<!-- WEBASSETS JS -->',  js_urls)


#-----------------------------------------------------------------------------
# Utility functions.
#-----------------------------------------------------------------------------
def sedplaceholder(filename, placeholder, replacement, indent=6):
    lines = open(filename).readlines()
    start, end = None, None
    for n, line in enumerate(lines):
        if line.strip() == placeholder:
            if not start:
                start = n
                continue
            if not end:
                end = n
            if start and end:
                break

    lines[start + 1:end] = ['%s%s' % (' ' * indent, i) for i in replacement]
    with open(filename, 'w') as fh:
        fh.write(''.join(lines))

def url_to_link(url):
    return "  <link rel='stylesheet' href='{{root}}%s'>\n" % url

def url_to_script(url):
    return "  <script src='{{root}}%s'></script>\n" % url

def bowerfiles():
    res = run('%s list --paths --json' % BOWERBIN, hide='out')
    res = json.loads(res.stdout)

    # Flatten the output of `bower list` and expand globs.
    main = ([i] if not isinstance(i, list) else i for i in res.values())
    main = (glob(j) for i in main for j in i)
    main = [Path(j) for i in main for j in i]
    return main

def vendorfiles():
    for source in bowerfiles():
        yield Path(ASSETDIR, *source.parts[1:])


class ConsoleLogFilter(Filter):
    '''
    A webassets filter that removes calls to console.log in non-debug builds.
    '''

    name = 'rmconsole'

    def output(self, _in, out, **kwargs):
        for line in _in:
            line = re.sub(r'console\.(log|warn)\(.*?\);', '', line)
            out.write(line)
