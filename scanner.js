var objectTool = require('async-objects');
var CharacterScanBuffer = require('character-scanner');
var check = function(s, prefix, suffix, cb){
    var str = s;
    if(prefix){
        if(str.slice(0, prefix.length) !== prefix) return false;
        str = str.slice(prefix.length);
    }
    if(suffix){
        if(str.slice(str.length - suffix.length) !== suffix) return false;
        str = str.slice(0, str.length - suffix.length);
    }
    return cb(str);
}
var types = {
    'UPC-A' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{12,19}/g);
            return res;
        });
    },
    'EAN-13' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{14,21}/g);
            return res;
        });
    },
    'EAN-8' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{8}/g);
            return res;
        });
    }
}
var internalScanner;
var BarcodeScan = function(opts){
    var options = opts || {};
    if(typeof opts == 'function') options = {onScan:options};
    if(!options.scanner && !internalScanner) internalScanner = new CharacterScanBuffer();
    var scanner = options.scanner || internalScanner;
    var callback = options.onScan || options.callback;
    var passes = function(str, typeNames){
        var result = false;
        var test;
        return typeNames.reduce(function(agg, name){
            if(!types[name]) throw Error('Unknown Type: '+name);
            return agg || types[name](str, options.prefix, options.suffix);
        }, false);
    }
    scanner.addScanner({
        name:'barcode-scan',
        scan: function(str){
            return passes(str, [
                'UPC-A',
                'EAN-13',
                'EAN-8',
            ]);
        }
    });
    var swipes = {};
    scanner.on('barcode-scan', function(sc){
        var scan = sc[0] || sc;
        //augment meta
        var res = {};
        Object.keys(types).map(function(type){
            var t = types[type](scan);
            res[type] = (t && t[0]) === scan;
        });
        var scanType;
        Object.keys(res).forEach(function(type){
            if(res[type]) scanType = type;
        });
        callback({
            code : scan,
            type : scanType
        });
    });
};
module.exports = {
    listen : function(node, scanner){
        var handler = function(e){ scanner.input(e.key) }
        if(node.addEventListener){
            node.addEventListener('keydown', handler);
        }else{
            if(node.on){
                node.on('keydown', handler);
            }
        }
    },
    Scan: BarcodeScan
}
module.exports.Scanner = CharacterScanBuffer;
