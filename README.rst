Wtee
====

The wtee tool does two things:

- Duplicates standard input to standard output.
- Starts a local http server on which the piped data can be viewed.

In other words, much like the unix ``tee`` utility, *wtee* duplicates
standard input to standard output, while also making the piped data
viewable on a web page. For example::

  tail -f /var/log/debug | wtee | nl

Documentation:
    http://wtee.readthedocs.io/en/latest/

Development:
    https://github.com/gvalkov/wtee

Package:
    http://pypi.python.org/pypi/wtee

Changelog:
    http://wtee.readthedocs.io/en/latest/changelog.html
