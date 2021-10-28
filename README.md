barcode-scanner-web.js
==============

A Wedge reader for barcode-scanners coming in as Keyboard Input (The only thing OS X supports since removing virtual com ports, which PC point of sale systems frequently use).

Usage
-----

require the library

    const Barcode = require('barcode-scanner-web');

A simple usage to catch all keystroke events at the document root to look for barcode events:

    let scanner = new Barcode.Scanner();
    Barcode.listen(document.body, scanner);
    new Barcode.Scan({
        scanner: scanner,
        suffix: 'Enter',
        onScan : function(e){
            console.log('>>>>>', e);

        }
    });

Testing
-------
TBD


Enjoy,

-Abbey Hawk Sparrow
