build/wtee:
	mkdir -p ./build
	TORNADO_EXTENSION=0 pex --not-zip-safe wtee -m wtee -o $@

.PHONY: build/wtee
