Wtee
======

Much like the unix ``tee`` utility, *wtee* duplicates standard input to standard
output, while also making the piped data viewable on a web page. For example::

  tail -f /var/log/debug | wtee | nl


Installation
------------

The latest stable versions of wtee can be installed from pypi_:

.. code-block:: bash

    $ pip install wtee

The development versions are available on github_ and can also be
installed with the help of pip:

.. code-block:: bash

    $ pip install git+git://github.com/gvalkov/wtee.git

Wtee works with Python 2.7 and newer. Using it with Python >= 3.3 is
encouraged.


Usage
~~~~~

The wtee tool does two things:

- Duplicates standard input to standard output.
- Starts a local http server on which the piped data can be viewed.

Wtee's server-side functionality is summarized in its help message::

  Usage: wtee [-h] [-d] [-v] [--output-encoding enc] [--input-encoding enc]
            [-b addr:port] [-r path] [--no-wrap-lines]

  A webview for piped data.

  General options:
    -h, --help                show this help message and exit
    -d, --debug               show debug messages
    -v, --version             show program's version number and exit
    --output-encoding enc     encoding for output
    --input-encoding enc      encoding for input and output (default utf8)

  Server options:
    -b, --bind addr:port      listen on the specified address and port
    -r, --relative-root path  web app root path

  User-interface options:
    --no-wrap-lines           initial line-wrapping state (default: true)

  Example command-line:
    tail -f /var/log/debug | wtee -b localhost:8080 | nl


Reverse proxy configuration
---------------------------

Nginx
~~~~~

1) Run ``wtee``, binding it to localhost and specifiying a relative root of your
   liking. For example:

.. code-block:: bash

   $ tail -f logfile | wtee -b localhost:8084 -r '/wtee/'

2) Add the following location directives to ``nginx.conf``:

.. code-block:: none

   location /wtee/ws {
       proxy_pass http://localhost:8084/wtee/ws;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }

   location /wtee {
       proxy_pass http://localhost:8084;
   }



Attributions
------------

Wtee and favicon was created from this_ icon.


License
-------

Wtee and wtee are released under the terms of the `Revised BSD License`_.


.. _pypi:      http://pypi.python.org/pypi/wtee
.. _github:    https://github.com/gvalkov/wtee
.. _this:      http://www.iconfinder.com/icondetails/15150/48/terminal_icon
.. _`Revised BSD License`: https://raw.github.com/gvalkov/wtee/master/LICENSE
