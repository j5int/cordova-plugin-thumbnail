#import <Foundation/Foundation.h>
#import <Cordova/CDVPlugin.h>

@interface FileUtil : NSObject

+ (NSURL *) applicationDataDirectory;

@end

@interface Thumbnail : NSObject

+ (void) thumbnail:(NSString *)imageURL size:(CGFloat)size toURL:(NSString *) toURL compression:(CGFloat)size outputFormat:(NSString *) outputFormat;

@end

@interface ThumbnailCordovaPlugin : CDVPlugin

- (void)thumbnail: (CDVInvokedUrlCommand*)command;
- (void)config: (CDVInvokedUrlCommand*)command;

@end
