import fs from 'fs';

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
        console.error('Upscaler is not installed. Attempting to aquire.');
        let platform = process.platform;
        console.log(platform);
        //let upscaler = await fetch(''
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

module.exports = {upscale};