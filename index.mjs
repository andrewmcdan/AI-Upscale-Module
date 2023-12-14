// TODO: 
// 1. Add support for mac and linux
//   - d̶o̶w̶n̶l̶o̶a̶d̶ t̶h̶e̶ c̶o̶r̶r̶e̶c̶t̶ z̶i̶p̶ f̶i̶l̶e̶  (done, I think)
//   - figure out how to run the upscaler



// Need to rewrite part of this to support custom version of upscaler that runs continuously and takes new jobs from stdin
// It will also need to ge the custom version of the upscaler from github/andrewmcdan

import fs from 'fs';
import AdmZip from 'adm-zip';
import { spawn } from 'child_process';
import LargeDownload from 'large-download';
import { stdout } from 'process';

const flags = {
    DOWNLOADING: "DOWNLOADING",
    DOWNLOADED: "DOWNLOADED",
    NOT_DOWNLOADED: "NOT_DOWNLOADED",
    READY: "READY",
    UNDEFINED: "UNDEFINED"
}

const modelsFileSize = 319059498;

let upscaleJobID = 0;
let execJobsCount = 0;
let downloadProgressCallback = null;

class Upscaler {
    static loggerFunction = null;
    constructor(options) {
        this.nextToProcess = [];
        // first we check to see if the assets are downloaded (upscaler and models). This sets the flags.
        // if they are not downloaded, we download them in the background
        if (options == undefined || options == null) {
            options = {};
        }
        if (options.defaultScale == undefined || options.defaultScale == null) {
            options.defaultScale = 4;
        }
        if (options.defaultFormat == undefined || options.defaultFormat == null) {
            options.defaultFormat = "jpg";
        } else if (options.defaultFormat !== "jpg" && options.defaultFormat !== "png") {
            options.defaultFormat = "jpg";
        }
        if (options.defaultOutputPath == undefined || options.defaultOutputPath == null) {
            options.defaultOutputPath = "./output/upscaled/";
        }
        if (options.downloadProgressCallback === undefined || options.downloadProgressCallback === null) {
            options.downloadProgressCallback = null;
        }
        if (options.maxJobs === undefined || options.maxJobs === null) {
            options.maxJobs = 4;
        }
        if (options.defaultModel === undefined || options.defaultModel === null) {
            options.defaultModel = "ultrasharp-2.0.1";
        }
        if (typeof options.logger === 'function') {
            Upscaler.loggerFunction = options.logger;
        } else {
            Upscaler.loggerFunction = (...args) => { console.log(...args) };
        }

        this.options = options;
        downloadProgressCallback = options.downloadProgressCallback;
        this.upscaler = {};
        this.models = {};
        this.models.status = flags.UNDEFINED;
        this.upscaler.status = flags.UNDEFINED;
        this.maxJobs = options.maxJobs;
        this.defaultModel = options.defaultModel;
        Upscaler.log('Checking for assets');
        this.status = "Checking for assets";
        this.checkForAssets();
        if (this.upscaler.status != flags.READY || this.models.status != flags.READY) {
            Upscaler.log('Assets not found. Downloading assets');
            this.status = "Assets not found. Downloading assets";
            this.downloadAssets().then((success) => {
                Upscaler.log('Assets downloaded');
                this.checkForAssets();
                this.status = "Assets downloaded, Upscaler ready";
            }).catch((error) => {
                Upscaler.log('Error downloading assets');
                this.status = "Error downloading assets";
            });
        }
        this.upscaleJobs = [];
        this.upscaleJobsRunningCount = 0;
        this.finishedJobs = [];
        this.jobRunner = null;
        this.execJobs = [];
        if (this.upscaler.status == flags.READY && this.models.status == flags.READY) {
            this.status = flags.READY;
        }
        this.scalerExec = null;
        this.scalingsInprogress = 0;

        this.executableManager = null;

    }

    static log(...args) {
        if (Upscaler.loggerFunction !== null) Upscaler.loggerFunction(...args);
    }

    setDefaultModel(modelName) {
        this.defaultModel = modelName;
    }

    getListOfModels() {
        if (!this.models.status == flags.READY) return [];
        let models = [];
        let modelFolder = fs.readdirSync(this.models.path);
        if (modelFolder.length !== 0) {
            modelFolder.forEach((file, i) => {
                let folder1 = null;
                try {
                    folder1 = fs.readdirSync(this.models.path + file);
                } catch (e) { } // do nothing
                // check to see if "file" is a .param or .bin file
                if (file.endsWith('.bin')) {
                    models.push(file.substring(0, file.lastIndexOf('.')));
                } else if (folder1 !== undefined && folder1 !== null) { // go one more folder deep
                    folder1.forEach((file2, i) => {
                        let folder2 = null;
                        try {
                            folder2 = fs.readdirSync(this.models.path + file + '/' + file2);
                        } catch (e) { } // do nothing
                        // check to see if "file" is a .param or .bin file
                        if (file2.endsWith('.bin')) {
                            models.push(file2.substring(0, file2.lastIndexOf('.')));
                        }
                    });
                }
            });
        }
        return models;
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
                    let versionNo = file.substring(file.indexOf('vulkan-') + 7, file.lastIndexOf("-"));
                    let versionNoArray = versionNo.split('.');
                    let versionNoInt = 0;
                    console.log(versionNo, versionNoArray);
                    versionNoInt = parseInt(versionNoArray[0] * Math.pow(10, 3) + versionNoArray[1] * Math.pow(10, 0));
                    if (versionNoInt > latestVersion.versionNo) {
                        latestVersion.versionNo = versionNoInt;
                        latestVersion.folderName = file;
                    }
                });
            }
            if (latestVersion.folderName !== "") {
                let dir = `./unzipped/${latestVersion.folderName}/`;
                let files = fs.readdirSync(dir);
                let executable = files.find(file => file.includes('realesrgan-ncnn-vulkan'));
                if (executable !== undefined) {
                    upscalerFound = true;
                    upscalerPath = dir + executable;
                }
                // check for platform is linux
                if (process.platform === 'linux') {
                    // make sure executable is executable
                    fs.chmodSync(upscalerPath, 0o755);
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

        if (this.upscaler.status == flags.NOT_DOWNLOADED) {
            Upscaler.log('Upscaler is not installed. Will attempt to acquire in background.');
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

        if (modelsFound) {
            this.models.status = flags.READY;
            this.models.path = modelsFolder;
        } else {
            this.models.status = flags.NOT_DOWNLOADED;
            this.models.path = "";
            Upscaler.log('Models not found. Will attempt to acquire in background.');
        }
    }

    removeZipFolder() {
        // if zipped folder exists, remove it
        let success = false;
        try {
            if (fs.existsSync('./zipped')) {
                fs.rmSync('./zipped', { recursive: true });
            }
            // return true if successful or no zipped folder exists
            success = true;
        } catch (e) {
            console.error('Error removing zipped folder');
        }
        return success;
    }

    async downloadAssets() {
        return new Promise(async (resolve, reject) => {
            // const owner = 'upscayl';
            const owner = 'andrewmcdan';
            const repo = 'upscayl-ncnn';
            let downloadSuccess = false;

            // create some folders
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

            // get platform name (windows, mac, linux) and set asset name
            let platform = process.platform;
            let assetName = "";
            if (platform === 'win32') assetName = 'windows.zip';
            else if (platform === 'darwin') assetName = 'macos.zip';
            else if (platform === 'linux') assetName = 'ubuntu.zip';
            else {
                console.error('Platform not supported');
                resolve(false);
            }

            // download windows upscaler
            this.upscaler.status = flags.DOWNLOADING;

            let tagName = await getLatestReleaseVersion(owner, repo);
            let dlLink = await getReleaseDownloadLink(owner, repo, tagName, assetName);

            downloadAndUnzip(dlLink, './zipped/realesrgan-ncnn-vulkan-' + tagName + '-' + assetName, 'unzipped/').then((success) => {
                if (success) this.upscaler.status = flags.DOWNLOADED;
                downloadSuccess = success;
            }).catch((error) => {
                resolve(false);
            }).finally(() => {
                if (this.models.status == flags.DOWNLOADED && this.upscaler.status == flags.DOWNLOADED) {
                    resolve(this.removeZipFolder());
                }
            });


            if (this.models.status != flags.READY && this.models.status != flags.DOWNLOADED) {
                this.models.status = flags.DOWNLOADING;
                downloadAndUnzip('https://github.com/upscayl/custom-models/archive/refs/heads/main.zip', './zipped/main.zip', 'unzipped/').then((success) => {
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
                            downloadSuccess = true;
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
                        resolve(this.removeZipFolder());
                    }
                });
            }
        });
    }

    setMaxJobs(maxJobs) {
        this.maxJobs = maxJobs;
    }

    setDownloadProgressCallback(callback) {
        downloadProgressCallback = callback;
    }

    async upscale(inputFile, outputPath = null, format = "", scale = -1, modelName = null) {
        return new Promise(async (resolve, reject) => {
            if (this.executableManager === null) {
                this.upscaler.path = fs.realpathSync(this.upscaler.path);
                this.models.path = fs.realpathSync(this.models.path);
                if (this.models.path === undefined || this.models.path === null || this.models.path === "") {
                    reject("Models not found");
                    return;
                }
                if (this.upscaler.path === undefined || this.upscaler.path === null || this.upscaler.path === "") {
                    reject("Upscaler not found");
                    return;
                }
                this.executableManager = new UpscaleExecutableManager(this.upscaler.path, this.models.path, modelName, scale, format);
            }
            let job = {};
            job.inputFile = inputFile;
            job.outputPath = outputPath;
            job.format = format;
            job.scale = scale;
            job.status = "waiting";
            if (modelName !== null) job.modelName = modelName;
            else job.modelName = this.defaultModel;
            job.id = upscaleJobID++;
            this.upscaleJobs.push(job);
            if (this.jobRunner == null || this.jobRunner == undefined) this.jobRunner = this.processJobs();
            resolve(job.id);
        });
    }

    async getJobStatus(jobID) {
        return new Promise(async (resolve, reject) => {
            let job = this.upscaleJobs.find(job => job.id === jobID);

            if (job == undefined) {
                job = this.finishedJobs.find(job => job.id === jobID);
                if (job == undefined)
                    resolve("not found");
                else
                    resolve(job.status);
            } else {
                resolve(job.status);
            }
        });
    }

    getJob(jobID) {
        let job = this.upscaleJobs.find(job => job.id === jobID);
        if (job == undefined) {
            job = this.finishedJobs.find(job => job.id === jobID);
            if (job == undefined)
                return null;
            else
                return job;
        } else {
            return job;
        }
    }

    cancelJob(jobID) {
        let job = this.upscaleJobs.find(job => job.id === jobID);
        if (job == undefined) {
            job = this.finishedJobs.find(job => job.id === jobID);
            if (job == undefined)
                return false;
            else
                return true;
        } else {
            job.status = "cancelled";
            return true;
        }
    }

    getNumberOfRunningJobs() {
        return this.upscaleJobsRunningCount;
    }

    getNumberOfWaitingJobs() {
        return this.upscaleJobs.length;
    }

    processJobs() {
        return new Promise(async (resolve, reject) => {
            let waiter = [];
            while (this.upscaleJobs.length > 0 && this.upscaleJobsRunningCount < this.maxJobs) {
                this.upscaleJobsRunningCount++;
                let job = this.upscaleJobs.shift();
                if (job.status == "cancelled") continue;
                job.status = "processing";
                waiter.push(this.upscaleJob(job.inputFile, job.outputPath, job.format, job.scale, job.modelName).then((success) => {
                    if (success) {
                        job.status = "complete";
                    } else {
                        job.status = "failed";
                    }
                }).catch((error) => {
                    job.status = "failed";
                    console.error(error);
                }).finally(() => {
                    this.upscaleJobsRunningCount--;
                    this.finishedJobs.push(job);
                }));
            }
            Promise.all(waiter).then((obj) => {
                if (this.upscaleJobs.length > 0) this.jobRunner = this.processJobs();
                else this.jobRunner = null;
                resolve();
            });

        });
    }

    // TODO: rewrite so that if the executable is already running, it doesn't start a new one.
    // This will be in support of the new continuous upscaler that takes jobs from stdin
    async upscaleJob(inputFile, outputPath) {
        // Upscaler.log("Upscaling: ", inputFile);
        if (outputPath === null) outputPath = this.options.defaultOutputPath;
        return new Promise(async (resolve, reject) => {
            Upscaler.log({ inputFile }, { outputPath });
            if (this.upscaler.status != flags.READY || this.models.status != flags.READY) {
                Upscaler.log('Upscaler is not ready');
                reject('Upscaler is not ready');
                return;
            }
            if (inputFile == undefined || inputFile == null) {
                Upscaler.log('Input file is undefined or null');
                reject('Input file is undefined or null');
                return;
            }
            // check to see if inputFile exists
            if (!fs.existsSync(inputFile)) {
                Upscaler.log('File does not exist');
                reject('File does not exist');
                return;
            }

            // check to see if inputFile is a valid image
            if (!inputFile.endsWith('.png')) {
                Upscaler.log('File is not a valid image');
                reject('File is not a valid image');
                return;
            }

            let outputFile = inputFile.substring(inputFile.lastIndexOf('/') + 1, inputFile.lastIndexOf('.')) + '-upscaled.' + format;

            try {
                if (!fs.existsSync(outputPath)) {
                    // create output path
                    fs.mkdirSync(outputPath);
                }
            } catch (e) {
                Upscaler.log(e);
                reject(e);
                return;
            }

            inputFile = fs.realpathSync(inputFile);
            if (outputFile.includes('\\\\')) outputFile = fs.realpathSync(outputPath) + '\\\\' + outputFile;
            else outputFile = fs.realpathSync(outputPath) + '/' + outputFile;

            let waitCount = 0;
            while (!this.executableManager.ready) {
                await waitSeconds(1);
                waitCount++;
                if (waitCount > 120) {
                    Upscaler.log("Timeout waiting for upscaler to startup");
                    reject("Timeout waiting for upscaler to startup");
                    return;
                }
            }

            this.executableManager.addJob(inputFile, outputFile);

            waitCount = 0;
            while (this.executableManager.getNumberOfRunningJobs() > 0) {
                await waitSeconds(1);
                waitCount++;
                if (waitCount > 120) {
                    Upscaler.log("Timeout waiting for upscaler to finish");
                    reject("Timeout waiting for upscaler to finish");
                    return;
                }
            }
            resolve(true);
        });
    }

}

class UpscaleExecutableManager {
    constructor(execPath, modelsPath, modelName, scale, format) {
        this.execPath = execPath;
        this.modelsPath = modelsPath;
        this.modelName = modelName;
        this.scale = scale;
        this.format = format;
        this.exec = null;
        this.nextToProcess = [];
        this.scalingsInprogress = 0;
        this.ready = false;

        this.startScaler();
    }

    startScaler() {
        this.exec = spawn(this.execPath, ["-f", this.format, "-s", this.scale, "-m", this.modelsPath, "-n", this.modelName, "-j", "1:2:1", "-c"], { shell: true });
        this.exec.stdout.on('data', this.scalerStdoutListener);
        this.exec.stderr.on('data', this.scalerStderrListener);
        this.exec.on('close', this.scalerCloseListener);
    }

    scalerStdoutListener(data) {
        Upscaler.log(`Upscaler stdout: ${data}`);
        this.processDataFromExec(data);
    }

    scalerStderrListener(data) {
        Upscaler.log(`Upscaler stderr: ${data}`);
        this.processDataFromExec(data);
    }

    scalerCloseListener(code) {
        Upscaler.log(`Upscaler process exited with code ${code}`);
        this.exec = null;
    }

    processDataFromExec(data) {
        if (data.includes("main routine")) {
            this.ready = true;
        } else if (data.includes("Upscayl Successful")) {
            this.scalingsInprogress--;
        }
        this.processNextJobs();
    }

    addJob(inputFile, outputFile) {
        if (this.exec === null) return false;
        if (!this.ready) return false;
        inputFile = fs.realpathSync(inputFile);
        if (outputFile.includes('\\\\')) outputFile = fs.realpathSync(outputPath) + '\\\\' + outputFile;
        else outputFile = fs.realpathSync(outputPath) + '/' + outputFile;
        this.nextToProcess.push({ inputFile, outputFile });
        return true;
    }

    processNextJobs() {
        if (this.exec === null) return false;
        if (!this.ready) return false;
        if (this.nextToProcess.length == 0) return false;
        if (this.scalingsInprogress != 0) return false;
        let jobsString = "";
        this.nextToProcess.forEach((job, i) => {
            this.scalingsInprogress++;
            jobsString += job.inputFile + ":" + job.outputFile + (i < this.nextToProcess.length - 1 ? ";" : "");
        });
        this.nextToProcess = [];
        console.log("jobsString: ", jobsString);
        this.exec.stdin.write(jobsString + "\n");
        return true;
    }

    getNumberOfRunningJobs() {
        return this.scalingsInprogress;
    }

    async stopScaler() {
        if (this.exec === null) return false;
        this.ready = false;
        this.exec.stdin.write("exit\n");
        await waitSeconds(1);
        this.exec.kill();
        this.exec = null;
        spawn('taskkill', ['/pid', this.exec.pid, '/f', '/t']);
        spawn('killall', ['realesrgan-ncnn']);
        return true;
    }
}


const downloadAndUnzip = (url, zipPath, extractPath) => {
    return new Promise(async (resolve, reject) => {
        let waitingForFilename = true;
        let modelsFile = false;
        fetch(url).then((response) => {
            const contentDisposition = response.headers.get("content-disposition");
            // console.log("contentDisposition: ", contentDisposition);
            if (contentDisposition.indexOf("custom-models-main.zip") != -1) {
                modelsFile = true;
            }
            if (contentDisposition) {
                const match = /filename=([^;]+)/.exec(contentDisposition);
                if (match) {
                    const filename = match[1];
                    // console.log("File name:", filename);
                } else {
                    // console.log("No filename found in Content-Disposition header");
                }
            } else {
                // console.log("Content-Disposition header not found in the response");
            }
        }).catch((error) => {
            console.error("Error:", error);
        }).finally(() => { waitingForFilename = false; });

        while (waitingForFilename) { await waitSeconds(1); }

        try {
            let downloading = true;
            let downloadTotal = modelsFile ? modelsFileSize : 0;

            const download = new LargeDownload({
                link: url,
                destination: zipPath,
                timeout: 300000,
                retries: 3,
                onRetry: (error) => {
                    console.log("Download error. Retrying: ", { error }, { url }, { zipPath }, { extractPath });
                },
                onData: (downloaded, total) => {
                    // console.log( {downloaded}, {total});
                    downloadTotal = modelsFile ? modelsFileSize : parseInt(total);
                    if (!isNaN(downloadTotal)) {
                        // convert to MB and truncate to 2 decimal places
                        downloadTotal = (downloadTotal / 1000000).toFixed(2);
                        downloaded = (downloaded / 1000000).toFixed(2);
                        console.log("Download progress: ", (downloaded / downloadTotal).toFixed(2) * 100 + "%");
                    }
                },
                minSizeToShowProgress: Infinity
            });

            download.load().then(() => {
                downloading = false;
                download.onRetry = null;
            }).catch(() => {
                downloading = false;
                download.onRetry = null;
                reject(false);
            });

            while (downloading) {
                await waitSeconds(0.5);
                if (downloadProgressCallback !== undefined) if (downloadProgressCallback !== null) downloadProgressCallback();
            }
            console.log("Download complete");
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);
            resolve(true);
        } catch (error) {
            console.error("Error: ", { error });
            reject(false);
        }
    });
};

async function waitSeconds(count) {
    // this holds the promise returned by the confirm function
    return await new Promise((resolve) => {
        setTimeout(() => {
            // if the user hasn't pressed enter to cancel, cancel the confirmation promise and resolve the wait promise with false
            resolve();
        }, count * 1000);
    });
};

async function getLatestReleaseVersion(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
        const data = await response.json();
        return data.tag_name;
    } catch (error) {
        // console.error('Error:', error);
        return null;
    }
}

async function getReleaseDownloadLink(owner, repo, tagName, assetName) {
    try {
        // Get the release by tag name
        const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`);
        const releaseData = await releaseResponse.json();
        // console.log("////////////////////////////////////////////");
        // console.log(releaseData);
        // Find the asset with the given name
        let asset = false;
        releaseData.assets.forEach((a) => {
            // console.log(a.name);
            if (a.name.lastIndexOf(assetName) != -1) {
                // console.log("found");
                asset = a;
                // console.log(a.browser_download_url);
            }
        });

        if (asset) {
            // Return the download URL for the asset
            return asset.browser_download_url;
        } else {
            // console.log(`Asset "${assetName}" not found in the release.`);
            return null;
        }
    } catch (error) {
        return null;
    }
}

export default Upscaler;