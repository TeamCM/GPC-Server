const net = require("net");
const fs = require("fs");

function getDepedencies(name,platform,version){
    const depedencies = fs.readFileSync(`./packages/${platform}/${name}/${version}/dependencies`,{encoding:"ascii"});
    return depedencies.split(" ").map(d => d.split("_").slice(0,3));
}
/**
 * 
 * @param {string[][]} dependencies 
 */
function dep2buffer(dependencies){
    return Buffer.of(dependencies.length,...Buffer.from(dependencies.map(d => {
        return d[0] + "\x00" + d[2] + "\x00" + d[1] + "\x00"
    }).join(""),"ascii"));
}

/** 
 * @param {Buffer} data
 * @returns {String}
 */
function readMessageUntilNull(data){
    const nullIndex = data.indexOf(0);
    if(!(nullIndex+1)) return "";
    return data.subarray(0,nullIndex).toString("ascii");
}
const server = net.createServer().on("connection", socket => {
    socket.on("error", () => {})
    socket.on("data", d => {
        const opcode = d[0];
        d = d.subarray(1);
        const packageName = readMessageUntilNull(d);
        console.log(packageName);
        d = d.subarray(packageName.length+1);
        const platform = readMessageUntilNull(d);
        d = d.subarray(platform.length+1);
        if(!packageName || !platform)
            return socket.write(`\x01No packageName or platform\x00`, () => socket.end());
        const versionInClient = readMessageUntilNull(d);
        d = d.subarray(versionInClient.length+1);

        if(opcode == 0){
            if(!fs.existsSync(`./packages/${platform}/${packageName}/`))
                return socket.write(`\x01Cant find that package\x00`, () => socket.end());
            let version = versionInClient;
            if(!versionInClient)
                version = fs.readFileSync(`./packages/${platform}/${packageName}/latestVersion`, {encoding:"ascii"});
            
            if(!fs.existsSync(`./packages/${platform}/${packageName}/${version}/${packageName}_${version}_${platform}`))
                return socket.write(`\x01Cant find that package\x00`, () => socket.end());
            const package = fs.statSync(`./packages/${platform}/${packageName}/${version}/${packageName}_${version}_${platform}`);
            const bufSize = Buffer.alloc(6);
            const dependencies = dep2buffer(getDepedencies(packageName, platform, version));
            bufSize.writeUintBE(package.size,0,6);
            socket.write(`\x00${packageName}\x00${platform}\x00${version}\x00`, () => socket.write(bufSize, () => socket.write(dependencies)));
        }else if(opcode == 1){
            if(!versionInClient)
                return socket.write(`\x01No version\x00`, () => socket.end());
            if(!fs.existsSync(`./packages/${platform}/${packageName}/${versionInClient}/${packageName}_${versionInClient}_${platform}`))
                return socket.write(`\x01Cant find that package\x00`, () => socket.end());
            console.log(packageName);
            socket.write(Buffer.of(0), () => {
                console.log("OK SEND");
                socket.write(fs.readFileSync(`./packages/${platform}/${packageName}/${versionInClient}/${packageName}_${versionInClient}_${platform}`), () => {
                    console.log("DOWNLOAD OK");
                });
            });
        }else socket.end();
    });
}).on("listening", () => console.log(`Listening on ${server.address().port}!`)).listen(400);