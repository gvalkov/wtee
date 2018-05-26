#!/usr/bin/env python3
# -*- coding: utf-8; -*-

from __future__ import absolute_import
from __future__ import print_function

import sys
import pprint
import logging
import argparse
import textwrap

from tornado import ioloop, httpserver

from . import server
from . import utils

__version__ = '1.2.0'


#-----------------------------------------------------------------------------
# Setup Logging
log = logging.getLogger()
ch = logging.StreamHandler()
ft = logging.Formatter('[+%(relativeCreated)f][%(levelname)5s] %(message)s')

ch.setFormatter(ft)
ch.setLevel(logging.DEBUG)

log.setLevel(logging.INFO)
log.addHandler(ch)
log.propagate = 0

# tornado access logging
weblog = logging.getLogger('tornado.access')
weblog.addHandler(ch)
weblog.setLevel(logging.WARN)
weblog.propagate = 0

# tornado application logging
applog = logging.getLogger('tornado.application')
applog.addHandler(ch)
applog.setLevel(logging.WARN)
applog.propagate = 0


def enable_debug_logging():
    log.setLevel(logging.DEBUG)
    applog.setLevel(logging.DEBUG)
    weblog.setLevel(logging.DEBUG)


def parseopts(args=None):
    description = '''
    A webview for piped data.
    '''

    epilog = '''
    Example command-line usage:
      tail -f /var/log/debug | wtee -b localhost:8080 | nl
    '''

    parser = argparse.ArgumentParser(
        formatter_class=utils.CompactHelpFormatter,
        description=textwrap.dedent(description),
        epilog=textwrap.dedent(epilog),
        add_help=False
    )

    group = parser.add_argument_group('General options')
    arg = group.add_argument
    arg('-h', '--help',      action='help',       help='show this help message and exit')
    arg('-d', '--debug',     action='store_true', help='show debug messages')
    arg('-v', '--version',   action='version',    version='wtee version %s' % __version__)
    arg('--output-encoding', metavar='enc', help="encoding for output")
    arg('--input-encoding',  metavar='enc', default='utf8', help='encoding for input and output (default: utf8)')

    group = parser.add_argument_group('Server options')
    arg = group.add_argument
    arg('-b', '--bind',          metavar='addr:port', help='listen on the specified address and port')
    arg('-r', '--relative-root', metavar='path', default='', help='webapp root path')

    group = parser.add_argument_group('User-interface options')
    arg = group.add_argument
    arg('--no-wrap-lines', dest='wrap-lines', action='store_false', help='initial line-wrapping state (default: true)')

    return parser, parser.parse_args(args)


def setup_config(opts):
    port, addr = utils.parseaddr(opts.bind if opts.bind else 'localhost:8080')
    config = {
        'port': port,
        'addr': addr,
        'input-encoding': opts.__dict__.get('input_encoding', ''),
        'relative-root': opts.__dict__.get('relative_root', ''),
        'debug': opts.__dict__.get('debug', False),
        'wrap-lines': opts.__dict__.get('wrap-lines', True),
    }
    return config


def start_server(application, config, client_config):
    httpd = httpserver.HTTPServer(application)
    httpd.listen(config['port'], config['addr'])

    log.debug('Config:\n%s', pprint.pformat(config))
    log.debug('Client config:\n%s', pprint.pformat(client_config))
    if 'files' in config:
        log.debug('Files:\n%s',  pprint.pformat(dict(config['files'])))

    loop = ioloop.IOLoop.instance()
    msg = 'Listening on %s:%s' % (config['addr'], config['port'])
    loop.add_callback(log.info, msg)
    loop.start()


def get_resource_dirs():
    try:
        import pkg_resources
        template_dir = pkg_resources.resource_filename('wtee', 'templates')
        assets_dir = pkg_resources.resource_filename('wtee', 'assets')
    except ImportError:
        template_dir, assets_dir = None, None
    return template_dir, assets_dir


def main(argv=sys.argv):
    parser, opts = parseopts()

    if opts.debug:
        enable_debug_logging()

    template_dir, assets_dir = get_resource_dirs()
    config = setup_config(opts)

    client_config = {
        'wrap-lines-initial': config['wrap-lines'],
        'tool': 'wtee',
    }

    application = server.WTeeApplication(config, client_config, template_dir, assets_dir)

    try:
        start_server(application, config, client_config)
    except KeyboardInterrupt:
        ioloop.IOLoop.instance().stop()
