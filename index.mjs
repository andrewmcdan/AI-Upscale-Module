import fs from 'fs';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';

const upscale = async (inputFile) => {
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

    // check to make sure upscaler is installed
    if (!fs.existsSync('./upscaler.exe')) {
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
        if(platform === 'win32') {
            // download windows upscaler
            let upscaler = await fetch('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows.zip');
            //unzip upscaler
            let success = await downloadAndUnzip('https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows.zip',
            'zipped/realesrgan-ncnn-vulkan-v0.2.0-windows.zip','unzipped/');
            if(success) {
                console.log('Successfully downloaded and unzipped upscaler');
                // find the .exe file
                let files = fs.readdirSync('./unzipped/');
                let exeFile = files.find(file => file.endsWith('.exe'));
                // move the .exe file to the root directory and rename to upscaler.exe
                fs.renameSync(`./unzipped/${exeFile}`, './upscaler.exe');
            }else{
                console.error('Failed to download and unzip upscaler');
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

    // run upscaler
    // const { exec } = require('child_process');
    // exec(`upscaler.exe --input ${inputFile} --output ${inputFile}`, (err, stdout, stderr) => {
    //     if (err) {
    //         console.error(err);
    //         return false;
    //     }
    //     console.log(stdout);
    //     console.log(stderr);
    //     return true;
    // });
}

async function downloadAndUnzip(url, zipPath, extractPath) {
    try {
        // Fetching the zip file
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Saving the zip file to the disk
        fs.writeFileSync(zipPath, buffer);
        
        // Unzipping the downloaded file
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);
        
        return true;
    } catch (error) {
        return false;
    }
}

export default upscale;