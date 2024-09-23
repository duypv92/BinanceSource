var fs = require('fs');
var nodemailer = require('nodemailer');

const Reset = "\x1b[0m"
const Bright = "\x1b[1m"
const Dim = "\x1b[2m"
const Underscore = "\x1b[4m"
const Blink = "\x1b[5m"
const Reverse = "\x1b[7m"
const Hidden = "\x1b[8m"

const FgBlack = "\x1b[30m"
const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgYellow = "\x1b[33m"
const FgBlue = "\x1b[34m"
const FgMagenta = "\x1b[35m"
const FgCyan = "\x1b[36m"
const FgWhite = "\x1b[37m"
const FgGray = "\x1b[90m"

const BgBlack = "\x1b[40m"
const BgRed = "\x1b[41m"
const BgGreen = "\x1b[42m"
const BgYellow = "\x1b[43m"
const BgBlue = "\x1b[44m"
const BgMagenta = "\x1b[45m"
const BgCyan = "\x1b[46m"
const BgWhite = "\x1b[47m"
const BgGray = "\x1b[100m"

const formatDate = (inputDate, format) => {
    if (!inputDate) return '';

    const padZero = (value) => (value < 10 ? `0${value}` : `${value}`);
    const parts = {
        yyyy: inputDate.getFullYear(),
        MM: padZero(inputDate.getMonth() + 1),
        dd: padZero(inputDate.getDate()),
        HH: padZero(inputDate.getHours()),
        hh: padZero(inputDate.getHours() > 12 ? inputDate.getHours() - 12 : inputDate.getHours()),
        mm: padZero(inputDate.getMinutes()),
        ss: padZero(inputDate.getSeconds()),
        tt: inputDate.getHours() < 12 ? 'AM' : 'PM'
    };

    return format.replace(/yyyy|MM|dd|HH|hh|mm|ss|tt/g, (match) => parts[match]);
}

const customLog = (message, sendAnorderMail = false) => {
    let currentTime = new Date();
    var dateString = formatDate(currentTime, 'yyyy/MM/dd hh:mm:ss');
    console.log(FgBlue + `-${dateString} ${Reset}: ${message}`);
    writeLogFile(`-${dateString} : ${message}`, sendAnorderMail);
}


const writeLogFile = async (msg, sendAnorderMail) => {
    let custom_msg = replaceString(msg + '\n');
    fs.appendFile("/tmp/log.log", custom_msg, function (err) {
        if (err) {
            return console.log(err);
        }
    });
    if (sendAnorderMail == true) {
        fs.appendFile("/tmp/status.log", custom_msg, function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }

}

const replaceString = (msg) => {
    let result = msg;
    if (msg.includes('\x1b')) {
        const firstIndex = msg.indexOf('\x1b');
        const lastIndex = firstIndex + 5;
        result = msg.slice(0, firstIndex) + msg.slice(lastIndex);
    }
    result = result.replace("[0m", '');
    result = result.replace("[0m)", '')
    result = result.replace("[33m", '');
    return result;
}

const sendMail = async (msg) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'duypv250592@gmail.com',
            pass: 'ruzb mujq hjrv zdlj'
        }
    })

    var mailOptions = {
        from: 'duypv250592@gmail.com',
        to: 'duypv@outlook.com',
        subject: 'Report from binance tool',
        text: 'That was easy!',
        attachments: [
            {   // file on disk as an attachment
                filename: 'report.txt',
                path: '/tmp/log.log' // stream this file
            }
        ]
    };

    await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

const sendAnotherMail = async (msg) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'duypv250592@gmail.com',
            pass: 'ruzb mujq hjrv zdlj'
        }
    })

    var mailOptions = {
        from: 'duypv250592@gmail.com',
        to: ['duypv@outlook.com', 'juliatrang4993@gmail.com'],
        subject: 'Report from binance tool',
        text: 'Market status!',
        attachments: [
            {   // file on disk as an attachment
                filename: 'status.txt',
                path: '/tmp/status.log' // stream this file
            }
        ]
    };

    await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = {
    formatDate, customLog, writeLogFile, sendMail, sendAnotherMail,
    Reset,
    Bright,
    Dim,
    Underscore,
    Blink,
    Reverse,
    Hidden,
    FgBlack,
    FgRed,
    FgGreen,
    FgYellow,
    FgBlue,
    FgMagenta,
    FgCyan,
    FgWhite,
    FgGray,
    BgBlack,
    BgRed,
    BgGreen,
    BgYellow,
    BgBlue,
    BgMagenta,
    BgCyan,
    BgWhite,
    BgGray
};