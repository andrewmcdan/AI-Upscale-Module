# AI-Upscale-Module
This is a node.js module that uses [Real-ESRGAN ncnn Vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) to upscale images. See the Real-ESRGAN page for details on system requirements to run the upscaler.

## Usage
```javascript
import Upscaler from 'ai-upscale-module';

// param is an optional obj specifying defaults and a callback
let upscaler = new Upscaler({
    defaultOutputPath: "absolute or relative path for output",
    defaultScale: 4, // can be 2, 3, or 4
    defaultFormat: "jpg", // or "png"
    downloadProgressCallback: ()=>{} // "callback that get called twice per second while a download is in progress"
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

```javascript
await upscaler.upscale(file, outputPath, "png", 4);
```

## How it works
As mentioned above, this module depends on [Real-ESRGAN ncnn Vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) along with (at least) one of the models available from (Upscayl's)[https://github.com/upscayl/upscayl] (custom models)[https://github.com/upscayl/custom-models/]. You could download all the resources yourself, but it's easier to let the module do the work for you. 

The first time you run the module (like the first time on in that particular working directory), it will check for resources and download whats needed. The models are about 300MB, so that could take a minute or two on slower connetions, and unfortunately there's no progress indicator. So, you'll just have to wait for it to finish.

Once it gets everything downloaded and unzipped, it will be ready to upscale images for. 

The default model that it uses was selected because it looks quite good when working with images from Midjourney. It is quite possible to modify this code so that it uses a different model. There are several in the models folder that gets downloaded. 

## Disclaimer
I make no warantees or guarantees about this software. I can't be sure that this implementation doesn't violate the terms of use or license for Real-ESRGAN or Upscayl. Use at your own risk.

## License
GPL, I guess. Just don't steal it and do something stupid with it. If you use my code, link back to me somehow, please.