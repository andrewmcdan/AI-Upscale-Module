# AI-Upscale-Module
This is a node.js module that uses [Real-ESRGAN ncnn Vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) to upscale images. See the Real-ESRGAN page for details on system requirements to run the up-scaler. Notably, it only works with PNG files on Vulkan capable GPUs. Currently, the module only supports Windows, but it should be possible to get it working on Linux and Mac. I just haven't done it yet. Feel free to submit a PR if you get it working.

## Usage
```javascript
import Upscaler from 'ai-upscale-module';

// param is an optional obj specifying defaults and a callback. Specify any/all/none of these.
let upscaler = new Upscaler({
    defaultOutputPath: "absolute or relative path for output",
    defaultScale: 4, // can be 2, 3, or 4
    defaultFormat: "jpg", // or "png"
    downloadProgressCallback: ()=>{}, // Callback that gets called twice per second while a download is in progress
    defaultModel: "ultrasharp-2.0.1", // Default model name 
    maxJobs: 4 // Max # of concurrent jobs
    });

let file = "path_to_file.png"; // This only works with png files


upscaler.upscale(file).then(async () => {
                // do something when the upscale is complete
            });

    ----- OR -----

// for synchronous version, if you want to wait for the write to complete or error
await upscaler.upscale(file);

    ----- OR -----

// asynchronous
upscaler.upscale(file);
```

upscale() can also take per call options for output filetype and scale.

```javascript
let outputPath = "path_to_output";

await upscaler.upscale(file, outputPath, "png", 4);
await upscaler.upscale(file, outputPath, "png", 4, "uniscale_restore"); 
// Use uniscale_restore model for this run
```

All of the other functions available in the class:
```javascript
upscaler.setDefaultModel("modelName"); 
// Sets the model that the upscaler uses by default when one is not specified otherwise. 
// If this is not called, the upscaler will use ultrasharp-2.0.1. 
// Returns: nothing

upscaler.getListOfModels(); 
// Returns: array of strings that represents all the available models

upscaler.setMaxJobs(4); 
// Set the maximum number of concurrent jobs. 
// By default, the max is 4. Set this as high as your hardware can handle.

upscaler.setDownloadProgressCallback(callback); 
// "callback" is a function that will be called about every 0.5 seconds while a download is 
// in progress. Currently does not provide progress. 

upscaler.getJobStatus(jobID); 
// jobID is returned when upscaler.upscale() resolves. This function will return a string 
// indicating the status of the job.

upscaler.getJob(jobID); 
// jobID is returned when upscaler.upscale() resolves. this function returns an object with 
// several pieces of information about the job. Use something like JSON.stringify();

upscaler.getNumberOfRunningJobs(); 
// Returns the number of currently running jobs.

upscaler.getNumberOfWaitingJobs(); 
// Returns the number of jobs waiting to run.

upscaler.upscaleJob(...); 
// Takes the same params as upscaler.upscale(). This is an async function that runs the upscale 
// immediately. You can use this function if you want to bypass the job queue altogether.
```

Making repeated calls to upscale() without await'ing it will initiate multiple instances of _Real-ESRGAN ncnn Vulkan_. If this is done too quickly, you may overload you system. Just be cautious. 


## How it works
As mentioned above, this module depends on [Real-ESRGAN ncnn Vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) along with (at least) one of the models available from [Upscayl's](https://github.com/upscayl/upscayl) [custom models](https://github.com/upscayl/custom-models/). You could download all the resources yourself, but it's easier to let the module do the work for you. 

The first time you run the module (like the first time on in that particular working directory), it will check for resources and download whats needed. The models are about 300MB, so that could take a minute or two on slower connections, and unfortunately there's no progress indicator. So, you'll just have to wait for it to finish.

Once it gets everything downloaded and unzipped, it will be ready to upscale images for. 

The default model that it uses was selected because it looks quite good when working with images from Midjourney. It is quite possible to modify this code so that it uses a different model. There are several in the models folder that gets downloaded. 

## Version History
### V1.1.0
- Rewrote upscale(). Upscale jobs now queue and a maximum number of concurrent jobs can be set so that you don't overload your system. There's also some related functions for getting job status.
- Added capability to get list of available models and to set a default. Each job can also be run with a specific model.
- Moved some functions out of the class.
- Probably added some bugs. Whoops.
### V1.0.0
- Initial release. 

## Contributing
If you want to contribute, feel free to submit a PR. I'm not a node.js developer, so I'm sure there are things that could be done better. Also, please feel free to submit issues if you find bugs or have suggestions. Mac and Linux support would be great. These should be easy to add, but I don't have a Mac and I don't have a Linux machine with a Vulkan capable GPU. 

## Disclaimer
I make no warrantees or guarantees about this software. I can't be sure that this implementation doesn't violate the terms of use or license for Real-ESRGAN or Upscayl. Use at your own risk.

## License
GPL, I guess. Just don't steal it and do something stupid with it. If you use my code, link back to me somehow, please.
