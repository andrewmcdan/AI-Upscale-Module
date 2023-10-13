import fs from 'fs';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { exec, execFile, execSync } from 'child_process';
import { stdout } from 'process';

const upscale = async (inputFile, outputPath = null, format = "jpg", scale = 4) => {
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

    if(format !== "jpg" && format !== "png") {
        console.error('Format is not supported');
        return false;
    }

    if(scale !== 2 && scale !== 3 && scale !== 4) {
        console.error('Scale is not supported');
        return false;
    }


    let upscalerFound = false;
    let upscalerPath = "";

    // find upscaler
    if(fs.existsSync('./unzipped')) {
        let unzippedFolder = fs.readdirSync('./unzipped');
        let latestVersion = {};
        latestVersion.versionNo = 0;
        latestVersion.folderName = "";
        if(unzippedFolder.length !== 0) {
            unzippedFolder.forEach((file,i) => {
                let versionNo = file.substring(file.indexOf('kan-v') + 5,file.lastIndexOf("-"));
                let versionNoArray = versionNo.split('.');
                let versionNoInt = 0;
                versionNoArray.forEach((version,index) => {
                    versionNoInt += parseInt(version) * Math.pow(10 , index * 3);
                });
                if(versionNoInt > latestVersion.versionNo) {
                    latestVersion.versionNo = versionNoInt;
                    latestVersion.folderName = file;
                }
            });
        }
        if(latestVersion.folderName !== "") {
            let dir = `./unzipped/${latestVersion.folderName}/`;
            let files = fs.readdirSync(dir);
            let exeFile = files.find(file => file.endsWith('.exe'));
            if(exeFile !== undefined) {
                upscalerFound = true;
                upscalerPath = dir + exeFile;
            }
        }
    }

    // find upscale model
    let modelsFound = false;
    let modelsFolder= "";
    if(upscalerFound) {
        // chekc to make sure model folder exists
        if(fs.existsSync('./models')) {
            let modelFolder = fs.readdirSync('./models');
            if(modelFolder.length !== 0) {
                modelFolder.forEach((file,i) => {
                    let folder1 = null;
                    try{
                        folder1 = fs.readdirSync('./models/' + file);
                    }catch(e) {
                        // do nothing
                    }
                    // check to see if "file" is a .param or .bin file
                    if(file.endsWith('.param') || file.endsWith('.bin')) {
                        modelsFound = true;
                        modelsFolder = './models/';
                    }else if (folder1 !== undefined) {
                        folder1.forEach((file2,i) => {
                            let folder2 = null;
                            try{
                                folder2 = fs.readdirSync('./models/' + file + '/' + file2);
                            }catch(e) {
                                // do nothing
                            }
                            // check to see if "file" is a .param or .bin file
                            if(file2.endsWith('.param') || file2.endsWith('.bin')) {
                                modelsFound = true;
                                modelsFolder = './models/' + file + '/';
                            }else if (folder2 !== undefined) {
                                folder2.forEach((file3,i) => {
                                    // check to see if "file" is a .param or .bin file
                                    if(file3.endsWith('.param') || file3.endsWith('.bin')) {
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
    }

    if (!upscalerFound) {
        // checked to see if zipped folder exists
        if (!fs.existsSync('./zipped')) {
            fs.mkdirSync('./zipped');
        }
        // checked to see if unzipped folder exists
        if (!fs.existsSync('./unzipped')) {
            fs.mkdirSync('./unzipped');
        }
        console.error('Upscaler is not installed. Attempting to aquire.');
        let platform = process.platform;
        if(platform === 'wi1n32') {
            // download windows upscaler
            //let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows.zip');
            //unzip upscaler
            // log step
            console.log('Downloading and unzipping upscaler');
            let success = await downloadAndUnzip('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows.zip',
            'zipped/','unzipped/');
            if(success) {
                console.log('Successfully downloaded and unzipped upscaler');
            }else{
                return false;
            }
        } else if (platform === 'darwin') {
            // download mac upscaler
            let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-macos.zip')
        } else if (platform === 'linux') {
            // download linux upscaler
            let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-ubuntu.zip')
        } else {
            console.error('Platform not supported');
            return false;
        }
    }

    if(!modelsFound) {
        // download models
        // log step
        console.log('Downloading and unzipping models');
        let success = await downloadAndUnzip('https://github.com/upscayl/custom-models/archive/refs/heads/main.zip','zipped/','unzipped/');
        if(!success) {
            return false;
        }
    }

    // run upscaler
    
    // resolve absolute paths
    upscalerPath = fs.realpathSync(upscalerPath);
    inputFile = fs.realpathSync(inputFile);
    outputFile = fs.realpathSync(outputPath) + '/' + outputFile;
    modelsFolder = fs.realpathSync(modelsFolder);
    let execString = upscalerPath;
    execString += " -i " + "\"" + inputFile + "\"";
    execString += " -o " + "\"" + outputFile + "\"";
    execString += " -f " + format;
    execString += " -s " + scale;
    execString += " -m " + "\"" + modelsFolder + "\"";
    execString += " -n ultrasharp-2.0.1 ";
    let scaling = exec(execString, (err, stdout, stderr) => {
        if (err) {
           // console.error(err);
            return false;
        }
        //console.log(stdout);
        //console.log(stderr);
        return true;
    });
    scaling.stderr.on('data', (data) => {
        //console.error(`stderr: ${data}`);
        // TODO: call progress callback
    });
    while(scaling.exitCode === null) {
        await waitSeconds(5);
    }
    // log
    //console.log('Successfully upscaled image');
    if(scaling.exitCode == 0) {
        return true;
    }else{
        return false;
    }
}

async function waitSeconds(count) {
    // this holds the promise returned by the confirm function
    return await new Promise((resolve) => {
        setTimeout(() => {
            // if the user hasn't pressed enter to cancel, cancel the confirmation promise and resolve the wait promise with false
            resolve();
        }, count * 1000);
    });
};

async function downloadAndUnzip(url, zipPath, extractPath) {
    try {
        // Fetching the zip file
        const response = await fetch(url,{
            onprogress: (progress) => {
                console.log(progress);
            }
        });
        // Getting the buffer of the downloaded file
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Saving the zip file to the disk
        fs.writeFileSync(zipPath, buffer);
        // Unzipping the downloaded file
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);
        return true;
    } catch (error) {
        // log step
        return false;
    }
}

export default upscale;