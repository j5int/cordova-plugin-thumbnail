/* global Windows, WinJS, MSApp */

var utils = require('cordova/utils');

var getFolderFromPathAsync = Windows.Storage.StorageFolder.getFolderFromPathAsync;
var getFileFromPathAsync = Windows.Storage.StorageFile.getFileFromPathAsync;


function cordovaPathToNative(path) {
    // turn / into \\
    var cleanPath = path.replace(/\//g, '\\');
    // turn  \\ into \
    cleanPath = cleanPath.replace(/\\+/g, '\\');
    return cleanPath;
}

function nativePathToCordova(path) {
    var cleanPath = path.replace(/\\/g, '/');
    return cleanPath;
}

var driveRE = new RegExp("^[/]*([A-Z]:)");

var WinFS = function (name, root) {
    this.winpath = root.winpath;
    if (this.winpath && !/\/$/.test(this.winpath)) {
        this.winpath += '/';
    }
    this.makeNativeURL = function (path) {
        // CB-11848: This RE supposed to match all leading slashes in sanitized path.
        // Removing leading slash to avoid duplicating because this.root.nativeURL already has trailing slash
        var regLeadingSlashes = /^\/*/;
        var sanitizedPath = sanitize(path.replace(':', '%3A')).replace(regLeadingSlashes, '');
        return FileSystem.encodeURIPath(this.root.nativeURL + sanitizedPath);
    };
    root.fullPath = '/';
    if (!root.nativeURL) {
        root.nativeURL = 'file://' + sanitize(this.winpath + root.fullPath).replace(':', '%3A');
    }
    WinFS.__super__.constructor.call(this, name, root);
};

utils.extend(WinFS, FileSystem);

WinFS.prototype.__format__ = function (fullPath) {
    var path = sanitize('/' + this.name + (fullPath[0] === '/' ? '' : '/') + FileSystem.encodeURIPath(fullPath));
    return 'cdvfile://localhost' + path;
};

var windowsPaths = {
    dataDirectory: 'ms-appdata:///local/',
    cacheDirectory: 'ms-appdata:///temp/',
    tempDirectory: 'ms-appdata:///temp/',
    syncedDataDirectory: 'ms-appdata:///roaming/',
    applicationDirectory: 'ms-appx:///',
    applicationStorageDirectory: 'ms-appx:///'
};

var AllFileSystems;

function getAllFS() {
    if (!AllFileSystems) {
        AllFileSystems = {
            'persistent':
                Object.freeze(new WinFS('persistent', {
                    name: 'persistent',
                    nativeURL: 'ms-appdata:///local',
                    winpath: nativePathToCordova(Windows.Storage.ApplicationData.current.localFolder.path)
                })),
            'temporary':
                Object.freeze(new WinFS('temporary', {
                    name: 'temporary',
                    nativeURL: 'ms-appdata:///temp',
                    winpath: nativePathToCordova(Windows.Storage.ApplicationData.current.temporaryFolder.path)
                })),
            'application':
                Object.freeze(new WinFS('application', {
                    name: 'application',
                    nativeURL: 'ms-appx:///',
                    winpath: nativePathToCordova(Windows.ApplicationModel.Package.current.installedLocation.path)
                })),
            'root':
                Object.freeze(new WinFS('root', {
                    name: 'root',
                    // nativeURL: 'file:///'
                    winpath: ''
                }))
        };
    }
    return AllFileSystems;
}

function sanitize(path) {
    var slashesRE = new RegExp('/{2,}', 'g');
    var components = path.replace(slashesRE, '/').split(/\/+/);
    // Remove double dots, use old school array iteration instead of RegExp
    // since it is impossible to debug them
    for (var index = 0; index < components.length; ++index) {
        if (components[index] === "..") {
            components.splice(index, 1);
            if (index > 0) {
                // if we're not in the start of array then remove preceeding path component,
                // In case if relative path points above the root directory, just ignore double dots
                // See file.spec.111 should not traverse above above the root directory for test case
                components.splice(index - 1, 1);
                --index;
            }
        }
    }
    return components.join('/');
}

function getFilesystemFromPath(path) {
    var res;
    var allfs = getAllFS();
    Object.keys(allfs).some(function (fsn) {
        var fs = allfs[fsn];
        if (path.indexOf(fs.winpath) === 0) {
            res = fs;
        }
        return res;
    });
    return res;
}


var msapplhRE = new RegExp('^ms-appdata://localhost/');

function pathFromURL(url) {
    url = url.replace(msapplhRE, 'ms-appdata:///');
    var path = decodeURIComponent(url);
    // support for file name with parameters
    if (/\?/g.test(path)) {
        path = String(path).split("?")[0];
    }
    if (path.indexOf("file:/") === 0) {
        if (path.indexOf("file://") !== 0) {
            url = "file:///" + url.substr(6);
        }
    }

    ['file://', 'ms-appdata:///', 'cdvfile://localhost/'].every(function (p) {
        if (path.indexOf(p) !== 0)
            return true;
        var thirdSlash = path.indexOf("/", p.length);
        if (thirdSlash < 0) {
            path = "";
        } else {
            path = sanitize(path.substr(thirdSlash));
        }
    });

    return path.replace(driveRE, '$1');
}

function getFilesystemFromURL(url) {
    url = url.replace(msapplhRE, 'ms-appdata:///');
    var res;
    if (url.indexOf('file:/') === 0) {
        res = getFilesystemFromPath(pathFromURL(url));
    } else {
        var allfs = getAllFS();
        Object.keys(allfs).every(function (fsn) {
            var fs = allfs[fsn];
            if (url.indexOf(fs.root.nativeURL) === 0 ||
                url.indexOf('cdvfile://localhost/' + fs.name + '/') === 0) {
                res = fs;
                return false;
            }
            return true;
        });
    }
    return res;
}

function writeBlobAsync(storageFile, data, position) {
    return storageFile.openAsync(Windows.Storage.FileAccessMode.readWrite)
        .then(function (output) {
            output.seek(position);
            var dataSize = data.size;
            var input = (data.detachStream || data.msDetachStream).call(data);

            // Copy the stream from the blob to the File stream
            return Windows.Storage.Streams.RandomAccessStream.copyAsync(input, output)
                .then(function () {
                    output.size = position + dataSize;
                    return output.flushAsync().then(function () {
                        input.close();
                        output.close();

                        return dataSize;
                    });
                });
        });
}

function writeArrayBufferAsync(storageFile, data, position) {
    return writeBlobAsync(storageFile, new Blob([data]), position); // eslint-disable-line no-undef
}

function makeThumbnail(win, fail, args) {
    var srcPath, targetPath, maxPixelSize, compression, outputFormat;
    if (args.length === 4) {
        srcPath = args[0];
        maxPixelSize = args[1];
        compression = args[2];
        outputFormat = args[3];
    } else {
        srcPath = args[0];
        targetPath = args[1];
        maxPixelSize = args[2];
        compression = args[3];
        outputFormat = args[4];
    }
    var thumbnailMode = Windows.Storage.FileProperties.ThumbnailMode.singleItem;
    var thumbnailOptions = Windows.Storage.FileProperties.ThumbnailOptions.resizeThumbnail;
    var sourceFs = getFilesystemFromURL(srcPath);
    var sourcePath = pathFromURL(srcPath);
    if (!sourceFs) {
        fail({code: 3, message: "File access error"});
        return;
    }
    var wSourcePath = cordovaPathToNative(sanitize(sourceFs.winpath + sourcePath));

    var targetFs = getFilesystemFromURL(targetPath);
    var path = pathFromURL(targetPath);
    if (!targetFs) {
        fail({code: 3, message: "File access error"});
        return;
    }
    var completeTargetPath = sanitize(targetFs.winpath + path);
    var targetFileName = completeTargetPath.substring(completeTargetPath.lastIndexOf('/') + 1);
    var targetDirpath = completeTargetPath.substring(0, completeTargetPath.lastIndexOf('/'));
    var wTargetDirPath = cordovaPathToNative(targetDirpath);

    getFileFromPathAsync(wSourcePath).then(
        function (storageFile) {
            storageFile.getThumbnailAsync(thumbnailMode, maxPixelSize, thumbnailOptions).done(function (thumbnail) {
                if (thumbnail) {
                    var readSize = thumbnail.size;
                    var buffer = new Windows.Storage.Streams.Buffer(readSize);
                    var options = Windows.Storage.Streams.InputStreamOptions.None;
                    thumbnail.readAsync(buffer, readSize, options).done(
                        function (buffer) {
                            getFolderFromPathAsync(wTargetDirPath).done(
                                function (targetFolder) {
                                    targetFolder.createFileAsync(targetFileName, Windows.Storage.CreationCollisionOption.openIfExists).done(
                                        function (targetFile) {
                                            var myArray = new Uint8Array(buffer.length);

                                            var dataReader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                                            dataReader.readBytes(myArray)
                                            dataReader.close();
                                            writeArrayBufferAsync(targetFile, myArray.buffer, 0).done(
                                                function (bytesWritten) {
                                                    win(targetPath);
                                                },
                                                function () {
                                                    fail({code: 5, message: "Failed to write out thumbnail to target path."});
                                                }
                                            );
                                        }
                                    )
                                }
                            )
                        }
                    )
                } else {
                    fail({code: 4, message: "Failed to create thumbnail."});
                }
            }, function (error) {
                fail({code: 4, message: "Failed to create thumbnail."});
            });
        }, function () {
            fail({code: 2, message: "File not found"});
        }
    );
}


module.exports = {

    thumbnail: function (win, fail, args) {
        makeThumbnail(win, fail, args);
    },
};

require("cordova/exec/proxy").add("Thumbnails", module.exports);
