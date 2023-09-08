/******************************************************************************/
//Backdrop Interaction Plugin v0.0.5
//(c) 2022 Benjamin Zachey
/******************************************************************************/

/******************************************************************************/
//BackdropTools
/******************************************************************************/
var BackdropTools = new function() {
    var MIN_RGB_VALUE = 0;
    var MAX_RGB_VALUE = 255;
    var IMAGE_SIZE = 16;

    var defaultImage = null;
    var canvas = null;
    var context = null;

    var minValue = function(min, value) {
        return value < min ? value : min;
    };
    var maxValue = function(max, value) {
        return value > max ? value : max;
    };
    var createPixel = function(r, g, b) {
        return [r, g, b];
    };
    var initPixel = function(value) {
        return createPixel(value, value, value);
    };
    var pushPixel = function(palette, r, g, b) {
        if (palette != null) {
            palette.push(createPixel(r, g, b));
        }
    };
    var minPixel = function(min, pixel) {
        if (min != null && pixel != null) {
            min[0] = minValue(min[0], pixel[0]);
            min[1] = minValue(min[1], pixel[1]);
            min[2] = minValue(min[2], pixel[2]);
        }
    };
    var maxPixel = function(max, pixel) {
        if (max != null && pixel != null) {
            max[0] = maxValue(max[0], pixel[0]);
            max[1] = maxValue(max[1], pixel[1]);
            max[2] = maxValue(max[2], pixel[2]);
        }
    };
    var addPixel = function(average, pixel) {
        if (average != null && pixel != null) {
            average[0] += pixel[0];
            average[1] += pixel[1];
            average[2] += pixel[2];
        }
    };
    var getPalette = function(imageData) {
        if (imageData != null && imageData.data != null && imageData.data.length > 0) {
            var data = imageData.data;
            var palette = [];
            for (var i = 0; i < data.length; i += 4) {
                pushPixel(palette, data[i], data[i + 1], data[i + 2]);
            }
            return palette;
        }
        return null;
    };
    var getMaxRangeIndex = function(palette) {
        if (palette != null) {
            var length = palette.length;
            var min = initPixel(MAX_RGB_VALUE);
            var max = initPixel(MIN_RGB_VALUE);
            for (var i = 0; i < length; i++) {
                minPixel(min, palette[i]);
                maxPixel(max, palette[i]);
            }
            var ranges = createPixel(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
            if (ranges[0] >= ranges[1]) {
                return ranges[0] >= ranges[2] ? 0 : 2;
            }
            return ranges[1] >= ranges[2] ? 1 : 2;
        }
        return -1;
    };
    var calculateLuminance = function(pixel) {
        //Reference: https://en.wikipedia.org/wiki/Luma_(video)
        return pixel != null ? 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2] : -1;
    };
    var orderPaletteByIndex = function(palette, index) {
        if (palette != null) {
            palette.sort(function(p1, p2) {
                return p1[index] - p2[index];
            });
        }
    };
    var orderPaletteByLuminance = function(palette) {
        if (palette != null) {
            palette.sort(function(p1, p2) {
                return calculateLuminance(p1) - calculateLuminance(p2);
            });
        }
    };
    var quantize = function(result, palette, currentDepth, maxDepth) {
        if (result != null && palette != null) {
            var length = palette.length;
            if (currentDepth >= maxDepth) {
                var average = initPixel(0);
                for (var i = 0; i < length; i++) {
                    addPixel(average, palette[i]);
                }
                pushPixel(result, ~~(average[0] / length), ~~(average[1] / length), ~~(average[2] / length));
            } else {
                var half = ~~(length / 2);
                orderPaletteByIndex(palette, getMaxRangeIndex(palette));
                quantize(result, palette.slice(0, half), currentDepth + 1, maxDepth);
                quantize(result, palette.slice(half + 1), currentDepth + 1, maxDepth);
            }
        }
    };
    var getColors = function(imageData, depth) {
        //Depth 0 -> 1 Color
        //Depth 1 -> 2 Colors
        //Depth 2 -> 4 Colors
        //Depth 3 -> 8 Colors
        //Depth 4 -> 16 Colors
        if (imageData != null) {
            var result = [];
            quantize(result, getPalette(imageData), 0, depth);
            orderPaletteByLuminance(result);
            return result;
        }
        return null;
    };
    var colorToStr = function(color, alpha) {
        if (color != null) {
            return alpha >= 0 && alpha < 1 ?
                    "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + alpha + ")" :
                    "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
        }
        return "";
    };
    var setupColors = function(container, colors) {
        if (container != null && colors != null && colors.length >= 3) {
            container.css("background",
                    "linear-gradient(15deg," + colorToStr(colors[0], 0.8) + "," + colorToStr(colors[0], 0) + " 70%)," +
                    "linear-gradient(255deg," + colorToStr(colors[1], 0.8) + "," + colorToStr(colors[1], 0) + " 70%)," +
                    "linear-gradient(135deg," + colorToStr(colors[2], 0.8) + "," + colorToStr(colors[2], 0) + " 70%)"
                    );

        }
    };
    var getImageData = function(image) {
        if (image != null) {
            //Note: We only draw a scaled down version of the image (16x16), because we only want to extract the primary colors
            if (canvas == null) {
                try {
                    canvas = document.createElement("canvas");
                    canvas.width = IMAGE_SIZE;
                    canvas.height = IMAGE_SIZE;
                    context = canvas.getContext("2d", {
                        alpha: false,
                        willReadFrequently: true
                    });
                } catch (e) {
                    TVXInteractionPlugin.error("Create canvas failed: " + e);
                    return null;
                }
            }
            if (context != null) {
                try {
                    context.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
                    context.drawImage(image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
                } catch (e) {
                    TVXInteractionPlugin.error("Draw image failed: " + e);
                    return null;
                }
                try {
                    return context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
                } catch (e) {
                    TVXInteractionPlugin.error("Get image data failed: " + e);
                    return null;
                }
            } else {
                TVXInteractionPlugin.warn("Context not available");
                return null;
            }
        }
        return null;
    };
    var setupImage = function(container, image) {
        setupColors(container, getColors(getImageData(image != null ? image.get(0) : null), 2));
    };
    this.hasImageSource = function(image) {
        return image != null && TVXTools.isHttpUrl(image.attr("src"));
    };
    this.isImageLoaded = function(image, url) {
        return image != null && TVXTools.isHttpUrl(url) && image.attr("src") == url;
    };
    this.loadImage = function(container, image, url, fallbackUrl, callback) {
        if (container != null && TVXTools.isHttpUrl(url)) {
            if (image == null) {
                if (defaultImage == null) {
                    defaultImage = $("<img crossorigin='anonymous'/>");
                }
                image = defaultImage;
            }
            if (TVXTools.isHttpUrl(fallbackUrl)) {
                TVXImageTools.setupFallback(image, fallbackUrl, function() {
                    setupImage(container, image);
                    if (typeof callback == "function") {
                        callback();
                    }
                });
            }
            TVXImageTools.loadImage(image, url, false, null, function() {
                setupImage(container, image);
                if (typeof callback == "function") {
                    callback();
                }
            });
        }
    };
};
/******************************************************************************/

/******************************************************************************/
//BackdropHandler
/******************************************************************************/
function BackdropHandler() {
    var DEFAULT_IMAGE = TVXTools.getHostUrl("img/default.png");

    var contentController = new ContentController();
    var backdropSwap = 0;
    var backdropUrl = null;
    var backdropType = -1;
    var backdropGround = null;
    var backdropContainer1 = null;
    var backdropContainer2 = null;
    var backdropImage1 = null;
    var backdropImage2 = null;

    var setupType = function(image, type) {
        if (type == 0) {
            TVXRenderer.hide(image);
        } else {
            TVXRenderer.show(image);
        }
    };
    var hideBackdrop = function() {
        TVXRenderer.fadeOut(backdropContainer1);
        TVXRenderer.fadeOut(backdropContainer2);
        TVXRenderer.fadeOut(backdropGround);
    };
    var showBackdrop = function(number, type) {
        setupType(number == 1 ? backdropImage1 : backdropImage2, type);
        TVXRenderer.fadeOut(number == 1 ? backdropContainer2 : backdropContainer1);
        TVXRenderer.fadeIn(number == 1 ? backdropContainer1 : backdropContainer2);
        TVXRenderer.fadeIn(backdropGround);
    };
    var loadBackdrop = function(number, type, url) {
        BackdropTools.loadImage(
                number == 1 ? backdropContainer1 : backdropContainer2,
                number == 1 ? backdropImage1 : backdropImage2,
                url, DEFAULT_IMAGE, function() {
                    showBackdrop(number, type);
                });
    };
    var swapBackdrop = function(url, type) {
        if ((url == "none" || TVXTools.isHttpUrl(url)) && (backdropUrl != url || backdropType != type)) {
            backdropUrl = url;
            backdropType = type;
            if (url == "none") {
                hideBackdrop();
            } else if (BackdropTools.isImageLoaded(backdropImage1, url)) {
                showBackdrop(1, type);
            } else if (BackdropTools.isImageLoaded(backdropImage2, url)) {
                showBackdrop(2, type);
            } else if (backdropSwap == 0) {
                backdropSwap = 1;
                loadBackdrop(1, type, url);
            } else {
                backdropSwap = 0;
                loadBackdrop(2, type, url);
            }
        }
    };
    this.init = function() {
        backdropContainer1 = $("#backdropContainer1");
        backdropContainer2 = $("#backdropContainer2");
        backdropImage1 = $("#backdropImage1");
        backdropImage2 = $("#backdropImage2");
        backdropGround = $("#backdropGround");
        contentController.init($(".content-wrapper"));
    };
    this.ready = function() {
        TVXInteractionPlugin.validateSettings();
        contentController.validate();
    };
    this.handleEvent = function(data) {
        TVXPluginTools.handleSettingsEvent(data);
        contentController.handleEvent(data);
    };
    this.handleData = function(data) {
        TVXInteractionPlugin.onValidatedSettings(function() {
            if (data.data != null) {
                swapBackdrop(TVXTools.strFullCheck(data.data.url, null), TVXTools.strToNum(data.data.type, 0));
            }
        });
    };
}
/******************************************************************************/

/******************************************************************************/
//Setup
/******************************************************************************/
TVXPluginTools.onReady(function() {
    TVXInteractionPlugin.setupHandler(new BackdropHandler());
    TVXInteractionPlugin.init();
});
/******************************************************************************/
