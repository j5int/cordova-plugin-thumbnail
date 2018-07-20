'use strict';

var Thumbnails = {},
    emptyFn = function() {};

function options2Args(options) {
    if(!options.maxPixelSize) {
        options.maxPixelSize = 120;
    }

    if(!options.compression) {
        options.compression = 90;
    }
    
    if(!options.outputFormat && options.targetPath) {
        var ext = options.targetPath.split(".").pop().lower()
        if (ext === 'png'){
            options.outputFormat = 'PNG';
        } else if (ext === 'webp'){
            options.outputFormat = 'WEBP'
        } else {
            options.outputFormat = 'JPG'
        }
        
    }

    if (!options.targetPath) {
        return [options.srcPath, options.maxPixelSize, options.compression, "JPG"];
    } else {
        return [options.srcPath, options.targetPath, options.maxPixelSize, options.compression, options.outputFormat];
    }
}

Thumbnails.PERSISTENCE = 1;
Thumbnails.TEMPERATE = 0;

Thumbnails.config = function(persistenceOrTemp) {
    cordova.exec(emptyFn, emptyFn, "Thumbnails", "config", [persistenceOrTemp]);
};

Thumbnails.thumbnail = function(srcPath, options, successFn, failFn) {
    if (typeof options === 'function') {
        failFn = successFn;
        successFn = options;
        options = {};
    }
    options = options || {};
    successFn = successFn || emptyFn;
    failFn = failFn || emptyFn;

    options.srcPath = srcPath;

    cordova.exec(successFn, failFn, "Thumbnails", "thumbnail", options2Args(options));
};

window.Thumbnails = Thumbnails;

module.exports = Thumbnails;
