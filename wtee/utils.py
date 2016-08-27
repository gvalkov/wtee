# -*- coding: utf-8; -*-

import os
import re
import logging
import argparse

log = logging.getLogger(__file__)


class CompactHelpFormatter(argparse.RawTextHelpFormatter):
    def __init__(self, *args, **kw):
        super(CompactHelpFormatter, self).__init__(*args, max_help_position=35, **kw)

    def _format_usage(self, *args, **kw):
        usage = super(CompactHelpFormatter, self)._format_usage(*args, **kw)
        return usage.capitalize()

    def _format_action_invocation(self, action):
        if not action.option_strings:
            metavar = self._metavar_formatter(action, action.dest.upper())(1)
            return metavar
        else:
            res = ', '.join(action.option_strings)
            args_string = self._format_args(action, action.dest.upper())
            res = '%s %s' % (res, args_string)
            return res


def listdir_abspath(path, files_only=True):
    paths = [os.path.join(path, i) for i in os.listdir(path)]
    if not files_only:
        return paths
    return [path for path in paths if os.path.isfile(path)]


def parseaddr(arg):
    tmp = arg.split(':')
    port = int(tmp[-1])
    addr = ''.join(tmp[:-1])
    addr = '' if addr == '*' else addr
    return port, addr


def remove_escapes(string):
    return re.sub(r'\x1B\[(?:[0-9]{1,2}(?:;[0-9]{1,2})?)?[m|K]', '', string)
