# AI-Upscale-Module
This is a node.js module that uses [Real-ESRGAN ncnn Vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) to upscale images. Currently at, like a beta version? ...maybe? Well, it seems to work anyways. 
See the Real-ESRGAN page for details on system requirements to run the upscaler.

## Usage
```
import Upscaler from 'ai-upscale-module';

let upscaler = new Upscaler({
    defaultOutputPath: [ absolute or relative path for output ],
    defaultScale: [ 2, 3, or 4 ],
    defaultFormat: [ jpg or png ],
    downloadProgressCallback: [ callback that get called twice per second while a download is in progress ]
    });

let file = "path_to_file.png";
let outputPath = "path_to_output";


upscaler.upscale(file, outputPath).then(async () => {
                // do something when the upscale is complete
            });

    ----- OR -----

// for synchronous version, if you want to wait for the write to complete or error
await upscaler.upscale(file, outputPath);

    ----- OR -----

// asynchronous
upscaler.upscale(file, outputPath);
```

upscale() can also take per call options for output filetype and scale.

```
await upscaler.upscale(file, outputPath, "png", 4);
```