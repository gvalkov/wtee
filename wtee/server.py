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
        self.clients = self.application.sockjs_clients
        self.stdio_handler = self.application.stdio_handler

    def on_open(self, info):
        self.clients.add(self)
        if not self.stdio_handler.stdin_closed and len(self.clients) == 1:
            log.debug('First client connected - adding stdin listener')
            self.stdio_handler.enable_stdin_handler()

    def on_close(self):
        self.clients.remove(self)
        if not self.stdio_handler.stdin_closed and not self.clients:
            log.debug('No more clients - removing stdin listener')
            self.stdio_handler.disable_stdin_handler()


class StdioHandler:
    def __init__(self, clients, broadcast_func, application_config):
        self.clients = clients
        self.broadcast = broadcast_func
        self.application_config = application_config

        self.last_line = []
        self.stdin_buffer, self.stdout_buffer = self.open_fds()
        self.stdin_closed = False

    def enable_stdin_handler(self):
        io_loop.add_handler(self.stdin_buffer, self.on_stdin, io_loop.READ)

    def disable_stdin_handler(self):
        io_loop.remove_handler(self.stdin_buffer)

    def on_stdin(self, fd, events):
        data = fd.read()
        lines = data.splitlines(True)

        decoded_data = data.decode(self.application_config["input-encoding"], errors='replace')
        lines = decoded_data.splitlines(True)
        if lines:
            if not lines[-1].endswith('\n'):
                self.last_line.append(lines[-1])
                lines = lines[:-1]
            else:
                if self.last_line:
                    lines[0] = ''.join(self.last_line) + lines[0]
                    self.last_line = []

        self.broadcast(self.clients, escape.json_encode(lines))
        self.stdout_buffer.write(data)
        self.stdout_buffer.flush()

        # TODO: Empty string and None mean different things with os.O_NONBLOCK.
        if not data:
            log.debug('stdin closed')
            self.stdin_closed = True
            self.disable_stdin_handler()

    def open_fds(self, stdin=sys.stdin, stdout=sys.stdout):
        # This is for compatibility between Python 2 and 3.
        stdin_buffer  = getattr(stdin, 'buffer', stdin)
        stdout_buffer = getattr(stdout, 'buffer', stdout)

        fl = fcntl.fcntl(stdin, fcntl.F_GETFL)
        fcntl.fcntl(stdin, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        return stdin_buffer, stdout_buffer


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

        # Tornado expects routes to be a list of tuples.
        for n, route in enumerate(routes):
            if isinstance(routes[n], tuple):
                continue
            route[0] = os.path.join('/', self.relative_root, route[0].lstrip('/'))
            routes[n] = tuple(route)

        self.sockjs_clients = set()
        self.stdio_handler = StdioHandler(self.sockjs_clients, self.ws_handler.broadcast, config)

        settings = {
            'static_path': assets_dir,
            'template_path': template_dir,
            'debug': config['debug'],
        }

        super(WTeeApplication, self).__init__(routes, **settings)
