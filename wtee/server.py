# -*- coding: utf-8; -*-

import os
import sys
import fcntl
import logging

import sockjs.tornado
from tornado import web, ioloop, escape


log = logging.getLogger(__file__)
io_loop = ioloop.IOLoop.instance()


class BaseHandler(web.RequestHandler):
    def __init__(self, *args, **kw):
        super(BaseHandler, self).__init__(*args, **kw)
        self.config = self.application.config
        self.client_config = self.application.client_config


class Index(BaseHandler):
    def initialize(self, template):
        self.template = template

    def get(self):
        ctx = {
            'root': self.config['relative-root'],
            'client_config': escape.json_encode(self.client_config),
        }

        self.render(self.template, **ctx)


class NonCachingStaticFileHandler(web.StaticFileHandler):
    def set_extra_headers(self, path):
        self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')


class WebsocketWTee(sockjs.tornado.SockJSConnection):
    def __init__(self, *args, **kw):
        super(WebsocketWTee, self).__init__(*args, **kw)

        self.last_line = []
        self.config = self.application.config
        self.connected = False

        # This is for compatibility between Python 2 and 3.
        self.stdin_buffer  = getattr(sys.stdin, 'buffer', sys.stdin)
        self.stdout_buffer = getattr(sys.stdout, 'buffer', sys.stdout)

        fl = fcntl.fcntl(sys.stdin, fcntl.F_GETFL)
        fcntl.fcntl(sys.stdin, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    def on_open(self, info):
        self.connected = True
        io_loop.add_handler(self.stdin_buffer, self.on_stdin, io_loop.READ)

    def on_stdin(self, fd, events):
        data = fd.read()
        lines = data.splitlines(True)

        # TODO: Use the value of '--input-encoding' here.
        decoded_data = data.decode('utf8', errors='replace')
        lines = decoded_data.splitlines(True)
        if lines:
            if not lines[-1].endswith('\n'):
                self.last_line.append(lines[-1])
                lines = lines[:-1]
            else:
                if self.last_line:
                    lines[0] = ''.join(self.last_line) + lines[0]
                    self.last_line = []

        self.stdout_buffer.write(data)
        self.stdout_buffer.flush()
        self.write_json(lines)

    def on_close(self):
        self.connected = False
        io_loop.remove_handler(sys.stdin)
        log.debug('connection closed')

    def write_json(self, data):
        return self.send(escape.json_encode(data))


class WTeeApplication(web.Application):
    here = os.path.dirname(__file__)

    def setup_routes(self):
        routes = [
            [r'/assets/(.*)', NonCachingStaticFileHandler, {'path': os.path.join(self.here, 'assets/')}],
            [r'/', Index, {'template': 'wtee.html'}],
        ]

        WebsocketWTee.application = self
        ws_handler = sockjs.tornado.SockJSRouter(WebsocketWTee, os.path.join('/', self.relative_root, 'ws'))
        routes += ws_handler.urls
        return routes, ws_handler

    def __init__(self, config, client_config, template_dir=None, assets_dir=None):
        self.relative_root = config['relative-root']
        self.config = config
        self.client_config = client_config

        if not template_dir:
            template_dir = os.path.join(self.here, 'templates')

        if not assets_dir:
            assets_dir = os.path.join(self.here, 'assets')

        log.debug('template dir: %s', template_dir)
        log.debug('static dir: %s', assets_dir)

        routes, self.ws_handler = self.setup_routes()

        # Tornado wants routes to be a list of tuples.
        for n, route in enumerate(routes):
            if isinstance(routes[n], tuple):
                continue
            route[0] = os.path.join('/', self.relative_root, route[0].lstrip('/'))
            routes[n] = tuple(route)

        settings = {
            'static_path': assets_dir,
            'template_path': template_dir,
            'debug': config['debug'],
        }

        super(WTeeApplication, self).__init__(routes, **settings)
