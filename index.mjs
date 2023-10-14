import fs from 'fs';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import LargeDownload from 'large-download';

const flags = {
    DOWNLOADING: "DOWNLOADING",
    DOWNLOADED: "DOWNLOADED",
    NOT_DOWNLOADED: "NOT_DOWNLOADED",
    READY: "READY",
    UNDEFINED: "UNDEFINED"
}

// TODO: rewrite this into a class
class Upscaler {
    constructor(options) {
        // first we check to see if the assests are downloded (upscaler and models). This sets the flags.
        // if they are not downloaded, we download them in the background
        // if they are downloaded, we set flags indicating that they are downloaded
        this.options = options;
        this.downloadProgressCallback = null;
        this.upscaler = {};
        this.models = {};
        this.models.status = flags.UNDEFINED;
        this.upscaler.status = flags.UNDEFINED;
        console.log('Checking for assets');
        this.checkForAssets();
        if (this.upscaler.status != flags.READY || this.models.status != flags.READY) {
            console.log('Assets not found. Downloading assets');
            this.downloadAssets().then((success) => {
                console.log('Assets downloaded');
                this.checkForAssets();
            }).catch((error) => {
                console.log('Error downloading assets');
            });
        }
    }

    checkForAssets() {
        let upscalerFound = false;
        let upscalerPath = "";

        // find upscaler
        if (fs.existsSync('./unzipped')) {
            let unzippedFolder = fs.readdirSync('./unzipped');
            let latestVersion = {};
            latestVersion.versionNo = 0;
            latestVersion.folderName = "";
            if (unzippedFolder.length !== 0) {
                unzippedFolder.forEach((file, i) => {
                    let versionNo = file.substring(file.indexOf('kan-v') + 5, file.lastIndexOf("-"));
                    let versionNoArray = versionNo.split('.');
                    let versionNoInt = 0;
                    versionNoArray.forEach((version, index) => {
                        versionNoInt += parseInt(version) * Math.pow(10, index * 3);
                    });
                    if (versionNoInt > latestVersion.versionNo) {
                        latestVersion.versionNo = versionNoInt;
                        latestVersion.folderName = file;
                    }
                });
            }
            if (latestVersion.folderName !== "") {
                let dir = `./unzipped/${latestVersion.folderName}/`;
                let files = fs.readdirSync(dir);
                let exeFile = files.find(file => file.endsWith('.exe'));
                if (exeFile !== undefined) {
                    upscalerFound = true;
                    upscalerPath = dir + exeFile;
                }
            }
            if (upscalerFound) {
                this.upscaler.status = flags.READY;
                this.upscaler.path = upscalerPath;
            } else {
                this.upscaler.status = flags.NOT_DOWNLOADED;
                this.upscaler.path = "";
            }
        } else {
            this.upscaler.status = flags.NOT_DOWNLOADED;
            this.upscaler.path = "";
        }

        // find upscale model
        let modelsFound = false;
        let modelsFolder = "";
        // chekc to make sure model folder exists
        if (fs.existsSync('./models')) {
            let modelFolder = fs.readdirSync('./models');
            if (modelFolder.length !== 0) {
                modelFolder.forEach((file, i) => {
                    let folder1 = null;
                    try {
                        folder1 = fs.readdirSync('./models/' + file);
                    } catch (e) {
                        // do nothing
                    }
                    // check to see if "file" is a .param or .bin file
                    if (file.endsWith('.param') || file.endsWith('.bin')) {
                        modelsFound = true;
                        modelsFolder = './models/';
                    } else if (folder1 !== undefined) {
                        folder1.forEach((file2, i) => {
                            let folder2 = null;
                            try {
                                folder2 = fs.readdirSync('./models/' + file + '/' + file2);
                            } catch (e) {
                                // do nothing
                            }
                            // check to see if "file" is a .param or .bin file
                            if (file2.endsWith('.param') || file2.endsWith('.bin')) {
                                modelsFound = true;
                                modelsFolder = './models/' + file + '/';
                            } else if (folder2 !== undefined) {
                                folder2.forEach((file3, i) => {
                                    // check to see if "file" is a .param or .bin file
                                    if (file3.endsWith('.param') || file3.endsWith('.bin')) {
                                        modelsFound = true;
                                        modelsFolder = './models/' + file + '/' + file2 + '/';
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
        console.log({ modelsFound });
        console.log({ modelsFolder });

        if (modelsFound) {
            this.models.status = flags.READY;
            this.models.path = modelsFolder;
        } else {
            this.models.status = flags.NOT_DOWNLOADED;
            this.models.path = "";
        }
    }

    async downloadAssets() {
        return new Promise((resolve, reject) => {
            let downloadSuceess = false;
            try {
                // checked to see if zipped folder exists
                if (!fs.existsSync('./zipped')) {
                    fs.mkdirSync('./zipped');
                }
                // checked to see if unzipped folder exists
                if (!fs.existsSync('./unzipped')) {
                    fs.mkdirSync('./unzipped');
                }
            } catch (e) {
                console.error('Error creating folders');
                resolve(false);
            }
            console.error('Upscaler is not installed. Attempting to aquire.');
            let platform = process.platform;
            if (platform === 'win32') {
                // download windows upscaler
                this.upscaler.status = flags.DOWNLOADING;
                this.downloadAndUnzip('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows.zip',
                    './zipped/realesrgan-ncnn-vulkan-v0.2.0-windows.zip', 'unzipped/').then((success) => {
                        if (success) this.upscaler.status = flags.DOWNLOADED;
                        downloadSuceess = success;
                    }).catch((error) => {
                        resolve(false);
                    }).finally(() => {
                        if (this.models.status == flags.DOWNLOADED && this.upscaler.status == flags.DOWNLOADED) {
                            // if zipped folder exists, remove it
                            try {
                                if (fs.existsSync('./zipped')) {
                                    fs.rmSync('./zipped', { recursive: true });
                                }
                            } catch (e) {
                                resolve(false);
                            }
                            resolve(true);
                        }
                    });
            } else if (platform === 'darwin') {
                // download mac upscaler
                //let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-macos.zip')
            } else if (platform === 'linux') {
                // download linux upscaler
                //let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-ubuntu.zip')
            } else {
                console.error('Platform not supported');
                resolve(false);
            }

            console.log('Downloading and unzipping models');
            this.models.status = flags.DOWNLOADING;
            this.downloadAndUnzip('https://github.com/upscayl/custom-models/archive/refs/heads/main.zip', './zipped/main.zip', 'unzipped/').then((success) => {
                if (success) {
                    //move unzipped folder to models folder
                    try {
                        // make sure the root folder exists
                        if (!fs.existsSync('./models')) {
                            fs.mkdirSync('./models');
                        }
                        // copy files from unzipped folder to models folder
                        // find the folder name
                        let unzippedModelsFolder = fs.readdirSync('./unzipped/custom-models-main/models/');
                        // check to make sure /models/custom-models-main/models/ exists
                        if (!fs.existsSync('./models/custom-models-main/')) {
                            fs.mkdirSync('./models/custom-models-main/');
                        }
                        if (!fs.existsSync('./models/custom-models-main/models/')) {
                            fs.mkdirSync('./models/custom-models-main/models/');
                        }
                        // copy files
                        let destFolder = './models/custom-models-main/models/';
                        unzippedModelsFolder.forEach((file, i) => {
                            fs.copyFileSync('./unzipped/custom-models-main/models/' + file, destFolder + file);
                        });
                        // remove extraneous files
                        fs.rmSync('./unzipped/custom-models-main/', { recursive: true });
                        downloadSuceess = true;
                        this.models.status = flags.DOWNLOADED;
                    } catch (e) {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            }).catch((error) => {
                resolve(false);
            }).finally(() => {
                if (this.models.status == flags.DOWNLOADED && this.upscaler.status == flags.DOWNLOADED) {
                    // if zipped folder exists, remove it
                    try {
                        if (fs.existsSync('./zipped')) {
                            fs.rmSync('./zipped', { recursive: true });
                        }
                    } catch (e) {
                        resolve(false);
                    }
                    resolve(true);
                }
            });
        });
    }

    setDownloadProgressCallback(callback) {
        this.downloadProgressCallback = callback;
    }

    async upscale(inputFile, outputPath = null, format = "jpg", scale = 4) {
        if (this.upscaler.status != flags.READY || this.models.status != flags.READY) {
            console.error('Upscaler is not ready');
            return false;
        }
        // check to see if inputFile exists
        if (!fs.existsSync(inputFile)) {
            console.error('File does not exist');
            return false;
        }

        // check to see if inputFile is a valid image
        if (!inputFile.endsWith('.png')) {
            console.error('File is not a valid image');
            return false;
        }

        // check to see if output path exists and create it if it doesn't
        if (outputPath === null) {
            // absolute path of input file
            let inputFolder = inputFile.substring(0, inputFile.lastIndexOf('/'));
            // set output path to be the same as input file + upscaled
            outputPath = inputFolder + '/' + "upscaled";
        }
        let outputFile = inputFile.substring(inputFile.lastIndexOf('/') + 1, inputFile.lastIndexOf('.')) + '-upscaled.' + format;
        if (!fs.existsSync(outputPath)) {
            // create output path
            fs.mkdirSync(outputPath);
        }

        if (format !== "jpg" && format !== "png") {
            console.error('Format is not supported');
            return false;
        }

        if (scale !== 2 && scale !== 3 && scale !== 4) {
            console.error('Scale is not supported');
            return false;
        }

        // run upscaler
        // resolve absolute paths
        this.upscaler.path = fs.realpathSync(this.upscaler.path);
        inputFile = fs.realpathSync(inputFile);
        outputFile = fs.realpathSync(outputPath) + '/' + outputFile;
        this.models.path = fs.realpathSync(this.models.path);
        let execString = this.upscaler.path;
        execString += " -i " + "\"" + inputFile + "\"";
        execString += " -o " + "\"" + outputFile + "\"";
        execString += " -f " + format;
        execString += " -s " + scale;
        execString += " -m " + "\"" + this.models.path + "\"";
        execString += " -n ultrasharp-2.0.1 ";
        let scaling = exec(execString, (err, stdout, stderr) => { });
        scaling.stderr.on('data', (data) => {
            // TODO: call progress callback
        });
        while (scaling.exitCode === null) {
            await this.waitSeconds(5);
        }
        if (scaling.exitCode == 0) {
            return true;
        } else {
            return false;
        }
    }

    downloadAndUnzip = (url, zipPath, extractPath) => {
        return new Promise(async (resolve, reject) => {
            let waitingForFilename = true;
            fetch(url).then((response) => {
                const contentDisposition = response.headers.get("content-disposition");
                console.log("contentDisposition: ", contentDisposition);
                if (contentDisposition) {
                    const match = /filename=([^;]+)/.exec(contentDisposition);
                    if (match) {
                        const filename = match[1];
                        console.log("File name:", filename);
                    } else {
                        console.log("No filename found in Content-Disposition header");
                    }
                } else {
                    console.log("Content-Disposition header not found in the response");
                }
            }).catch((error) => {
                console.error("Error:", error);
            }).finally(() => { waitingForFilename = false; });

            while (waitingForFilename) { await this.waitSeconds(1); }

            try {
                let downloading = true;

                const download = new LargeDownload({
                    link: url,
                    destination: zipPath,
                    timeout: 300000,
                    retries: 3,
                    onRetry: (error) => {
                        console.log("Download error. Retrying: ", error);
                    },
                    minSizeToShowProgress: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 // 1YB, effectively disables progress bar
                });

                const loadPromise = download.load();
                loadPromise.then(() => { downloading = false; }).catch(() => { downloading = false; reject(false);});

                while (downloading) {
                    await this.waitSeconds(0.5);
                    if(this.downloadProgressCallback !== null) this.downloadProgressCallback();
                }

                const zip = new AdmZip(zipPath);
                zip.extractAllTo(extractPath, true);
                resolve(true);
            } catch (error) {
                reject(false);
            }
        });
    };

    async waitSeconds(count) {
        // this holds the promise returned by the confirm function
        return await new Promise((resolve) => {
            setTimeout(() => {
                // if the user hasn't pressed enter to cancel, cancel the confirmation promise and resolve the wait promise with false
                resolve();
            }, count * 1000);
        });
    };
}

export default Upscaler;