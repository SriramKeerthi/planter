import fs from 'fs';
import mqtt from "mqtt";
import { Comm } from './comm';

const mqttHost = process.env['MQTT_HOST'];

console.log("Starting client, assets are at " + process.env['PLANTER_HOME']);

const getSearchTerm = (): string => {
    const terms = fs.readFileSync('./assets/search_term.txt', 'utf8').split('\n').filter(term => term.length > 0);
    return terms[Math.floor(Math.random() * terms.length)];
}

console.log("Connecting to " + mqttHost);
if (!mqttHost) {
    console.error("No MQTT_HOST set");
    process.exit(1);
}

const client = mqtt.connect(mqttHost, {
    username: process.env['MQTT_USER'],
    password: process.env['MQTT_PASS'],
});

// console.log("Client", { client });

const devices: Record<string, Comm> = {};

client.on("connect", () => {
    ["log/#", "file/#", "fileack/#", "message/#", "ack/#", "terminate/#"].forEach(topic => {
        client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`Subscribed to ${topic}`);
            }
        });
    });
});

client.on("message", (topic, message) => {
    const topicParts = topic.split('/');
    const topicType = topicParts[0];
    const clientId = topicParts[1];
    switch (topicType) {
        case "terminate":
            if (clientId === 'self') {
                console.log('Terminating self');
                client.end();
                return;
            }
            console.log('Terminating client', clientId);
            if (devices[clientId]) {
                delete devices[clientId];
            }
            break;
        case "message":
        case "log":
            console.log(`${topicType}(${clientId})>>`, message.toString());
            break;
        case "file":
            fs.writeFileSync(`./assets/image_recv_${clientId}.gif`, message, { flag: 'a' });
            break;
        case "fileack":
            if (devices[clientId]) {
                if (devices[clientId].ack(parseInt(message.toString()))) {
                    devices[clientId].nextChunk();
                } else {
                    console.log(`Failed to send next chunk to ${clientId}, retrying`);
                    devices[clientId].resend();
                }
            }
            break;
        case "ack":
            console.log(`${topicType}/${clientId}>>`, message.toString());
            if (message.toString().startsWith('Hello from')) {
                const messageParts = message.toString().split(' ').slice(-2)
                const bufferSize = parseInt(messageParts[0]);
                const imageWidth = parseInt(messageParts[1]);
                console.log('Client logging in', { clientId, bufferSize, imageWidth });
                if (!devices[clientId]) {

                    devices[clientId] = new Comm({
                        mqtt: client,
                        clientId: clientId,
                        imageWidth,
                        chunkSize: clientId === 'e9f29e748' ? 8000 : bufferSize,
                    });

                }
                devices[clientId].beginImage(getSearchTerm());

            } else if (message.toString().startsWith('switching to')) {
                // setTimeout(async () => {
                //     const buffer = await fetchRandomImage(clients[clientId].imageWidth, getSearchTerm(), 3);
                //     if (buffer) {
                //         clients[clientId].send(buffer);
                //     }
                // }, 3000);
            }
            break;
        default:
            console.log('Received:', topic);
            console.log('Unknown message')
            break;
    }
});

setTimeout(() => client.publish("message/self", "Hello"), 5000);
