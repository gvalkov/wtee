#!/usr/bin/env python
# encoding: utf-8

from setuptools import setup

classifiers = [
    'Development Status :: 5 - Production/Stable',
    'Programming Language :: Python :: 2.7',
    'Programming Language :: Python :: 3',
    'License :: OSI Approved :: BSD License',
    'Intended Audience :: Developers',
]

requirements = [
    'tornado>=4.0.0,<5.0.0',
    'sockjs-tornado>=1.0.0',
]

kw = {
    'name':             'wtee',
    'version':          '1.2.0',
    'description':      'read from stdin, write to stdout and serve on a webpage',
    'long_description': open('README.rst').read(),
    'author':           'Georgi Valkov',
    'author_email':     'georgi.t.valkov@gmail.com',
    'license':          'Revised BSD License',
    'url':              'https://github.com/gvalkov/wtee',
    'keywords':         'log tee tail',
    'packages':         ['wtee'],
    'classifiers':      classifiers,
    'install_requires': requirements,
    'include_package_data': True,
    'zip_safe': True,
    'entry_points': {
        'console_scripts': [
            'wtee = wtee.main:main'
        ]
    },
}

if __name__ == '__main__':
    setup(**kw)
