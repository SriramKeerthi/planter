import fs from 'fs';
import WebSocket from 'ws';

const ws = new WebSocket('ws://planter.kunjathur.com/ws', { auth: `${process.env['WS_USERNAME']}:${process.env['WS_PASSWORD']}` }); // replace with your server address

ws.on('open', () => {
    console.log('Connected to server!');

    const image = fs.readFileSync('./apps/planter-ws-client/src/assets/image.txt', 'utf8').split('\n').join('');

    ws.send(JSON.stringify(
        {
            event: "push",
            data: {
                cid: 'MDEyMzQ1Njc4OWFiY2RlZg==',
                data: JSON.stringify({
                    event: "config",
                    data: {
                        sounds: false,
                        tftBrightness: 128,
                        ledBrightness: 255
                    }
                }),
            }
        }
    ));

    ws.send(JSON.stringify({
        event: 'push',
        data: {
            cid: 'MDEyMzQ1Njc4OWFiY2RlZg==',
            data: JSON.stringify({
                event: "image",
                data: {
                    image: Buffer.from(image).toString('base64'),
                    ir: 250,
                    ic: image.length / 510
                }
            })
        }
    }))

    // ws.send(JSON.stringify({
    //     event: 'push',
    //     data: {
    //         cid: 'MDEyMzQ1Njc4OWFiY2RlZg==',
    //         data: JSON.stringify({
    //             event: "restart",
    //             data: {}
    //         })
    //     }
    // }))
    ws.send(JSON.stringify({
        event: 'push',
        data: {
            cid: 'MDEyMzQ1Njc4OWFiY2RlZg==',
            data: JSON.stringify({
                event: "message",
                data: {
                    message: "\n\n\n    Hello there!"
                }
            })
        }
    }))
});

ws.on('message', (data, isBinary) => {
    if (!isBinary) {
        console.log('Received JSON message:', { data: JSON.parse(data.toString()) });
    } else {
        const view = new Uint8Array(data as ArrayBuffer);
        let binaryString = '';
        view.forEach(v => binaryString += String.fromCharCode(v));
        const decodedString = decodeURIComponent(escape(binaryString));
        console.log('Received binary message:', decodedString);
    }
});
